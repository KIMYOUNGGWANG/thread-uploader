import { NextRequest, NextResponse } from "next/server";
import { accessErrorResponse, requireBrandForCurrentUser } from "@/lib/brand-access";
import { getTikTokVideoDrafts, parseDraftStatus } from "@/lib/tiktok-video-service";

export async function GET(request: NextRequest) {
  try {
    const brandId = request.nextUrl.searchParams.get("brandId");
    const status = parseDraftStatus(request.nextUrl.searchParams.get("status"));
    if (!brandId) {
      return NextResponse.json({ error: "brandId is required" }, { status: 400 });
    }

    await requireBrandForCurrentUser(brandId);
    return NextResponse.json(await getTikTokVideoDrafts(brandId, status));
  } catch (error) {
    const response = accessErrorResponse(error);
    if (response) return response;
    console.error("TikTok videos load error:", error);
    return NextResponse.json({ error: "Failed to load TikTok drafts" }, { status: 500 });
  }
}
