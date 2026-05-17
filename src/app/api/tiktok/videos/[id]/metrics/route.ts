import { NextRequest, NextResponse } from "next/server";
import { accessErrorResponse, requireTikTokDraftForCurrentUser } from "@/lib/brand-access";
import { optionalMetric, updateTikTokVideoMetrics } from "@/lib/tiktok-video-service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    await requireTikTokDraftForCurrentUser(id);
    const body = await request.json() as {
      views?: unknown;
      likes?: unknown;
      comments?: unknown;
      shares?: unknown;
      saves?: unknown;
      profileClicks?: unknown;
      landingClicks?: unknown;
      conversions?: unknown;
      measuredAt?: unknown;
    };
    const metric = await updateTikTokVideoMetrics(id, {
      views: optionalMetric(body.views) ?? 0,
      likes: optionalMetric(body.likes) ?? 0,
      comments: optionalMetric(body.comments) ?? 0,
      shares: optionalMetric(body.shares) ?? 0,
      saves: optionalMetric(body.saves) ?? 0,
      profileClicks: optionalMetric(body.profileClicks) ?? 0,
      landingClicks: optionalMetric(body.landingClicks) ?? 0,
      conversions: optionalMetric(body.conversions) ?? 0,
      ...(typeof body.measuredAt === "string" && { measuredAt: body.measuredAt }),
    });
    return NextResponse.json({ success: true, metric });
  } catch (error) {
    const response = accessErrorResponse(error);
    if (response) return response;
    console.error("TikTok metric update error:", error);
    return NextResponse.json({ error: "Failed to update TikTok metrics" }, { status: 500 });
  }
}
