import { NextRequest, NextResponse } from "next/server";
import { accessErrorResponse, requireBrandForCurrentUser } from "@/lib/brand-access";
import { createManualReferenceDraft, parseManualReferenceInput } from "@/lib/manual-reference";

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
    return NextResponse.json(await createManualReferenceDraft(brand, parsed.value, new Date()));
  } catch (error) {
    const response = accessErrorResponse(error);
    if (response) return response;
    console.error("Manual reference error:", error);
    return NextResponse.json({ error: "Failed to create reference draft" }, { status: 500 });
  }
}
