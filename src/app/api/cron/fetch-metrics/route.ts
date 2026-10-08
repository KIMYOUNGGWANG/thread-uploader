import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculatePerformanceScore, getPerformanceTier } from "@/lib/growth-learning";
import { verifyCronSecret } from "@/lib/cron-auth";
import { getFreshBrandCredentials } from "@/lib/threads-api";
import type { ThreadsCredentials } from "@/lib/threads-api";
import { selectMetricsCandidates } from "@/lib/metrics-selection";

export const maxDuration = 60;

const THREADS_API_BASE = "https://graph.threads.net/v1.0";
const SIX_HOURS = 6 * 60 * 60 * 1000;
const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000;
// ponytail: fixed batch keeps one call under maxDuration; raise or page when posting volume grows
const BATCH_SIZE = 40;
const REQUEST_DELAY_MS = 300;

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
  const eligible = await prisma.post.findMany({
    where: {
      status: "PUBLISHED",
      threadsId: { not: null },
      publishedAt: { gte: new Date(now - FOURTEEN_DAYS), lte: new Date(now - SIX_HOURS) },
    },
  });
  const posts = selectMetricsCandidates(eligible, { now, minAgeMs: SIX_HOURS, maxAgeMs: FOURTEEN_DAYS, limit: BATCH_SIZE });

  const credentialsByBrand = new Map<string, ThreadsCredentials>();
  let updated = 0;
  const errors: { id: string; error: string }[] = [];

  for (const post of posts) {
    if (!post.threadsId) continue;
    try {
      let credentials = credentialsByBrand.get(post.brandId);
      if (!credentials) {
        credentials = await getFreshBrandCredentials(post.brandId);
        credentialsByBrand.set(post.brandId, credentials);
      }

      const insights = await fetchInsights(post.threadsId, credentials.accessToken);
      // Keep click/conversion counters in the score — insights alone would erase attribution weight
      const score = calculatePerformanceScore({ ...post, ...insights });

      await prisma.post.update({
        where: { id: post.id },
        data: {
          ...insights,
          metricsAt: new Date(),
          performanceScore: score,
          performanceTier: getPerformanceTier(score),
        },
      });
      updated++;
    } catch (err) {
      errors.push({ id: post.id, error: err instanceof Error ? err.message : "Unknown error" });
    }
    await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
  }

  return NextResponse.json({
    success: true,
    totalEligible: eligible.length,
    selected: posts.length,
    updated,
    errors,
  });
}
