import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseBrandConfig } from "@/types/brand";
import { accessErrorResponse, requireBrandForCurrentUser } from "@/lib/brand-access";
import { calculatePerformanceScore } from "@/lib/growth-learning";

export async function POST(request: NextRequest) {
  const body = await request.json() as { brandId?: unknown };
  const brandId = typeof body.brandId === "string" ? body.brandId : null;

  if (!brandId) {
    return NextResponse.json({ error: "brandId is required" }, { status: 400 });
  }

  let brand;
  try {
    ({ brand } = await requireBrandForCurrentUser(brandId));
  } catch (error) {
    const response = accessErrorResponse(error);
    if (response) return response;
    throw error;
  }

  const config = parseBrandConfig(brand.brandConfig);
  const defaultWeights = Object.fromEntries(
    config.formulas.map((f) => [f.id, f.weight])
  );

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const posts = await prisma.post.findMany({
    where: {
      brandId,
      status: "PUBLISHED",
      formulaId: { not: null },
      views: { not: null },
      metricsAt: { not: null },
      createdAt: { gte: thirtyDaysAgo },
    },
    select: {
      formulaId: true,
      views: true,
      likes: true,
      replies: true,
      reposts: true,
      clicks: true,
      conversions: true,
      manualPaidConversions: true,
    },
  });

  if (posts.length < 10) {
    return NextResponse.json(
      { message: `데이터 부족 — 최소 10개 필요 (현재 ${posts.length}개).`, count: posts.length },
      { status: 400 }
    );
  }

  const byFormula: Record<string, number[]> = {};
  for (const post of posts) {
    const fid = post.formulaId!;
    const score = calculatePerformanceScore(post);
    if (!byFormula[fid]) byFormula[fid] = [];
    byFormula[fid].push(score);
  }

  const ranked = Object.entries(byFormula)
    .filter(([, scores]) => scores.length >= 3)
    .map(([formulaId, scores]) => ({
      formulaId,
      count: scores.length,
      avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    }))
    .sort((a, b) => b.avgScore - a.avgScore);

  if (ranked.length === 0) {
    return NextResponse.json({ message: "평가 가능한 공식 없음 (공식별 최소 3개 필요)" }, { status: 400 });
  }

  const currentWeights = brand.formulaWeights !== "{}"
    ? (JSON.parse(brand.formulaWeights) as Record<string, number>)
    : { ...defaultWeights };

  const newWeights = { ...currentWeights };
  const boostCount = Math.max(1, Math.floor(ranked.length * 0.2));

  const boosted: string[] = [];
  for (const { formulaId } of ranked.slice(0, boostCount)) {
    newWeights[formulaId] = Math.min(6, (newWeights[formulaId] ?? 2) + 1);
    boosted.push(formulaId);
  }

  const reduced: string[] = [];
  for (const { formulaId } of ranked.slice(-boostCount)) {
    if (!boosted.includes(formulaId)) {
      newWeights[formulaId] = Math.max(1, (newWeights[formulaId] ?? 2) - 1);
      reduced.push(formulaId);
    }
  }

  await prisma.brand.update({
    where: { id: brandId },
    data: { formulaWeights: JSON.stringify(newWeights) },
  });

  return NextResponse.json({
    success: true,
    analysedPosts: posts.length,
    evaluatedFormulas: ranked.length,
    ranking: ranked,
    changes: { boosted, reduced },
    newWeights,
    appliedAt: new Date().toISOString(),
  });
}
