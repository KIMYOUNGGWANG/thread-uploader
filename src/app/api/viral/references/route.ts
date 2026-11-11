import { NextRequest, NextResponse } from "next/server";
import { accessErrorResponse, requireBrandForCurrentUser } from "@/lib/brand-access";
import { listReferencesForReview } from "@/lib/reference-review";

export async function GET(request: NextRequest) {
  try {
    const brandId = request.nextUrl.searchParams.get("brandId");
    if (!brandId) {
      return NextResponse.json({ error: "brandId is required" }, { status: 400 });
    }

    await requireBrandForCurrentUser(brandId);
    return NextResponse.json({ references: await listReferencesForReview(brandId) });
  } catch (error) {
    const response = accessErrorResponse(error);
    if (response) return response;
    console.error("Reference review list error:", error);
    return NextResponse.json({ error: "Failed to load references" }, { status: 500 });
  }
}
