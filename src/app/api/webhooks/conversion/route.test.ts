import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

const basePost = {
  id: "post_1", brandId: "brand_1", formulaId: "f1",
  clicks: 1, conversions: 2, manualPaidConversions: 0, performanceScore: 10, performanceTier: "baseline",
  views: 100, likes: 1, replies: 0, reposts: 0,
};

const tx = {
  conversionEvent: { create: vi.fn() },
  $executeRaw: vi.fn(),
  post: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: { findUnique: vi.fn() },
    conversionEvent: { findUnique: vi.fn() },
    $transaction: vi.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
  },
}));
vi.mock("@/lib/growth-service", () => ({ learnBrandGrowth: vi.fn().mockResolvedValue(undefined) }));

import { prisma } from "@/lib/prisma";
import { learnBrandGrowth } from "@/lib/growth-service";
import { POST } from "./route";

function webhook(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return POST(new NextRequest("http://localhost/api/webhooks/conversion", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  }));
}

describe("POST /api/webhooks/conversion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CONVERSION_WEBHOOK_SECRET = "server_secret";
    vi.mocked(prisma.post.findUnique).mockResolvedValue(basePost as never);
    vi.mocked(prisma.conversionEvent.findUnique).mockResolvedValue(null);
    tx.post.findUniqueOrThrow.mockResolvedValue({ ...basePost, conversions: 3 });
    tx.post.update.mockImplementation(async () => ({ ...basePost, conversions: 3 }));
  });

  it("accepts browser conversion events without a secret and increments atomically", async () => {
    const res = await webhook({ postId: "post_1", eventType: "first_result_view", sessionId: "s1" });
    expect(res.status).toBe(200);
    expect((await res.json()).post.conversions).toBe(3);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.conversionEvent.create).toHaveBeenCalledTimes(1);
    expect(learnBrandGrowth).toHaveBeenCalledWith("brand_1");
  });

  it("rejects paid events without the server secret, including a secret in the body", async () => {
    const res = await webhook({ postId: "post_1", eventType: "paid_conversion", secret: "server_secret" });
    expect(res.status).toBe(401);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects paid events when no webhook secret is configured (fail-closed)", async () => {
    delete process.env.CONVERSION_WEBHOOK_SECRET;
    process.env.CRON_SECRET = "cron_secret";
    const res = await webhook({ postId: "post_1", eventType: "payment" }, { "x-webhook-secret": "cron_secret" });
    expect(res.status).toBe(401);
  });

  it("accepts paid events with the secret header", async () => {
    const res = await webhook({ postId: "post_1", eventType: "checkout_success" }, { "x-webhook-secret": "server_secret" });
    expect(res.status).toBe(200);
    expect((await res.json()).eventType).toBe("paid_conversion");
  });

  it("dedupes repeated events in the same session", async () => {
    vi.mocked(prisma.conversionEvent.findUnique).mockResolvedValue({ id: "e1" } as never);
    const res = await webhook({ postId: "post_1", eventType: "click", sessionId: "s1" });
    expect((await res.json()).deduped).toBe(true);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("treats a unique-constraint race as a dedupe", async () => {
    tx.conversionEvent.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "5" })
    );
    const res = await webhook({ postId: "post_1", eventType: "click", sessionId: "s1" });
    expect((await res.json()).deduped).toBe(true);
  });

  it("ignores unknown event types without counting", async () => {
    const res = await webhook({ postId: "post_1", eventType: "signup" });
    expect((await res.json()).ignored).toBe(true);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
