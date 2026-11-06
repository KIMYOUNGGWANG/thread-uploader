import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCronSecret } from "@/lib/cron-auth";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DAYS = 60;

// Read-only report of recently published posts and their stored Threads metrics (views come from fetch-metrics).
// The repo is public, so the "Post Metrics Report" workflow encrypts this output before it reaches the run log.
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const slug = request.nextUrl.searchParams.get("brand")?.trim();
  if (!slug) return NextResponse.json({ error: "brand is required" }, { status: 400 });
  const days = Math.min(MAX_DAYS, Math.max(1, Number(request.nextUrl.searchParams.get("days")) || 14));
  // full=1 adds each post's whole text and the drafts waiting to publish, for reading what actually went out.
  const full = request.nextUrl.searchParams.get("full") === "1";

  const brand = await prisma.brand.findUnique({ where: { slug }, select: { id: true } });
  if (!brand) return NextResponse.json({ error: `Brand not found: ${slug}` }, { status: 404 });

  const posts = await prisma.post.findMany({
    where: { brandId: brand.id, status: "PUBLISHED", publishedAt: { gte: new Date(Date.now() - days * DAY_MS) } },
    orderBy: { publishedAt: "desc" },
    select: {
      id: true, publishedAt: true, formulaId: true, postCategory: true, content: true,
      views: true, likes: true, replies: true, reposts: true, clicks: true, linkUrl: true, metricsAt: true,
      topic: true, hookType: true, ctaType: true, imageUrls: true, threadTotalParts: true, firstComment: true,
    },
  });
  // Follower count per daily account-intelligence snapshot, to see whether the audience itself grows or shrinks.
  const insights = await prisma.accountInsight.findMany({
    where: { brandId: brand.id, generatedAt: { gte: new Date(Date.now() - days * DAY_MS) } },
    orderBy: { generatedAt: "asc" },
    select: { generatedAt: true, metrics: true },
  });
  const followers = insights.map((insight) => {
    let count: number | null = null;
    try {
      const parsed: unknown = JSON.parse(insight.metrics);
      const value = typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>).followersCount : null;
      count = typeof value === "number" ? value : null;
    } catch {
      count = null;
    }
    return { at: insight.generatedAt, followers: count };
  });
  const imageCount = (raw: string) => {
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  };
  const queue = full
    ? await prisma.post.findMany({
        where: { brandId: brand.id, status: { in: ["PENDING", "NEEDS_REVIEW"] } },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: { id: true, status: true, createdAt: true, formulaId: true, content: true, firstComment: true, qualityReasons: true },
      })
    : undefined;
  return NextResponse.json({
    brand: slug,
    days,
    count: posts.length,
    followers,
    ...(queue ? { queue } : {}),
    posts: posts.map((post) => ({
      id: post.id,
      publishedAt: post.publishedAt,
      formulaId: post.formulaId,
      category: post.postCategory,
      views: post.views,
      likes: post.likes,
      replies: post.replies,
      reposts: post.reposts,
      clicks: post.clicks,
      linked: Boolean(post.linkUrl),
      metricsAt: post.metricsAt,
      opening: post.content.split("\n").find((line) => line.trim())?.slice(0, 60) ?? "",
      length: post.content.length,
      lines: post.content.split("\n").filter((line) => line.trim()).length,
      endsWithQuestion: /[?？]\s*$/.test(post.content.trim()),
      numberedLines: post.content.split("\n").filter((line) => /^\s*\d+[.)]/.test(line)).length,
      images: imageCount(post.imageUrls),
      parts: post.threadTotalParts,
      topic: post.topic,
      hookType: post.hookType,
      ctaType: post.ctaType,
      firstComment: post.firstComment?.split("\n").find((line) => line.trim())?.slice(0, 60) ?? null,
      ...(full ? { content: post.content, firstCommentFull: post.firstComment } : {}),
    })),
  });
}
