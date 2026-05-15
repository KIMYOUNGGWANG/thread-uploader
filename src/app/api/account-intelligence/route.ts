import { NextRequest, NextResponse } from "next/server";
import { accessErrorResponse, requireBrandForCurrentUser } from "@/lib/brand-access";
import { getAccountIntelligenceReport } from "@/lib/account-intelligence";

export async function GET(request: NextRequest) {
  try {
    const brandId = request.nextUrl.searchParams.get("brandId");
    if (!brandId) {
      return NextResponse.json({ error: "brandId is required" }, { status: 400 });
    }

    await requireBrandForCurrentUser(brandId);
    return NextResponse.json({
      brandId,
      ...await getAccountIntelligenceReport(brandId),
    });
  } catch (error) {
    const response = accessErrorResponse(error);
    if (response) return response;
    console.error("Account intelligence report error:", error);
    return NextResponse.json({ error: "Failed to load account intelligence" }, { status: 500 });
  }
}
