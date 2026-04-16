import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/generate/optimize
 *
 * 지난 30일 성과 데이터를 분석해 공식(formula) 가중치를 자동 조정한다.
 * ai-marketing-skills/growth-engine의 A/B 실험 winner 선정 로직 기반:
 * - 충분한 샘플(공식별 최소 3개)이 있는 공식만 평가
 * - 종합 점수 상위 20% → weight +1 (최대 6)
 * - 종합 점수 하위 20% → weight -1 (최소 1)
 * - 결과는 Settings.formulaWeights에 저장 → generate/route.ts가 다음 배치부터 반영
 *
 * 최소 데이터 요건: 메트릭 수집된 게시물 10개 이상 (조기 최적화 방지)
 */

const DEFAULT_WEIGHTS: Record<string, number> = {
  contrarian: 3,
  choice: 3,
  reveal: 3,
  thisorthat: 2,
  check: 2,
  save: 2,
  humor: 2,
  truth: 2,
};

export async function POST() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const posts = await prisma.post.findMany({
    where: {
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
    },
  });

  if (posts.length < 10) {
    return NextResponse.json(
      {
        message: `데이터 부족 — 최소 10개 필요 (현재 ${posts.length}개). fetch-metrics 실행 후 다시 시도하세요.`,
        count: posts.length,
      },
      { status: 400 }
    );
  }

  // 공식별 종합 점수 계산
  const byFormula: Record<string, number[]> = {};
  for (const post of posts) {
    const fid = post.formulaId!;
    // 종합 점수: 조회수 1x + 좋아요 5x + 댓글 3x + 리포스트 4x
    const score =
      (post.views ?? 0) +
      (post.likes ?? 0) * 5 +
      (post.replies ?? 0) * 3 +
      (post.reposts ?? 0) * 4;
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
    return NextResponse.json(
      { message: "평가 가능한 공식 없음 (공식별 최소 3개 필요)" },
      { status: 400 }
    );
  }

  // 현재 가중치 로드
  const settings = await prisma.settings.findUnique({ where: { id: "default" } });
  const currentWeights: Record<string, number> =
    settings?.formulaWeights && settings.formulaWeights !== "{}"
      ? (JSON.parse(settings.formulaWeights) as Record<string, number>)
      : { ...DEFAULT_WEIGHTS };

  const newWeights = { ...currentWeights };
  const boostCount = Math.max(1, Math.floor(ranked.length * 0.2));

  // 상위 공식 boost
  const boosted: string[] = [];
  for (const { formulaId } of ranked.slice(0, boostCount)) {
    newWeights[formulaId] = Math.min(6, (newWeights[formulaId] ?? 2) + 1);
    boosted.push(formulaId);
  }

  // 하위 공식 reduce
  const reduced: string[] = [];
  for (const { formulaId } of ranked.slice(-boostCount)) {
    // 상위와 겹치면 skip (공식이 2개뿐일 때 등)
    if (!boosted.includes(formulaId)) {
      newWeights[formulaId] = Math.max(1, (newWeights[formulaId] ?? 2) - 1);
      reduced.push(formulaId);
    }
  }

  await prisma.settings.update({
    where: { id: "default" },
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
