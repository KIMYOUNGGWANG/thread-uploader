import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCronSecret } from "@/lib/cron-auth";
import { generatePostsForBrand } from "@/lib/generate-posts";
import { parseRefillTarget, planRefillCount } from "@/lib/queue-refill";
import { loadLengthExperimentState, planExperimentRefillCount } from "@/lib/length-experiment";
import { refillReferenceReplay, type ReferenceRefillResult } from "@/lib/reference-replay-refill";
import { parseBrandConfig } from "@/types/brand";

export const maxDuration = 300; // up to MAX_REFILL_PER_RUN drafts with quality retries

// Drafts waiting for review count toward the backlog: a stalled review queue should stall refill too.
const BACKLOG_STATUSES = ["PENDING", "NEEDS_REVIEW"];

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const slug = request.nextUrl.searchParams.get("brand")?.trim();
  const target = parseRefillTarget(request.nextUrl.searchParams.get("target"));
  if (!slug || !target) {
    return NextResponse.json({ error: "brand and target (1-50) are required" }, { status: 400 });
  }

  const brand = await prisma.brand.findUnique({ where: { slug } });
  if (!brand) return NextResponse.json({ error: `Brand not found: ${slug}` }, { status: 404 });

  // One outside-structure draft per day, before the batch so a backlog_full day still gets it. Never blocks the batch.
  const referenceReplay: ReferenceRefillResult = await refillReferenceReplay(brand, new Date()).catch((error: unknown) => ({
    generated: 0 as const,
    skipped: "dropped" as const,
    reason: error instanceof Error ? error.message : "Reference replay failed",
  }));

  const backlog = await prisma.post.count({ where: { brandId: brand.id, status: { in: BACKLOG_STATUSES } } });
  // During the length experiment nobody reviews drafts, so unreviewed ones must not stall refill:
  // fill each arm's PENDING drafts to half the target instead.
  const lengthState = await loadLengthExperimentState(brand.id, parseBrandConfig(brand.brandConfig), new Date());
  const lengthExperiment = lengthState ? { arm: lengthState.arm, pending: lengthState.pending } : undefined;
  const count = lengthState ? planExperimentRefillCount(lengthState.pending, target) : planRefillCount(backlog, target);
  if (count === 0) return NextResponse.json({ slug, backlog, target, generated: 0, skipped: "backlog_full", lengthExperiment, referenceReplay });

  let result: Awaited<ReturnType<typeof generatePostsForBrand>>;
  try {
    result = await generatePostsForBrand(brand, {
      count,
      insertAtFront: false,
      requestedCampaignId: null,
      approvedCampaignStart: false, // campaign starts stay a human decision
      postCategory: "GROWTH",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation failed";
    return NextResponse.json({ slug, backlog, target, generated: 0, error: message, referenceReplay }, { status: 500 });
  }
  if (!result.ok) return NextResponse.json({ slug, backlog, target, generated: 0, skipped: result.error, referenceReplay });
  return NextResponse.json({ slug, backlog, target, generated: result.summary.count, ...result.summary, lengthExperiment, referenceReplay });
}
