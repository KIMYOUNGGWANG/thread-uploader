import { NextRequest, NextResponse } from "next/server";
import { accessErrorResponse, requireBrandForCurrentUser } from "@/lib/brand-access";
import { setReferenceDecision } from "@/lib/reference-review";
import type { ReferenceDecision } from "@/lib/viral-analysis";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body: unknown = await request.json().catch(() => null);
    const record = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
    const { brandId, decision } = record;
    if (typeof brandId !== "string" || !brandId) {
      return NextResponse.json({ error: "brandId is required" }, { status: 400 });
    }
    // null clears the choice (되돌리기).
    if (decision !== null && decision !== "approved" && decision !== "rejected") {
      return NextResponse.json({ error: "decision must be approved, rejected or null" }, { status: 400 });
    }

    await requireBrandForCurrentUser(brandId);
    const { id } = await params;
    await setReferenceDecision(brandId, id, decision as ReferenceDecision | null);
    return NextResponse.json({ success: true, decision });
  } catch (error) {
    const response = accessErrorResponse(error);
    if (response) return response;
    console.error("Reference decision error:", error);
    return NextResponse.json({ error: "Failed to save decision" }, { status: 500 });
  }
}
