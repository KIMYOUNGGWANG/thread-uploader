import { NextRequest, NextResponse } from "next/server";
import { accessErrorResponse, requireBrandForCurrentUser } from "@/lib/brand-access";
import { generatePostsForBrand } from "@/lib/generate-posts";
import { loadLengthExperimentState } from "@/lib/length-experiment";
import { prisma } from "@/lib/prisma";
import { readTrendRadar } from "@/lib/trend-radar/trend-radar-memory";
import { refreshBrandTrendRadar } from "@/lib/trend-radar/trend-radar-service";
import { parseBrandConfig } from "@/types/brand";

// ponytail: trend harvest + chained generation share one request; split the harvest into its own call if this hits 300s.
export const maxDuration = 300;

const TREND_FRESH_MS = 24 * 60 * 60 * 1000;
const DRAFT_CHAIN = 3;

/** Trend radar (parallel harvest) → 3 chained drafts per post → tone-scored pick → NEEDS_REVIEW for manual approval. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { brandId?: unknown; count?: unknown };
    const brandId = typeof body.brandId === "string" ? body.brandId : null;
    const count = typeof body.count === "number" ? body.count : 3;
    if (!brandId) {
      return NextResponse.json({ error: "brandId is required" }, { status: 400 });
    }
    if (!Number.isInteger(count) || count < 1 || count > 5) {
      return NextResponse.json({ error: "count는 1~5 사이여야 합니다" }, { status: 400 });
    }

    let { brand } = await requireBrandForCurrentUser(brandId);
    const now = new Date();

    // Tone-picked, hand-approved posts would skew the pre-registered length experiment's samples.
    if (await loadLengthExperimentState(brand.id, parseBrandConfig(brand.brandConfig), now)) {
      return NextResponse.json({ error: "글 길이 실험이 진행 중이라 이 브랜드는 검토 파이프라인을 쓸 수 없어요" }, { status: 409 });
    }

    const radar = readTrendRadar(brand.brandConfig);
    const harvestedAt = radar ? Date.parse(radar.harvestedAt) : NaN;
    let trend: string;
    if (Number.isFinite(harvestedAt) && now.getTime() - harvestedAt < TREND_FRESH_MS) {
      trend = "fresh";
    } else {
      // A failed harvest only costs the trend context; generation still runs.
      try {
        const run = await refreshBrandTrendRadar(brand);
        trend = run.skipped ?? `refreshed (${run.saved})`;
        // The harvest writes brandConfig; generation reads the trend radar from the brand it is handed.
        if (run.saved > 0) brand = await prisma.brand.findUniqueOrThrow({ where: { id: brand.id } });
      } catch (error) {
        console.warn("[review-pipeline] trend refresh failed, generating without it:", error);
        trend = "refresh failed";
      }
    }

    const result = await generatePostsForBrand(brand, {
      count,
      insertAtFront: true,
      requestedCampaignId: null,
      approvedCampaignStart: false,
      postCategory: "GROWTH",
      initialStatus: "NEEDS_REVIEW",
      draftChain: DRAFT_CHAIN,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error, trend }, { status: 400 });
    }
    return NextResponse.json({ success: true, trend, ...result.summary });
  } catch (error) {
    const response = accessErrorResponse(error);
    if (response) return response;
    const errorMessage = error instanceof Error ? error.message : "검토 파이프라인 실패";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
