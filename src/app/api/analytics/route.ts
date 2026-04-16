import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/analytics
 *
 * 공식(formulaId)별 성과 요약을 반환한다.
 * ai-marketing-skills/growth-engine의 실험 분석 패턴 적용:
 * - 최소 3개 이상의 데이터가 있는 공식만 평가
 * - 평균 조회수, 좋아요, 종합 점수 기준으로 정렬
 * - 상위/하위 공식 명시
 */
export async function GET() {
  const posts = await prisma.post.findMany({
    where: {
      status: "PUBLISHED",
      formulaId: { not: null },
      views: { not: null },
    },
    select: {
      formulaId: true,
      views: true,
      likes: true,
      replies: true,
      reposts: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  if (posts.length === 0) {
    return NextResponse.json({
      total: 0,
      message: "아직 성과 데이터가 없습니다. fetch-metrics 실행 후 다시 확인하세요.",
      byFormula: [],
      topFormula: null,
      bottomFormula: null,
    });
  }

  // 공식별 집계
  const byFormula: Record<
    string,
    { views: number[]; likes: number[]; replies: number[]; reposts: number[] }
  > = {};

  for (const post of posts) {
    const fid = post.formulaId!;
    if (!byFormula[fid]) {
      byFormula[fid] = { views: [], likes: [], replies: [], reposts: [] };
    }
    byFormula[fid].views.push(post.views ?? 0);
    byFormula[fid].likes.push(post.likes ?? 0);
    byFormula[fid].replies.push(post.replies ?? 0);
    byFormula[fid].reposts.push(post.reposts ?? 0);
  }

  const avg = (arr: number[]) =>
    arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

  const summary = Object.entries(byFormula)
    .filter(([, data]) => data.views.length >= 3) // 최소 3개 이상만 평가
    .map(([formulaId, data]) => {
      const avgViews = avg(data.views);
      const avgLikes = avg(data.likes);
      const avgReplies = avg(data.replies);
      const avgReposts = avg(data.reposts);
      // 종합 점수: 조회수 1x + 좋아요 5x + 댓글 3x + 리포스트 4x
      const engagementScore = avgViews + avgLikes * 5 + avgReplies * 3 + avgReposts * 4;

      return {
        formulaId,
        count: data.views.length,
        avgViews,
        avgLikes,
        avgReplies,
        avgReposts,
        totalViews: data.views.reduce((a, b) => a + b, 0),
        engagementScore,
      };
    })
    .sort((a, b) => b.engagementScore - a.engagementScore);

  return NextResponse.json({
    total: posts.length,
    evaluated: summary.length,
    byFormula: summary,
    topFormula: summary[0] ?? null,
    bottomFormula: summary[summary.length - 1] ?? null,
    collectedAt: new Date().toISOString(),
  });
}
