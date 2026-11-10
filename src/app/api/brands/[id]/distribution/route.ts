import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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
    let stored: Record<string, unknown> = {};
    try {
      const parsed: unknown = JSON.parse(brand.brandConfig || "{}");
      if (isRecord(parsed)) stored = parsed;
    } catch {
      // a corrupt config is replaced key by key; keep going with an empty object
    }
    await prisma.brand.update({ where: { id }, data: { brandConfig: JSON.stringify({ ...stored, distribution }) } });
    return NextResponse.json({ ok: true, distribution });
  } catch (error) {
    return accessErrorResponse(error) ?? NextResponse.json({ error: "저장 실패" }, { status: 500 });
  }
}
