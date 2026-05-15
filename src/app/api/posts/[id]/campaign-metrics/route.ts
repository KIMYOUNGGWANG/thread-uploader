import { NextRequest, NextResponse } from "next/server";
import { accessErrorResponse, requirePostForCurrentUser } from "@/lib/brand-access";
import { calculatePerformanceScore, getPerformanceTier } from "@/lib/growth-learning";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function optionalMetric(input: unknown): number | undefined {
  if (typeof input !== "number" || !Number.isFinite(input) || input < 0) return undefined;
  return Math.round(input);
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { post } = await requirePostForCurrentUser(id);
    const body = await request.json() as {
      clicks?: unknown;
      conversions?: unknown;
      manualPaidConversions?: unknown;
    };

    const nextMetrics = {
      views: post.views,
      likes: post.likes,
      replies: post.replies,
      reposts: post.reposts,
      clicks: optionalMetric(body.clicks) ?? post.clicks,
      conversions: optionalMetric(body.conversions) ?? post.conversions,
      manualPaidConversions: optionalMetric(body.manualPaidConversions) ?? post.manualPaidConversions,
    };
    const performanceScore = calculatePerformanceScore(nextMetrics);

    const updatedPost = await prisma.post.update({
      where: { id },
      data: {
        ...(body.clicks !== undefined && { clicks: nextMetrics.clicks }),
        ...(body.conversions !== undefined && { conversions: nextMetrics.conversions }),
        ...(body.manualPaidConversions !== undefined && {
          manualPaidConversions: nextMetrics.manualPaidConversions,
        }),
        performanceScore,
        performanceTier: getPerformanceTier(performanceScore),
        metricsAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      post: {
        id: updatedPost.id,
        clicks: updatedPost.clicks ?? 0,
        conversions: updatedPost.conversions ?? 0,
        manualPaidConversions: updatedPost.manualPaidConversions ?? 0,
        performanceScore: updatedPost.performanceScore,
        performanceTier: updatedPost.performanceTier,
      },
    });
  } catch (error) {
    const response = accessErrorResponse(error);
    if (response) return response;
    console.error("Error updating campaign metrics:", error);
    return NextResponse.json({ error: "Failed to update campaign metrics" }, { status: 500 });
  }
}
