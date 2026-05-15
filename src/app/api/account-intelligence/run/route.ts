import { NextRequest, NextResponse } from "next/server";
import { accessErrorResponse, requireBrandForCurrentUser } from "@/lib/brand-access";
import { runAccountIntelligence } from "@/lib/account-intelligence";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      brandId?: unknown;
      fetchMetrics?: unknown;
      windowHours?: unknown;
    };
    const brandId = typeof body.brandId === "string" ? body.brandId : null;
    if (!brandId) {
      return NextResponse.json({ error: "brandId is required" }, { status: 400 });
    }

    await requireBrandForCurrentUser(brandId);
    const insight = await runAccountIntelligence(brandId, {
      fetchMetrics: body.fetchMetrics !== false,
      windowHours: typeof body.windowHours === "number" ? body.windowHours : undefined,
      source: "manual",
    });

    return NextResponse.json({ success: true, insight });
  } catch (error) {
    const response = accessErrorResponse(error);
    if (response) return response;
    console.error("Account intelligence run error:", error);
    return NextResponse.json({ error: "Failed to run account intelligence" }, { status: 500 });
  }
}
