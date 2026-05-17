import { NextRequest, NextResponse } from "next/server";
import { accessErrorResponse, requireBrandForCurrentUser } from "@/lib/brand-access";
import { getTikTokSummary } from "@/lib/tiktok-video-service";

export async function GET(request: NextRequest) {
  try {
    const brandId = request.nextUrl.searchParams.get("brandId");
    const campaignId = request.nextUrl.searchParams.get("campaignId");
    if (!brandId) {
      return NextResponse.json({ error: "brandId is required" }, { status: 400 });
    }

    const { brand } = await requireBrandForCurrentUser(brandId);
    return NextResponse.json(await getTikTokSummary(brand, campaignId));
  } catch (error) {
    const response = accessErrorResponse(error);
    if (response) return response;
    console.error("TikTok summary load error:", error);
    return NextResponse.json({ error: "Failed to load TikTok summary" }, { status: 500 });
  }
}
