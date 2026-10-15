import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  brand: { findUnique: vi.fn() },
  post: {
    findFirst: vi.fn(),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "p1", ...data })),
    update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => data),
  },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { ...db, $transaction: vi.fn(async (work: (tx: typeof db) => Promise<unknown>) => work(db)) },
}));

import { POST } from "./route";
import { prisma } from "@/lib/prisma";

const item = (overrides: Record<string, unknown> = {}) => ({
  brandSlug: "cosmicpath",
  videoUrl: "https://blob.example/videos/cosmicpath/promo.mp4",
  content: "본문",
  commentTemplate: "무료 진단부터 돌려봐 → {{link}}",
  landingPath: "/start",
  format: "race",
  topic: "career",
  ...overrides,
});
const request = (body: unknown, auth = "Bearer secret") =>
  new NextRequest("http://localhost/api/cron/promo-posts", { method: "POST", body: JSON.stringify(body), headers: { authorization: auth } });

describe("POST /api/cron/promo-posts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "secret");
    db.brand.findUnique.mockResolvedValue({ id: "b1", slug: "cosmicpath" });
    db.post.findFirst.mockResolvedValue(null);
  });

  it("rejects a missing or wrong secret", async () => {
    expect((await POST(request({ date: "2026-10-19", items: [item()] }, "Bearer nope"))).status).toBe(401);
  });

  it("rejects malformed bodies", async () => {
    for (const body of [
      { items: [item()] },
      { date: "2026-10-19", items: [] },
      { date: "2026-10-19", items: [item({ videoUrl: "http://blob.example/a.mp4" })] },
      { date: "2026-10-19", items: [item({ videoUrl: "https://blob.example/a.mov" })] },
      { date: "2026-10-19", items: [item({ content: "가".repeat(481) })] },
      { date: "2026-10-19", items: [item({ commentTemplate: "no link" })] },
      { date: "2026-10-19", items: [item({ landingPath: "https://evil.example" })] },
    ]) {
      expect((await POST(request(body))).status).toBe(400);
    }
    expect(db.post.create).not.toHaveBeenCalled();
  });

  it("creates a NEEDS_REVIEW video post with a UTM first comment", async () => {
    const body = await (await POST(request({ date: "2026-10-19", items: [item({ landingPath: "/start?context=love" })] }))).json();
    expect(body.results).toEqual([{ brandSlug: "cosmicpath", postId: "p1" }]);
    expect(db.post.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        brandId: "b1", status: "NEEDS_REVIEW", formulaId: "video:promo:2026-10-19", topic: "race:career",
        imageUrls: JSON.stringify(["https://blob.example/videos/cosmicpath/promo.mp4"]),
      }),
    });
    const update = db.post.update.mock.calls[0]?.[0] as { data: { linkUrl: string; firstComment: string; utmContent: string } };
    const link = new URL(update.data.linkUrl);
    expect(link.origin + link.pathname).toBe("https://cosmicpath.app/start");
    expect(Object.fromEntries(link.searchParams)).toEqual({ context: "love", utm_source: "threads", utm_campaign: "promo-rotation", utm_content: "p1" });
    expect(update.data.firstComment).toBe(`무료 진단부터 돌려봐 → ${update.data.linkUrl}`);
    expect(update.data.utmContent).toBe("p1");
  });

  it("creates the post and its UTM link in one transaction so no half-written post survives", async () => {
    await POST(request({ date: "2026-10-19", items: [item()] }));
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(db.post.create).toHaveBeenCalledTimes(1);
    expect(db.post.update).toHaveBeenCalledTimes(1);
  });

  it("skips an already queued brand and a missing brand without failing the others", async () => {
    db.post.findFirst.mockResolvedValueOnce({ id: "old" });
    db.brand.findUnique
      .mockResolvedValueOnce({ id: "b1", slug: "cosmicpath" })
      .mockResolvedValueOnce(null);
    const body = await (await POST(request({ date: "2026-10-19", items: [item(), item({ brandSlug: "ghost" })] }))).json();
    expect(body.results).toEqual([
      { brandSlug: "cosmicpath", skipped: "already_queued" },
      { brandSlug: "ghost", skipped: "brand_not_found" },
    ]);
    expect(db.post.create).not.toHaveBeenCalled();
  });
});
