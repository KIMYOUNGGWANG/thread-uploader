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

  const brand = await prisma.brand.findUnique({ where: { slug }, select: { id: true } });
  if (!brand) return NextResponse.json({ error: `Brand not found: ${slug}` }, { status: 404 });

  const posts = await prisma.post.findMany({
    where: { brandId: brand.id, status: "PUBLISHED", publishedAt: { gte: new Date(Date.now() - days * DAY_MS) } },
    orderBy: { publishedAt: "desc" },
    select: {
      id: true, publishedAt: true, formulaId: true, postCategory: true, content: true,
      views: true, likes: true, replies: true, reposts: true, clicks: true, linkUrl: true, metricsAt: true,
    },
  });
  return NextResponse.json({
    brand: slug,
    days,
    count: posts.length,
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
    })),
  });
}
