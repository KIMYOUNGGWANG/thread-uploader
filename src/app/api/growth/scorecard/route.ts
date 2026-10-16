import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accessErrorResponse, requireBrandForCurrentUser } from "@/lib/brand-access";
import { buildWeeklyScorecard } from "@/lib/weekly-scorecard";

const DEFAULT_WEEKS = 4;
const MAX_WEEKS = 12;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function parseWeeks(raw: string | null): number {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) return DEFAULT_WEEKS;
  return Math.min(MAX_WEEKS, Math.max(1, parsed));
}

export async function GET(request: NextRequest) {
  try {
    const brandId = request.nextUrl.searchParams.get("brandId");
    if (!brandId) {
      return NextResponse.json({ error: "brandId is required" }, { status: 400 });
    }
    await requireBrandForCurrentUser(brandId);

    const weeks = parseWeeks(request.nextUrl.searchParams.get("weeks"));
    const now = new Date();
    const [posts, reviewQueue, pendingQueue] = await Promise.all([
      prisma.post.findMany({
        where: { brandId, status: "PUBLISHED", publishedAt: { gte: new Date(now.getTime() - weeks * WEEK_MS) } },
        select: {
          publishedAt: true,
          metricsAt: true,
          status: true,
          views: true,
          replies: true,
          reposts: true,
          clicks: true,
          conversions: true,
          manualPaidConversions: true,
          formulaId: true,
          linkUrl: true,
        },
      }),
      prisma.post.count({ where: { brandId, status: "NEEDS_REVIEW" } }),
      prisma.post.count({ where: { brandId, status: "PENDING" } }),
    ]);

    return NextResponse.json({
      brandId,
      ...buildWeeklyScorecard(posts, { now, weeks, reviewQueue, pendingQueue }),
      queue: { review: reviewQueue, pending: pendingQueue },
    });
  } catch (error) {
    const response = accessErrorResponse(error);
    if (response) return response;
    console.error("Scorecard error:", error);
    return NextResponse.json({ error: "Failed to load scorecard" }, { status: 500 });
  }
}
