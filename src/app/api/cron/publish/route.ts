import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFreshBrandCredentials } from "@/lib/threads-api";
import { publishOrResumePost } from "@/lib/threads/thread-resume-engine";
import { getPublishSafetyBlockReasons } from "@/lib/publish-safety-gate";
import { verifyCronSecret } from "@/lib/cron-auth";
import { isCircadianQuietHour, checkMinimumCooldown, evaluateSporadicSkip } from "@/lib/behavioral-jitter";
import { resolveAccountTrustTier } from "@/lib/account-trust-ramp";
import { parseBrandConfig } from "@/types/brand";
import { sendSystemAlert } from "@/lib/alert-service";

export const maxDuration = 60;

const SAFE_WARMUP_TEMPLATES = [
  "일과 삶의 균형을 찾는 과정에서 가장 중요한 건, 나만의 속도를 잃지 않는 것입니다. 오늘 하루도 묵묵히 버텨낸 모든 분들을 응원합니다. 오늘 하루 중 가장 기억에 남는 순간은 무엇이었나요?",
  "어떤 결정을 내릴 때 가장 불안한 순간은 바로 시작 직전인 것 같습니다. 막상 한 걸음 내딛고 나면 생각보다 담담해지곤 하죠. 요즘 가장 고민되는 선택이 있으신가요?",
  "휴식도 일의 일부라는 말을 다시금 되새기게 되는 저녁입니다. 잠시 스마트폰을 내려놓고 스스로에게 온전한 쉼을 선물해보세요. 여러분만의 스트레스 해소 루틴이 있다면 나눠주세요.",
  "실패를 두려워하지 않는 사람은 없습니다. 단지 그 두려움보다 앞으로 나아가고 싶은 열망이 조금 더 클 뿐이죠. 이번 주 스스로에게 가장 칭찬해주고 싶은 행동은 무엇인가요?",
];

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const brands = await prisma.brand.findMany();
  if (brands.length === 0) {
    return NextResponse.json({ published: [], skipped: [], message: "No brands found" });
  }

  const published: { brandId: string; brandName: string; postId: string; threadsId: string }[] = [];
  const skipped: { brandId: string; brandName: string; reason: string }[] = [];

  for (const brand of brands) {
    try {
      const now = new Date();
      const brandConfig = parseBrandConfig(brand.brandConfig || "{}");

      // 1. Circadian Quiet Hours Guard (if jitterEnabled is true)
      if (brandConfig.jitterEnabled && isCircadianQuietHour(now)) {
        skipped.push({ brandId: brand.id, brandName: brand.name, reason: "circadian_quiet_hour" });
        continue;
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
        const lastPublished = await prisma.post.findFirst({
          where: { brandId: brand.id, status: "PUBLISHED" },
          orderBy: { publishedAt: "desc" },
        });
        if (lastPublished && lastPublished.status === "PUBLISHED" && lastPublished.publishedAt) {
          const cooldown = checkMinimumCooldown(lastPublished.publishedAt, now, 180);
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
              data: { brandConfig: JSON.stringify(brandConfig) },
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
            const fallbackContent = SAFE_WARMUP_TEMPLATES[Math.floor(Math.random() * SAFE_WARMUP_TEMPLATES.length)];
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
          post = await prisma.post.findFirst({
            where: {
              brandId: brand.id,
              status: "PENDING",
              scheduledAt: { lte: now },
              OR: [
                { qualityPass: true },
                { qualityPass: null },
              ],
            },
            orderBy: { scheduledAt: "asc" },
          });
        }
      }

      if (!post) {
        const blockedCount = await prisma.post.count({
          where: { brandId: brand.id, status: "PENDING", qualityPass: false },
        });
        skipped.push({
          brandId: brand.id,
          brandName: brand.name,
          reason: blockedCount > 0 ? "quality_blocked" : "no_pending",
        });
        continue;
      }

      // Concurrency lock (Atomic status update to PROCESSING if updateMany is available)
      if (typeof prisma.post.updateMany === "function") {
        const locked = await prisma.post.updateMany({
          where: {
            id: post.id,
            status: isResuming ? "PARTIAL_FAILED" : "PENDING",
          },
          data: { status: "PROCESSING" },
        });
        if (locked && locked.count === 0) {
          skipped.push({ brandId: brand.id, brandName: brand.name, reason: "concurrently_locked" });
          continue;
        }
      }

      // 5. Account Trust Ramp Calculation (Defaults to 'established' for existing accounts)
      const tier = brandConfig.accountTrustTier || (brandConfig.accountCreatedAt ? resolveAccountTrustTier(new Date(brandConfig.accountCreatedAt), now) : "established");
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const publishedTodayCount = await prisma.post.count({
        where: { brandId: brand.id, status: "PUBLISHED", publishedAt: { gte: startOfDay } },
      });
      const accountTrustOption = { tier, publishedTodayCount };

      const safetyReasons = getPublishSafetyBlockReasons(post, {
        accountTrust: accountTrustOption,
        accountHealth: brandConfig.accountHealth || {
          status: brandConfig.shadowbanStatus,
        },
        minAlgorithmicScore: brandConfig.minAlgorithmicScore,
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
          if (brandConfig.lastTickSkipped) {
            brandConfig.lastTickSkipped = false;
            await prisma.brand.update({
              where: { id: brand.id },
              data: { brandConfig: JSON.stringify(brandConfig) },
            });
          }

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
        const errorMsg = publishErr instanceof Error ? publishErr.message : String(publishErr);
        console.error(`[cron/publish] ❌ ${brand.name}: publish failed`, publishErr);
        if (post && post.id) {
          await prisma.post.update({
            where: { id: post.id },
            data: { status: "FAILED", errorLog: errorMsg },
          }).catch(() => {});
        }
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
