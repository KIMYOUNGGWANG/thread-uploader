import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accessErrorResponse, requireBrandForCurrentUser } from "@/lib/brand-access";
import { applyUploadAction, isUploadAction } from "@/lib/distribution/controls";
import { isRecord } from "@/types/config-normalizers";

/** POST /api/channel-uploads/[id] { action: "cancel" | "retry" | "ack_public" } */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const upload = await prisma.channelUpload.findUnique({ where: { id }, select: { brandId: true } });
    if (!upload) return NextResponse.json({ error: "업로드를 찾을 수 없습니다" }, { status: 404 });
    await requireBrandForCurrentUser(upload.brandId);

    const body: unknown = await request.json().catch(() => null);
    const action = isRecord(body) ? body.action : undefined;
    if (!isUploadAction(action)) return NextResponse.json({ error: "action은 cancel, retry, ack_public 중 하나여야 합니다" }, { status: 400 });

    const result = await applyUploadAction(id, action);
    return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.error }, { status: result.status });
  } catch (error) {
    return accessErrorResponse(error) ?? NextResponse.json({ error: "저장 실패" }, { status: 500 });
  }
}
