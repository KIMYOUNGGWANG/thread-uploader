import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accessErrorResponse, requireBrandForCurrentUser } from "@/lib/brand-access";
import { isRecord } from "@/types/config-normalizers";

async function loadOwned(id: string) {
  const account = await prisma.channelAccount.findUnique({ where: { id }, select: { id: true, brandId: true, platform: true } });
  if (!account) return null;
  await requireBrandForCurrentUser(account.brandId);
  return account;
}

/** PATCH /api/channel-accounts/[id] { enabled: boolean } — pause or resume uploads to this channel. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const account = await loadOwned((await params).id);
    if (!account) return NextResponse.json({ error: "채널을 찾을 수 없습니다" }, { status: 404 });
    const body: unknown = await request.json().catch(() => null);
    if (!isRecord(body) || typeof body.enabled !== "boolean") {
      return NextResponse.json({ error: "enabled(boolean)가 필요합니다" }, { status: 400 });
    }
    await prisma.channelAccount.update({ where: { id: account.id }, data: { enabled: body.enabled } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return accessErrorResponse(error) ?? NextResponse.json({ error: "저장 실패" }, { status: 500 });
  }
}

/** DELETE /api/channel-accounts/[id] — forget the tokens (YouTube/TikTok/X). Upload history stays. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const account = await loadOwned((await params).id);
    if (!account) return NextResponse.json({ error: "채널을 찾을 수 없습니다" }, { status: 404 });
    if (account.platform === "threads" || account.platform === "instagram") {
      return NextResponse.json({ error: "Threads·Instagram 연결은 기존 연결 화면에서 관리합니다" }, { status: 400 });
    }
    await prisma.channelAccount.update({
      where: { id: account.id },
      data: { accessToken: null, refreshToken: null, tokenExpiry: null, enabled: false },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return accessErrorResponse(error) ?? NextResponse.json({ error: "저장 실패" }, { status: 500 });
  }
}
