import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCronSecret } from "@/lib/cron-auth";
import { generateTikTokScript } from "@/lib/tiktok/tiktok-script-engine";
import { buildTikTokRenderSpec } from "@/lib/tiktok/tiktok-render-worker";
import { buildTikTokDraftCreateData, draftToScriptResult, pickDailyDayMaster } from "@/lib/tiktok/tiktok-draft-service";

const STALE_RENDER_MS = 30 * 60 * 1000;

/**
 * GET /api/cron/video-jobs/next?brands=slug
 * Hands the CI renderer one draft to render: the oldest QUEUED draft, or a freshly generated
 * daily draft when the brand has none today. The draft is claimed as RENDERING atomically.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const slugs = request.nextUrl.searchParams.get("brands")?.split(",").map((slug) => slug.trim()).filter(Boolean);
  if (!slugs?.length) {
    return NextResponse.json({ error: "brands query is required" }, { status: 400 });
  }

  // A renderer that died mid-job leaves RENDERING behind; hand those back out
  await prisma.tikTokVideoDraft.updateMany({
    where: { status: "RENDERING", updatedAt: { lt: new Date(Date.now() - STALE_RENDER_MS) } },
    data: { status: "QUEUED" },
  });

  const brands = await prisma.brand.findMany({ where: { slug: { in: slugs } }, select: { id: true, slug: true } });
  for (const brand of brands) {
    const draft = await claimQueuedDraft(brand.id) ?? await createDailyDraft(brand.id);
    if (!draft) continue;
    return NextResponse.json({
      job: { draftId: draft.id, brandSlug: brand.slug, renderSpec: buildTikTokRenderSpec(draftToScriptResult(draft)) },
    });
  }

  return NextResponse.json({ job: null });
}

async function claimQueuedDraft(brandId: string) {
  const queued = await prisma.tikTokVideoDraft.findFirst({
    where: { brandId, status: "QUEUED" },
    orderBy: { createdAt: "asc" },
  });
  if (!queued) return null;
  const claimed = await prisma.tikTokVideoDraft.updateMany({
    where: { id: queued.id, status: "QUEUED" },
    data: { status: "RENDERING" },
  });
  return claimed.count === 1 ? queued : null;
}

async function createDailyDraft(brandId: string) {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const todays = await prisma.tikTokVideoDraft.count({
    where: { brandId, campaignId: "saju_tiktok_campaign", createdAt: { gte: startOfDay } },
  });
  if (todays > 0) return null;

  const script = generateTikTokScript({ topic: "사주 대운 분석", dayMaster: pickDailyDayMaster(new Date()), tone: "mysterious" });
  return prisma.tikTokVideoDraft.create({ data: buildTikTokDraftCreateData(brandId, script, "RENDERING") });
}
