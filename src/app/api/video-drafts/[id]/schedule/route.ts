import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accessErrorResponse, requireBrandForCurrentUser } from "@/lib/brand-access";
import { applyDraftAction, isDraftAction } from "@/lib/distribution/controls";
import { isRecord } from "@/types/config-normalizers";

/** POST /api/video-drafts/[id]/schedule { action: "cancel" | "resume" | "publish_now" } */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const draft = await prisma.videoDraft.findUnique({ where: { id }, select: { brandId: true } });
    if (!draft) return NextResponse.json({ error: "영상을 찾을 수 없습니다" }, { status: 404 });
    await requireBrandForCurrentUser(draft.brandId);

    const body: unknown = await request.json().catch(() => null);
    const action = isRecord(body) ? body.action : undefined;
    if (!isDraftAction(action)) return NextResponse.json({ error: "action은 cancel, resume, publish_now 중 하나여야 합니다" }, { status: 400 });

    const result = await applyDraftAction(id, action);
    return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.error }, { status: result.status });
  } catch (error) {
    return accessErrorResponse(error) ?? NextResponse.json({ error: "저장 실패" }, { status: 500 });
  }
}
