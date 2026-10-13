import { NextRequest, NextResponse } from "next/server";
import { accessErrorResponse, requireBrandForCurrentUser } from "@/lib/brand-access";
import { generatePostsForBrand } from "@/lib/generate-posts";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      brandId?: unknown;
      count?: unknown;
      insertAtFront?: unknown;
      campaignId?: unknown;
      approvedCampaignStart?: unknown;
      category?: unknown;
    };
    const brandId = typeof body.brandId === "string" ? body.brandId : null;
    const count = typeof body.count === "number" ? body.count : 30;
    const insertAtFront = body.insertAtFront === true;
    const requestedCampaignId = typeof body.campaignId === "string" ? body.campaignId : null;
    const approvedCampaignStart = body.approvedCampaignStart === true;
    const postCategory = typeof body.category === "string" ? body.category : "GROWTH";

    if (!brandId) {
      return NextResponse.json({ error: "brandId is required" }, { status: 400 });
    }
    if (count < 1 || count > 300) {
      return NextResponse.json({ error: "count는 1~300 사이여야 합니다" }, { status: 400 });
    }

    const { brand } = await requireBrandForCurrentUser(brandId);

    const result = await generatePostsForBrand(brand, {
      count,
      insertAtFront,
      requestedCampaignId,
      approvedCampaignStart,
      postCategory,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, ...result.summary });
  } catch (error) {
    const response = accessErrorResponse(error);
    if (response) return response;
    const errorMessage = error instanceof Error ? error.message : "생성 실패";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
