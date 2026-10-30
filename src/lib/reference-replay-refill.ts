import type { Brand } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { startOfPublishDay } from "@/lib/account-trust-ramp";
import { generatePostsForBrand } from "@/lib/generate-posts";
import { MANUAL_X_SOURCE, REFERENCE_REPLAY_MANUAL_TAG, loadReferenceReplaySource, markReferenceAttempted } from "@/lib/reference-replay";
import { REFERENCE_REPLAY_MODE } from "@/lib/viral-intent-modes";
import { parseBrandConfig } from "@/types/brand";

export type ReferenceRefillResult =
  | { generated: 1; sourceId: string }
  | { generated: 0; skipped: "no_keywords" | "no_own_handle" | "already_today" | "attempted_today" | "pending_in_queue" | "no_source" | "dropped"; reason?: string };

// One ref_replay draft per publish day, generated apart from the refill batch so the batch's count math stays untouched.
export async function refillReferenceReplay(brand: Brand, now: Date): Promise<ReferenceRefillResult> {
  const { keywords, ownHandle } = parseBrandConfig(brand.brandConfig).viralDiscovery;
  if (keywords.length === 0) return { generated: 0, skipped: "no_keywords" };
  // Without the brand's own handle the own-post exclusion cannot work, and our own post could become the "reference".
  if (!ownHandle) return { generated: 0, skipped: "no_own_handle" };

  const formulaId = REFERENCE_REPLAY_MODE.id;
  const dayStart = startOfPublishDay(now);
  // Manual drafts (operator-pasted X posts) share the formulaId but are not the cron's slot, so they never count here.
  const notManual = { NOT: { qualityReasons: { contains: REFERENCE_REPLAY_MANUAL_TAG } } };
  // Any status counts: a rejected or published one still used today's slot. publishedAt covers a draft made yesterday and published today.
  const today = await prisma.post.count({
    where: { brandId: brand.id, formulaId, ...notManual, OR: [{ createdAt: { gte: dayStart } }, { publishedAt: { gte: dayStart } }] },
  });
  if (today > 0) return { generated: 0, skipped: "already_today" };
  // NEEDS_REVIEW is intentionally not counted: it is waiting on a human, not on the publish queue.
  const pending = await prisma.post.count({ where: { brandId: brand.id, formulaId, status: "PENDING", ...notManual } });
  if (pending > 0) return { generated: 0, skipped: "pending_in_queue" };

  // A dropped attempt leaves no Post, so the stamp on the source row is the only trace; one attempt per day keeps the cron's LLM cost at one call.
  if (await attemptedSince(brand.id, dayStart)) return { generated: 0, skipped: "attempted_today" };

  const source = await loadReferenceReplaySource(brand.id, now);
  // The prompt path silently drops an empty reference, so a blank source is no source.
  if (!source || !source.content.trim()) return { generated: 0, skipped: "no_source" };

  // Marked before generating: a dropped draft must not retry the same source on the next run.
  await markReferenceAttempted(source.id, now);
  const result = await generatePostsForBrand(brand, {
    count: 1,
    insertAtFront: false,
    requestedCampaignId: null,
    approvedCampaignStart: false,
    postCategory: "GROWTH",
    referenceReplay: source,
  });
  if (!result.ok) return { generated: 0, skipped: "dropped", reason: result.error };
  if (result.summary.count === 0) return { generated: 0, skipped: "dropped", reason: result.summary.failureReasons.join("; ") || undefined };
  return { generated: 1, sourceId: source.id };
}

async function attemptedSince(brandId: string, since: Date): Promise<boolean> {
  const rows = await prisma.viralExample.findMany({ where: { brandId, source: { not: MANUAL_X_SOURCE }, rawMetrics: { contains: "replayAttemptedAt" } }, select: { rawMetrics: true } });
  return rows.some((row) => {
    try {
      const parsed: unknown = JSON.parse(row.rawMetrics);
      const stamp = typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>).replayAttemptedAt : null;
      return typeof stamp === "string" && Date.parse(stamp) >= since.getTime();
    } catch {
      return false;
    }
  });
}
