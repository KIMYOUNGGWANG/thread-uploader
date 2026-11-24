import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accessErrorResponse, requireBrandForCurrentUser } from "@/lib/brand-access";
import { TelegramConnectError, verifyTelegramChannel } from "@/lib/distribution/telegram-connect";
import { isRecord } from "@/types/config-normalizers";

/** POST /api/channel-accounts/telegram { brandId, chat } — verifies the bot can post, then connects (or re-enables) the channel. */
export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json().catch(() => null);
    if (!isRecord(body) || typeof body.brandId !== "string" || typeof body.chat !== "string") {
      return NextResponse.json({ error: "brandId와 chat이 필요해" }, { status: 400 });
    }
    const { brand } = await requireBrandForCurrentUser(body.brandId);
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return NextResponse.json({ error: "서버에 TELEGRAM_BOT_TOKEN이 없어" }, { status: 503 });

    const channel = await verifyTelegramChannel(body.chat, token);
    // Every brand shares one bot, so "the bot can post there" proves nothing about who owns the channel.
    // A channel already connected by another user's brand stays theirs; one owner may share a channel across their brands.
    const taken = await prisma.channelAccount.findFirst({
      where: { platform: "telegram", externalUserId: channel.chatId, brand: { ownerId: { not: brand.ownerId } } },
      select: { id: true },
    });
    if (taken) return NextResponse.json({ error: "이 채널은 다른 계정의 브랜드에 이미 연결돼 있어" }, { status: 409 });
    const data = { externalUserId: channel.chatId, handle: channel.handle, enabled: true, connectedAt: new Date() };
    // One telegram channel per brand, same as the other platforms (accounts.ts).
    const existing = await prisma.channelAccount.findFirst({ where: { brandId: body.brandId, platform: "telegram" }, orderBy: { createdAt: "asc" } });
    const account = existing
      ? await prisma.channelAccount.update({ where: { id: existing.id }, data })
      : await prisma.channelAccount.create({ data: { brandId: body.brandId, platform: "telegram", mode: "direct", ...data } });
    return NextResponse.json({ ok: true, account: { id: account.id, handle: account.handle } });
  } catch (error) {
    if (error instanceof TelegramConnectError) return NextResponse.json({ error: error.message }, { status: 400 });
    return accessErrorResponse(error) ?? NextResponse.json({ error: "텔레그램 채널 연결 실패" }, { status: 500 });
  }
}
