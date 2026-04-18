import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const brandId = request.nextUrl.searchParams.get("brandId");
  if (!brandId) {
    return NextResponse.json({ error: "brandId is required" }, { status: 400 });
  }

  const posts = await prisma.post.findMany({
    where: { brandId, status: "PUBLISHED", formulaId: { not: null }, views: { not: null } },
    select: { formulaId: true, views: true, likes: true, replies: true, reposts: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  if (posts.length === 0) {
    return NextResponse.json({
      brandId,
      total: 0,
      evaluated: 0,
      message: "아직 성과 데이터가 없습니다. fetch-metrics 실행 후 다시 확인하세요.",
      byFormula: [],
      topFormula: null,
      bottomFormula: null,
      collectedAt: new Date().toISOString(),
    });
  }

  const byFormula: Record<string, { views: number[]; likes: number[]; replies: number[]; reposts: number[] }> = {};
  for (const post of posts) {
    const fid = post.formulaId!;
    if (!byFormula[fid]) byFormula[fid] = { views: [], likes: [], replies: [], reposts: [] };
    byFormula[fid].views.push(post.views ?? 0);
    byFormula[fid].likes.push(post.likes ?? 0);
    byFormula[fid].replies.push(post.replies ?? 0);
    byFormula[fid].reposts.push(post.reposts ?? 0);
  }

  const avg = (arr: number[]) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0);

  const summary = Object.entries(byFormula)
    .filter(([, data]) => data.views.length >= 3)
    .map(([formulaId, data]) => {
      const avgViews = avg(data.views);
      const avgLikes = avg(data.likes);
      const avgReplies = avg(data.replies);
      const avgReposts = avg(data.reposts);
      const engagementScore = avgViews + avgLikes * 5 + avgReplies * 3 + avgReposts * 4;
      return {
        formulaId,
        count: data.views.length,
        avgViews, avgLikes, avgReplies, avgReposts,
        totalViews: data.views.reduce((a, b) => a + b, 0),
        engagementScore,
      };
    })
    .sort((a, b) => b.engagementScore - a.engagementScore);

  return NextResponse.json({
    brandId,
    total: posts.length,
    evaluated: summary.length,
    byFormula: summary,
    topFormula: summary[0] ?? null,
    bottomFormula: summary[summary.length - 1] ?? null,
    collectedAt: new Date().toISOString(),
  });
}
