import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculatePerformanceScore, getPerformanceTier } from "@/lib/growth-learning";

const THREADS_API_BASE = "https://graph.threads.net/v1.0";
const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000;

function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${cronSecret}`) return true;
  return request.nextUrl.searchParams.get("secret") === cronSecret;
}

async function fetchInsights(threadsId: string, accessToken: string) {
  const params = new URLSearchParams({
    metric: "views,likes,replies,reposts,quotes",
    access_token: accessToken,
  });

  const response = await fetch(`${THREADS_API_BASE}/${threadsId}/insights?${params}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Insights API error (${response.status}): ${data.error?.message ?? "Unknown"}`);
  }

  const metrics: Record<string, number> = {};
  for (const item of data.data ?? []) {
    metrics[item.name] = item.values?.[0]?.value ?? 0;
  }

  return {
    views: metrics.views ?? 0,
    likes: metrics.likes ?? 0,
    replies: metrics.replies ?? 0,
    reposts: metrics.reposts ?? 0,
  };
}

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const posts = await prisma.post.findMany({
    where: {
      status: "PUBLISHED",
      threadsId: { not: null },
      publishedAt: {
        gte: new Date(now - FOURTEEN_DAYS),
      },
    },
    include: { brand: true },
    orderBy: { metricsAt: "asc" },
    take: 30,
  });

  let updated = 0;
  const errors = [];

  for (const post of posts) {
    if (!post.threadsId || !post.brand?.accessToken) continue;
    try {
      const insights = await fetchInsights(post.threadsId, post.brand.accessToken);
      const score = calculatePerformanceScore(insights);

      await prisma.post.update({
        where: { id: post.id },
        data: {
          views: insights.views,
          likes: insights.likes,
          replies: insights.replies,
          reposts: insights.reposts,
          metricsAt: new Date(),
          performanceScore: score,
          performanceTier: getPerformanceTier(score),
        },
      });
      updated++;
    } catch (err) {
      errors.push({ id: post.id, error: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  return NextResponse.json({
    success: true,
    totalEligible: posts.length,
    updated,
    errors,
  });
}
