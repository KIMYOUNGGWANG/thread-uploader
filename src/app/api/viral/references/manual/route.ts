import { NextRequest, NextResponse } from "next/server";
import { accessErrorResponse, requireBrandForCurrentUser } from "@/lib/brand-access";
import { createManualReferenceDraft, parseManualReferenceInput } from "@/lib/manual-reference";

export const maxDuration = 300; // one draft with quality retries, same as /api/generate

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json().catch(() => null);
    const brandId = typeof body === "object" && body !== null ? (body as Record<string, unknown>).brandId : undefined;
    if (typeof brandId !== "string" || !brandId) {
      return NextResponse.json({ error: "brandId is required" }, { status: 400 });
    }

    const parsed = parseManualReferenceInput(body);
    if (!parsed.ok) return NextResponse.json({ errors: parsed.errors }, { status: 400 });

    const { brand } = await requireBrandForCurrentUser(brandId);
    const result = await createManualReferenceDraft(brand, parsed.value, new Date());
    // Surfaced as a plain error: the brand's setup is missing, not the draft's quality.
    if (result.status === "not_ready") return NextResponse.json({ error: result.error }, { status: 422 });
    return NextResponse.json(result);
  } catch (error) {
    const response = accessErrorResponse(error);
    if (response) return response;
    console.error("Manual reference error:", error);
    return NextResponse.json({ error: "Failed to create reference draft" }, { status: 500 });
  }
}
