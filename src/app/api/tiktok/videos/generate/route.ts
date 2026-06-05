import { NextRequest, NextResponse } from "next/server";
import { accessErrorResponse, requireBrandForCurrentUser } from "@/lib/brand-access";
import { TikTokVideoDisabledError, generateTikTokVideoDrafts, parseFormatIds } from "@/lib/tiktok-video-service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      brandId?: unknown;
      campaignId?: unknown;
      count?: unknown;
      formatIds?: unknown;
    };
    const brandId = typeof body.brandId === "string" ? body.brandId : null;
    const campaignId = typeof body.campaignId === "string" ? body.campaignId : null;
    const count = typeof body.count === "number" && Number.isFinite(body.count)
      ? Math.min(30, Math.max(1, Math.round(body.count)))
      : 7;
    if (!brandId) {
      return NextResponse.json({ error: "brandId is required" }, { status: 400 });
    }

    const { brand } = await requireBrandForCurrentUser(brandId);
    const result = await generateTikTokVideoDrafts({
      brand,
      campaignId,
      count,
      formatIds: parseFormatIds(body.formatIds),
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const response = accessErrorResponse(error);
    if (response) return response;
    if (error instanceof TikTokVideoDisabledError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("TikTok video generation error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to generate TikTok drafts" }, { status: 500 });
  }
}
