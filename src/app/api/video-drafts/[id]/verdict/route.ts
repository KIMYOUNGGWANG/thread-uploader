import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, AuthError } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/brand-access";
import { isVerdict } from "@/lib/video-factory/verdict";
import { isRecord } from "@/types/config-normalizers";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const draft = await prisma.videoDraft.findUnique({ where: { id }, include: { brand: { select: { ownerId: true } } } });
    if (!draft || (!isSuperAdmin(user.email) && draft.brand.ownerId !== user.id)) {
      return NextResponse.json({ error: "영상을 찾을 수 없습니다" }, { status: 404 });
    }

    const body: unknown = await request.json().catch(() => null);
    const verdict = isRecord(body) ? body.verdict : undefined;
    if (!isVerdict(verdict)) {
      return NextResponse.json({ error: "verdict는 good 또는 bad여야 합니다" }, { status: 400 });
    }
    if (draft.status !== "COMPLETED") {
      return NextResponse.json({ error: "완성된 영상만 판정할 수 있습니다" }, { status: 409 });
    }

    await prisma.videoDraft.update({ where: { id }, data: { userVerdict: verdict, verdictAt: new Date() } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "판정 저장 실패" }, { status: 500 });
  }
}
