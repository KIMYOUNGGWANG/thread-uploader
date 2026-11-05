import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFreshBrandCredentials } from "@/lib/threads-api";
import { publishOrResumePost } from "@/lib/threads/thread-resume-engine";
import { getPublishSafetyBlockReasons } from "@/lib/publish-safety-gate";
import { verifyCronSecret } from "@/lib/cron-auth";
import {
  isCircadianQuietHour,
  checkMinimumCooldown,
  evaluateSporadicSkip,
  findOpenPublishSlot,
  parseSlotHours,
} from "@/lib/behavioral-jitter";
import { resolveAccountTrustTier, startOfPublishDay, TIER_DAILY_QUOTAS } from "@/lib/account-trust-ramp";
import { getActiveCampaign, parseBrandConfig, serializeBrandConfigUpdate } from "@/types/brand";
import { sendSystemAlert } from "@/lib/alert-service";
import { isMetricsCollectionStale } from "@/lib/metrics-selection";
import { loadLengthExperimentState, pickPublishCandidate } from "@/lib/length-experiment";
import {
  checkCircuitBreaker,
  recordCircuitBreakerFailure,
  recordCircuitBreakerSuccess,
} from "@/lib/threads-publisher";
import { BRAND_PUBLISH_SLOTS_UTC, resolvePublishSlots } from "@/lib/publish-slots";

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
// GitHub schedules run hours late, so the scheduler calls hourly and a slot stays open this long.
const SLOT_WINDOW_HOURS = 3;
// ponytail: scans the oldest 50 due drafts for the slot's arm; raise if the queue grows past that
const LENGTH_EXPERIMENT_CANDIDATES = 50;

export const maxDuration = 300; // video containers can take minutes to process

// Shadowban-recovery fallback: link-free, low-risk posts that still give readers a reason to react.
// 2026-11-04 benchmark: "이 글 보신 분들 … 대운 터지세요" blessing posts drew 1.5k-3k likes on Korean saju Threads,
// while the old life-advice lines had no reason to be answered. English accounts post the same shape.
const SAFE_WARMUP_TEMPLATES_KO = [
  "우연히 이 글 본 사람\n이번 달 막혀 있던 일 하나 풀린다.\n좋은 소식 하나 들어올 거야.",
  "이 글 보는 사람들\n이번 주 귀인 하나 붙는다.\n연락 오면 그냥 넘기지 마.",
  "지금 이 글 보는 사람\n연말 전에 돈 들어올 구멍 하나 생긴다.\n받을 준비만 해둬.",
  "스크롤 내리다 이 글 멈춘 사람\n요즘 고생한 거 다 보상받는 흐름 온다.\n조금만 더 버텨.",
];
const SAFE_WARMUP_TEMPLATES_EN = [
  "If this found you today, something that has been stuck is about to move.\nLet it.",
  "Whoever is reading this: the help you have been waiting for is closer than it looks.\nAnswer when it calls.",
  "This is your sign that the hard season is ending.\nYou did not go through all that for nothing.",
  "If you stopped scrolling here, good news is on its way to you this week.",
];

function warmupTemplates(language: string | undefined, slug: string): readonly string[] {
  return language === "en" || slug.includes("global") ? SAFE_WARMUP_TEMPLATES_EN : SAFE_WARMUP_TEMPLATES_KO;
}

type UnpublishableQueue = { qualityBlocked: number; awaitingReview: number; scheduledLater: number };

// Refill counts PENDING + NEEDS_REVIEW (under 48h old) as backlog, so a queue that is empty here can look full there.
// Naming why it is empty keeps that deadlock visible in the run log (Global sat idle 2026-10-16..21 as "no_pending").
async function countUnpublishableQueue(brandId: string, now: Date): Promise<UnpublishableQueue> {
  const [qualityBlocked, awaitingReview, scheduledLater] = await Promise.all([
    prisma.post.count({ where: { brandId, status: "PENDING", qualityPass: false } }),
    prisma.post.count({ where: { brandId, status: "NEEDS_REVIEW" } }),
    prisma.post.count({ where: { brandId, status: "PENDING", qualityPass: true, scheduledAt: { gt: now } } }),
  ]);
  return { qualityBlocked, awaitingReview, scheduledLater };
}

function emptyQueueReason(queue: UnpublishableQueue): string {
  if (queue.qualityBlocked > 0) return "quality_blocked";
  if (queue.awaitingReview > 0) return "awaiting_review";
  if (queue.scheduledLater > 0) return "scheduled_later";
  return "no_pending";
}

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Optional ?brands=slug1,slug2 lets the scheduler call one brand per request (keeps each run under maxDuration)
  const brandSlugs = request.nextUrl.searchParams.get("brands")?.split(",").map((slug) => slug.trim()).filter(Boolean);
  const brands = await prisma.brand.findMany(brandSlugs?.length ? { where: { slug: { in: brandSlugs } } } : undefined);
  // Optional ?slots=0,12 (UTC hours): publish at most once per slot, whenever the run lands inside its window.
  const rawSlots = request.nextUrl.searchParams.get("slots");
  const slotHours = parseSlotHours(rawSlots);
  if (rawSlots && !slotHours) {
    return NextResponse.json({ error: "slots must be comma-separated UTC hours 0-23" }, { status: 400 });
  }
  if (brands.length === 0) {
    return NextResponse.json({ published: [], skipped: [], message: "No brands found" });
  }

  const published: { brandId: string; brandName: string; postId: string; threadsId: string }[] = [];
  const skipped: { brandId: string; brandName: string; reason: string }[] = [];

  for (const brand of brands) {
    try {
      const now = new Date();
      const brandConfig = parseBrandConfig(brand.brandConfig || "{}");

      // 0. Circuit Breaker Guard
      const breakerCheck = checkCircuitBreaker(brandConfig, now);
      if (!breakerCheck.isAllowed) {
        skipped.push({ brandId: brand.id, brandName: brand.name, reason: "circuit_breaker_active" });
        continue;
      }

      // 0.1 24h hard safety limit check (max 240 posts/24h)
      const publishedLast24h = await prisma.post.count({
        where: {
          brandId: brand.id,
          status: "PUBLISHED",
          publishedAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
        },
      });
      if (publishedLast24h >= 240) {
        skipped.push({ brandId: brand.id, brandName: brand.name, reason: "rate_limit_24h_exhausted" });
        continue;
      }

      // 1. Circadian Quiet Hours Guard (if jitterEnabled is true). Pinned slots are hand-picked hours and win:
      // cosmicpath's KST 01 slot (UTC 16) sits inside the 01:00-06:30 quiet window, so it never published (10-28..11-05).
      if (brandConfig.jitterEnabled && !BRAND_PUBLISH_SLOTS_UTC[brand.slug] && isCircadianQuietHour(now)) {
        skipped.push({ brandId: brand.id, brandName: brand.name, reason: "circadian_quiet_hour" });
        continue;
      }

      // 1.5 Stuck-claim alert: runs are sequential and hours apart, so an in-flight status here means a previous run died mid-publish.
      // ponytail: alert only — auto-reset needs a lockedAt column to tell stale claims from a concurrent manual publish.
      const stuckPosts = await prisma.post.findMany({
        where: { brandId: brand.id, status: { in: ["PUBLISHING", "PARTIAL_PUBLISHED", "PROCESSING"] } },
        select: { id: true, status: true },
      });
      if (stuckPosts.length > 0) {
        await sendSystemAlert({
          level: "warning",
          title: "Stuck publish claims",
          message: `${stuckPosts.length} post(s) stuck in-flight: ${stuckPosts.map((p) => `${p.id}(${p.status})`).join(", ")}`,
          brandName: brand.name,
        });
      }

      // 1.6 Stale-metrics alert: fetch-metrics lives in a separate workflow that was disabled for
      // 7 weeks (2026-08-14..10-04) without anyone noticing, starving the learning loop.
      // ponytail: repeats every publish run until fixed — add a cooldown if it gets noisy.
      const awaitingMetrics = await prisma.post.count({
        where: {
          brandId: brand.id,
          status: "PUBLISHED",
          publishedAt: { gte: new Date(now.getTime() - FOURTEEN_DAYS_MS), lte: new Date(now.getTime() - TWO_DAYS_MS) },
        },
      });
      if (awaitingMetrics > 0) {
        const latestMeasured = await prisma.post.findFirst({
          where: { brandId: brand.id, metricsAt: { not: null } },
          orderBy: { metricsAt: "desc" },
          select: { metricsAt: true },
        });
        const latestMetricsAt = latestMeasured?.metricsAt ?? null;
        if (isMetricsCollectionStale(latestMetricsAt, now.getTime())) {
          await sendSystemAlert({
            level: "error",
            title: "Metrics collection stopped",
            message: `No post metrics collected since ${latestMetricsAt?.toISOString() ?? "never"}. Check the "Fetch Post Metrics" workflow is enabled.`,
            brandName: brand.name,
          });
        }
      }

      // 2. Priority 1: Check for incomplete multi-part thread requiring resume (PARTIAL_FAILED)
      let post = await prisma.post.findFirst({
        where: {
          brandId: brand.id,
          status: "PARTIAL_FAILED",
        },
        orderBy: { scheduledAt: "asc" },
      });

      const isResuming = Boolean(post);

      // 3. Minimum Inter-Post Cooldown Check (only for new posts, not resuming)
      if (!isResuming) {
        // publishedAt not null: Postgres sorts NULLs first on DESC, so one legacy PUBLISHED row without a date
        // became "last published" and disabled both the slot gate and the cooldown (2026-10-23: 3 KR posts
        // in the 09:00 slot within 36 min once the scheduler ran every 15 min).
        const lastPublished = await prisma.post.findFirst({
          where: { brandId: brand.id, status: "PUBLISHED", publishedAt: { not: null } },
          orderBy: { publishedAt: "desc" },
        });
        const brandSlots = resolvePublishSlots(brand.slug, slotHours);
        if (brandSlots) {
          const openSlot = findOpenPublishSlot(now, brandSlots, SLOT_WINDOW_HOURS);
          const slotServed = Boolean(openSlot && lastPublished?.publishedAt && lastPublished.publishedAt >= openSlot);
          if (!openSlot || slotServed) {
            skipped.push({ brandId: brand.id, brandName: brand.name, reason: openSlot ? "slot_already_served" : "outside_publish_slot" });
            continue;
          }
        }
        if (lastPublished && lastPublished.status === "PUBLISHED" && lastPublished.publishedAt) {
          // 90 min fits the 2h gap between the 12:00 and 14:00 UTC scheduler slots
          const cooldown = checkMinimumCooldown(lastPublished.publishedAt, now, 90);
          if (!cooldown.allowed) {
            skipped.push({ brandId: brand.id, brandName: brand.name, reason: "cooldown_active" });
            continue;
          }
        }

        // 4. Anti-Bot Sporadic Mode (~18% skip, guaranteed no back-to-back skips)
        if (brandConfig.sporadicEnabled) {
          const sporadic = evaluateSporadicSkip(Boolean(brandConfig.lastTickSkipped));
          if (sporadic.shouldSkip) {
            brandConfig.lastTickSkipped = true;
            await prisma.brand.update({
              where: { id: brand.id },
              data: { brandConfig: serializeBrandConfigUpdate(brand.brandConfig, brandConfig) },
            });
            skipped.push({ brandId: brand.id, brandName: brand.name, reason: "sporadic_skip" });
            continue;
          }
        }

        const isShadowbanSuspected =
          brandConfig.accountHealth?.status === "SHADOWBAN_SUSPECTED" ||
          brandConfig.shadowbanStatus === "SHADOWBAN_SUSPECTED";

        if (isShadowbanSuspected) {
          const startOfDay = new Date(now);
          startOfDay.setHours(0, 0, 0, 0);
          const publishedTodayCount = await prisma.post.count({
            where: { brandId: brand.id, status: "PUBLISHED", publishedAt: { gte: startOfDay } },
          });

          // In shadowban mode, limit to 1 post per day
          if (publishedTodayCount >= 1) {
            skipped.push({ brandId: brand.id, brandName: brand.name, reason: "shadowban_daily_limit" });
            continue;
          }

          // Prioritize WARMUP category post
          post = await prisma.post.findFirst({
            where: {
              brandId: brand.id,
              status: "PENDING",
              postCategory: "WARMUP",
              scheduledAt: { lte: now },
            },
            orderBy: { scheduledAt: "asc" },
          });

          // If no WARMUP post found in queue, generate safe on-demand warmup fallback
          if (!post) {
            const templates = warmupTemplates(brandConfig.voiceProfile?.language, brand.slug ?? "");
            const fallbackContent = templates[Math.floor(Math.random() * templates.length)];
            post = await prisma.post.create({
              data: {
                brandId: brand.id,
                content: fallbackContent,
                firstComment: null,
                scheduledAt: now,
                status: "PENDING",
                postCategory: "WARMUP",
                algorithmicScore: 85,
                algorithmicPass: true,
              },
            });
          }
        } else {
          const queuedWhere = { brandId: brand.id, status: "PENDING", qualityPass: true };
          const pendingWhere = { ...queuedWhere, scheduledAt: { lte: now } };
          const lengthExperiment = await loadLengthExperimentState(brand.id, brandConfig, now);
          if (lengthExperiment) {
            // The pre-registered S/L sequence decides this slot's length; never fill it with the other arm.
            // scheduledAt only orders here: slots, cooldown and quota already pace publishing, and waiting on it
            // left the queue idle behind pre-start drafts that never publish during the experiment.
            const candidates = await prisma.post.findMany({
              where: queuedWhere,
              orderBy: { scheduledAt: "asc" },
              take: LENGTH_EXPERIMENT_CANDIDATES,
            });
            post = pickPublishCandidate(candidates, lengthExperiment.config, lengthExperiment.arm);
            if (!post) {
              skipped.push({ brandId: brand.id, brandName: brand.name, reason: `length_experiment_waiting_${lengthExperiment.arm}` });
              continue;
            }
          } else {
            post = await prisma.post.findFirst({ where: pendingWhere, orderBy: { scheduledAt: "asc" } });
          }
        }
      }

      if (!post) {
        const queue = await countUnpublishableQueue(brand.id, now);
        if (queue.awaitingReview > 0) {
          // ponytail: repeats every in-slot run until reviewed — add a cooldown if it gets noisy.
          await sendSystemAlert({
            level: "warning",
            title: "Publish queue waiting on review",
            message: `${queue.awaitingReview} draft(s) in NEEDS_REVIEW and nothing publishable. Refill counts drafts under 48h old as backlog, so new ones are generated only after that or once these are approved or archived.`,
            brandName: brand.name,
          });
        }
        skipped.push({ brandId: brand.id, brandName: brand.name, reason: emptyQueueReason(queue) });
        continue;
      }

      // No lock here: publishOrResumePost claims PENDING/PARTIAL_FAILED -> PUBLISHING atomically.
      // A second lock (e.g. -> PROCESSING) makes that claim fail and burns the post.

      // 5. Account Trust Ramp Calculation (Defaults to 'established' for existing accounts)
      const tier = brandConfig.accountTrustTier || (brandConfig.accountCreatedAt ? resolveAccountTrustTier(new Date(brandConfig.accountCreatedAt), now) : "established");
      const publishedTodayCount = await prisma.post.count({
        where: { brandId: brand.id, status: "PUBLISHED", publishedAt: { gte: startOfPublishDay(now) } },
      });
      // Quota is a timing limit, not a content defect: wait for tomorrow instead of demoting the post to review.
      // The campaign's dailyPostTarget was never enforced here: once the scheduler ran reliably (2026-10-22)
      // cosmicpath hit the 5/day tier quota and per-post views halved while account-level views stayed flat.
      const campaignTarget = getActiveCampaign(brandConfig)?.dailyPostTarget ?? Infinity;
      if (publishedTodayCount >= Math.min(TIER_DAILY_QUOTAS[tier], campaignTarget)) {
        skipped.push({ brandId: brand.id, brandName: brand.name, reason: "daily_quota_reached" });
        continue;
      }
      const accountTrustOption = { tier, publishedTodayCount };

      const safetyReasons = getPublishSafetyBlockReasons(post, {
        accountTrust: accountTrustOption,
        accountHealth: brandConfig.accountHealth || {
          status: brandConfig.shadowbanStatus,
        },
        // Human-approved posts (algorithmicPass=true) skip the heuristic score re-check; policy checks still apply
        minAlgorithmicScore: post.algorithmicPass === true ? undefined : brandConfig.minAlgorithmicScore,
      });
      if (safetyReasons.length > 0) {
        await prisma.post.update({
          where: { id: post.id },
          data: {
            status: "NEEDS_REVIEW",
            qualityPass: false,
            qualityReasons: JSON.stringify(safetyReasons),
          },
        });
        skipped.push({ brandId: brand.id, brandName: brand.name, reason: "quality_blocked" });
        continue;
      }

      const credentials = await getFreshBrandCredentials(brand.id);

      try {
        const result = await publishOrResumePost(post.id, credentials);

        if (result.success && result.rootThreadsId) {
          const updatedBreaker = recordCircuitBreakerSuccess(brandConfig);
          if (brandConfig.lastTickSkipped) {
            updatedBreaker.lastTickSkipped = false;
          }
          await prisma.brand.update({
            where: { id: brand.id },
            data: { brandConfig: serializeBrandConfigUpdate(brand.brandConfig, updatedBreaker) },
          });

          published.push({
            brandId: brand.id,
            brandName: brand.name,
            postId: post.id,
            threadsId: result.rootThreadsId,
          });
          console.log(
            `[cron/publish] ✅ ${brand.name}: ${post.id} → ${result.rootThreadsId} (${result.partsPosted}/${result.totalParts} parts, resumed=${result.isResumed})`
          );
        } else {
          const reason = result.partsPosted > 0 ? "partial_failed" : "publish_failed";
          const updatedBreaker = recordCircuitBreakerFailure(
            brandConfig,
            result.error || reason,
            3,
            60 * 60 * 1000,
            now
          );
          await prisma.brand.update({
            where: { id: brand.id },
            data: { brandConfig: serializeBrandConfigUpdate(brand.brandConfig, updatedBreaker) },
          });
          skipped.push({
            brandId: brand.id,
            brandName: brand.name,
            reason,
          });
          await sendSystemAlert({
            level: "error",
            title: `Cron Publish ${reason === "partial_failed" ? "Partially Failed" : "Failed"}`,
            message: `Post ${post.id} failed during publish. Error: ${result.error || "Unknown error"}`,
            brandName: brand.name,
            postId: post.id,
          });
        }
      } catch (publishErr) {
        // publishOrResumePost records its own failure status; it only throws when the post is
        // missing or claimed by another worker, so the post status must not be overwritten here.
        const errorMsg = publishErr instanceof Error ? publishErr.message : String(publishErr);
        console.error(`[cron/publish] ❌ ${brand.name}: publish failed`, publishErr);
        const updatedBreaker = recordCircuitBreakerFailure(
          brandConfig,
          errorMsg,
          3,
          60 * 60 * 1000,
          now
        );
        await prisma.brand.update({
          where: { id: brand.id },
          data: { brandConfig: serializeBrandConfigUpdate(brand.brandConfig, updatedBreaker) },
        });
        skipped.push({ brandId: brand.id, brandName: brand.name, reason: "publish_failed" });
        await sendSystemAlert({
          level: "error",
          title: "Cron Publish Exception",
          message: `Unhandled exception publishing post ${post?.id || "unknown"}: ${errorMsg}`,
          brandName: brand.name,
          postId: post?.id,
        });
      }
    } catch (brandErr) {
      console.error(`[cron/publish] ❌ brand error`, brandErr);
      skipped.push({ brandId: brand.id, brandName: brand.name, reason: "publish_failed" });
    }
  }

  return NextResponse.json({ published, skipped });
}
