import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { POST } from "./route";

vi.mock("@/lib/prisma", () => ({
  prisma: { channelAccount: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() } },
}));
vi.mock("@/lib/brand-access", () => ({
  requireBrandForCurrentUser: vi.fn(async (brandId: string) => ({ user: { id: "owner-a" }, brand: { id: brandId, ownerId: "owner-a" } })),
  accessErrorResponse: () => null,
}));
vi.mock("@/lib/distribution/telegram-connect", () => ({
  TelegramConnectError: class extends Error {},
  verifyTelegramChannel: vi.fn(async () => ({ chatId: "-1001", handle: "@victim_news" })),
}));

const request = () => new NextRequest("http://localhost/api/channel-accounts/telegram", {
  method: "POST",
  body: JSON.stringify({ brandId: "brand-a", chat: "@victim_news" }),
});

describe("POST /api/channel-accounts/telegram", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "TOKEN");
  });

  it("refuses a channel another user's brand already connected", async () => {
    vi.mocked(prisma.channelAccount.findFirst).mockResolvedValueOnce({ id: "acc-b" } as never);
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(prisma.channelAccount.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { platform: "telegram", externalUserId: "-1001", brand: { ownerId: { not: "owner-a" } } },
    }));
    expect(prisma.channelAccount.create).not.toHaveBeenCalled();
    expect(prisma.channelAccount.update).not.toHaveBeenCalled();
  });

  it("connects a channel nobody else holds, keyed by its numeric id", async () => {
    vi.mocked(prisma.channelAccount.findFirst).mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    vi.mocked(prisma.channelAccount.create).mockResolvedValueOnce({ id: "acc-a", handle: "@victim_news" } as never);
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(prisma.channelAccount.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ brandId: "brand-a", platform: "telegram", externalUserId: "-1001", handle: "@victim_news" }),
    });
  });
});
