import { NextRequest, NextResponse } from "next/server";
import { accessErrorResponse, requireBrandForCurrentUser } from "@/lib/brand-access";
import { learnBrandGrowth } from "@/lib/growth-service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { brandId?: unknown };
    const brandId = typeof body.brandId === "string" ? body.brandId : null;
    if (!brandId) {
      return NextResponse.json({ error: "brandId is required" }, { status: 400 });
    }

    await requireBrandForCurrentUser(brandId);
    const result = await learnBrandGrowth(brandId);
    return NextResponse.json(result);
  } catch (error) {
    const response = accessErrorResponse(error);
    if (response) return response;
    console.error("Growth learn error:", error);
    return NextResponse.json({ error: "Failed to learn growth patterns" }, { status: 500 });
  }
}
