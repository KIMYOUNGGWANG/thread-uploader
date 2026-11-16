import { NextRequest, NextResponse } from "next/server";
import { patchBrandConfig } from "@/lib/brand-config-patch";
import { accessErrorResponse, requireBrandForCurrentUser } from "@/lib/brand-access";
import { normalizeDistributionConfig } from "@/lib/distribution/config";
import { isRecord } from "@/types/config-normalizers";

/** PUT /api/brands/[id]/distribution — replaces brandConfig.distribution (other keys untouched). */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { brand } = await requireBrandForCurrentUser(id);
    const body: unknown = await request.json().catch(() => null);
    if (!isRecord(body)) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

    const distribution = normalizeDistributionConfig(body);
    await patchBrandConfig(id, brand.brandConfig, { distribution });
    return NextResponse.json({ ok: true, distribution });
  } catch (error) {
    return accessErrorResponse(error) ?? NextResponse.json({ error: "저장 실패" }, { status: 500 });
  }
}
