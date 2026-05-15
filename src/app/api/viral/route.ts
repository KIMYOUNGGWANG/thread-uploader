import { NextRequest, NextResponse } from "next/server";
import { accessErrorResponse, requireBrandForCurrentUser } from "@/lib/brand-access";
import { getViralReport } from "@/lib/viral-service";

export async function GET(request: NextRequest) {
  try {
    const brandId = request.nextUrl.searchParams.get("brandId");
    if (!brandId) {
      return NextResponse.json({ error: "brandId is required" }, { status: 400 });
    }

    await requireBrandForCurrentUser(brandId);
    return NextResponse.json(await getViralReport(brandId));
  } catch (error) {
    const response = accessErrorResponse(error);
    if (response) return response;
    console.error("Viral report error:", error);
    return NextResponse.json({ error: "Failed to load viral report" }, { status: 500 });
  }
}
