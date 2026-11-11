import { NextRequest, NextResponse } from "next/server";
import { accessErrorResponse, requireBrandForCurrentUser } from "@/lib/brand-access";
import { createDraftFromReference } from "@/lib/reference-review";

export const maxDuration = 300; // one draft with quality retries, same as /api/generate

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body: unknown = await request.json().catch(() => null);
    const record = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
    const { brandId, kind } = record;
    if (typeof brandId !== "string" || !brandId) {
      return NextResponse.json({ error: "brandId is required" }, { status: 400 });
    }
    if (kind !== "story" && kind !== "info") {
      return NextResponse.json({ error: "kind must be story or info" }, { status: 400 });
    }

    const { brand } = await requireBrandForCurrentUser(brandId);
    const { id } = await params;
    const result = await createDraftFromReference(brand, id, kind, new Date());
    if (result.status === "rejected") return NextResponse.json({ error: "제외한 레퍼런스라 초안을 만들 수 없어요. 되돌린 뒤 다시 시도해 주세요." }, { status: 409 });
    // Plain error: the brand's setup is missing, not the draft's quality.
    if (result.status === "not_ready") return NextResponse.json({ error: result.error }, { status: 422 });
    return NextResponse.json(result);
  } catch (error) {
    const response = accessErrorResponse(error);
    if (response) return response;
    console.error("Reference draft error:", error);
    return NextResponse.json({ error: "Failed to create reference draft" }, { status: 500 });
  }
}
