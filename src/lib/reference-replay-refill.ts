import type { Brand } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { startOfPublishDay } from "@/lib/account-trust-ramp";
import { generatePostsForBrand } from "@/lib/generate-posts";
import { loadReferenceReplaySource, markReferenceAttempted } from "@/lib/reference-replay";
import { REFERENCE_REPLAY_MODE } from "@/lib/viral-intent-modes";
import { parseBrandConfig } from "@/types/brand";

export type ReferenceRefillResult =
  | { generated: 1; sourceId: string }
  | { generated: 0; skipped: "no_keywords" | "already_today" | "pending_in_queue" | "no_source" | "dropped"; reason?: string };

// One ref_replay draft per publish day, generated apart from the refill batch so the batch's count math stays untouched.
export async function refillReferenceReplay(brand: Brand, now: Date): Promise<ReferenceRefillResult> {
  if (parseBrandConfig(brand.brandConfig).viralDiscovery.keywords.length === 0) return { generated: 0, skipped: "no_keywords" };

  const formulaId = REFERENCE_REPLAY_MODE.id;
  // Any status counts: a rejected or published one still used today's slot.
  const today = await prisma.post.count({ where: { brandId: brand.id, formulaId, createdAt: { gte: startOfPublishDay(now) } } });
  if (today > 0) return { generated: 0, skipped: "already_today" };
  // NEEDS_REVIEW is intentionally not counted: it is waiting on a human, not on the publish queue.
  const pending = await prisma.post.count({ where: { brandId: brand.id, formulaId, status: "PENDING" } });
  if (pending > 0) return { generated: 0, skipped: "pending_in_queue" };

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
