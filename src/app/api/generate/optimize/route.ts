import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accessErrorResponse, requireBrandForCurrentUser } from "@/lib/brand-access";
import { runGrowthFeedbackLoop } from "@/lib/growth-service";

export async function POST(request: NextRequest) {
  const body = await request.json() as { brandId?: unknown };
  const brandId = typeof body.brandId === "string" ? body.brandId : null;

  if (!brandId) {
    return NextResponse.json({ error: "brandId is required" }, { status: 400 });
  }

  try {
    await requireBrandForCurrentUser(brandId);
  } catch (error) {
    const response = accessErrorResponse(error);
    if (response) return response;
    throw error;
  }

  // Minimum post threshold for statistical validity
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const eligiblePostsCount = await prisma.post.count({
    where: {
      brandId,
      status: "PUBLISHED",
      formulaId: { not: null },
      views: { not: null },
      metricsAt: { not: null },
      createdAt: { gte: thirtyDaysAgo },
    },
  });

  if (eligiblePostsCount < 10) {
    return NextResponse.json(
      { message: `데이터 부족 — 최소 10개 필요 (현재 ${eligiblePostsCount}개).`, count: eligiblePostsCount },
      { status: 400 }
    );
  }

  // Canonical Growth Feedback Loop (Single Writer Authority)
  const growthResult = await runGrowthFeedbackLoop(brandId);

  return NextResponse.json({
    success: true,
    analysedPosts: growthResult.learnedPosts,
    evaluatedFormulas: growthResult.promotedFormulas.length + growthResult.demotedFormulas.length,
    ranking: (growthResult as { formulaRanking?: unknown }).formulaRanking ?? growthResult.topPatterns,
    changes: {
      boosted: growthResult.promotedFormulas,
      reduced: growthResult.demotedFormulas,
    },
    newWeights: growthResult.updatedWeights ?? {},
    appliedAt: new Date().toISOString(),
  });
}
