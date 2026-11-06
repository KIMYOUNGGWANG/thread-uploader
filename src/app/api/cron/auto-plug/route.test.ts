import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    brand: { findMany: vi.fn() },
    post: { findMany: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("@/lib/cron-auth", () => ({ verifyCronSecret: vi.fn().mockReturnValue(true) }));
vi.mock("@/lib/threads-api", () => ({
  getFreshBrandCredentials: vi.fn(async () => ({ accessToken: "token", userId: "u" })),
  fetchPostInsightsForBrand: vi.fn(),
  publishReplyWithRetryForBrand: vi.fn(async () => "reply_1"),
}));

import { prisma } from "@/lib/prisma";
import { fetchPostInsightsForBrand, publishReplyWithRetryForBrand } from "@/lib/threads-api";
import { GET } from "./route";

const brand = { id: "brand_1", slug: "cosmicpath", accessToken: "enc", tokenExpiry: new Date(Date.now() + 86_400_000) };
const post = { id: "post_1", threadsId: "t1", errorLog: null };
const insights = (views: number, replies: number) => ({ views, likes: 0, replies, reposts: 0 });
const call = (query = "") => GET(new NextRequest(`http://localhost/api/cron/auto-plug${query}`)).then((response) => response.json());

describe("GET /api/cron/auto-plug", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.brand.findMany).mockResolvedValue([brand] as never);
    vi.mocked(prisma.post.findMany).mockResolvedValue([post] as never);
    vi.mocked(prisma.post.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(fetchPostInsightsForBrand).mockResolvedValue(insights(300, 0));
  });

  it("only looks at unlinked published posts between 45 minutes and 48 hours old", async () => {
    await call();
    const where = vi.mocked(prisma.post.findMany).mock.calls[0][0]?.where;
    expect(where).toMatchObject({ brandId: "brand_1", status: "PUBLISHED", threadsId: { not: null }, linkUrl: null });
    const { gte, lte } = where?.publishedAt as { gte: Date; lte: Date };
    expect(lte.getTime() - gte.getTime()).toBe(48 * 3_600_000 - 45 * 60_000);
  });

  it("claims the post before replying with the tracked short link", async () => {
    const body = await call();

    expect(prisma.post.updateMany).toHaveBeenCalledWith({
      where: { id: "post_1", linkUrl: null },
      data: { linkUrl: "https://www.cosmicpath.app/start?entry=threads_auto_plug&utm_content=post_1", utmContent: "post_1" },
    });
    const [text, replyToId] = vi.mocked(publishReplyWithRetryForBrand).mock.calls[0];
    expect(text).toContain("/r/post_1");
    expect(replyToId).toBe("t1");
    expect(vi.mocked(prisma.post.updateMany).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(publishReplyWithRetryForBrand).mock.invocationCallOrder[0]);
    expect(body.results[0]).toMatchObject({ slug: "cosmicpath", checked: 1, plugged: [{ postId: "post_1", views: 300, replies: 0 }], errors: [] });
  });

  it("plugs on replies alone", async () => {
    vi.mocked(fetchPostInsightsForBrand).mockResolvedValue(insights(40, 10));
    await call();
    expect(publishReplyWithRetryForBrand).toHaveBeenCalledTimes(1);
  });

  it("leaves posts under both thresholds alone", async () => {
    vi.mocked(fetchPostInsightsForBrand).mockResolvedValue(insights(299, 9));
    const body = await call();
    expect(prisma.post.updateMany).not.toHaveBeenCalled();
    expect(publishReplyWithRetryForBrand).not.toHaveBeenCalled();
    expect(body.results[0]).toMatchObject({ checked: 1, plugged: [] });
  });

  // A concurrent run already holds the post; replying again would post the link twice.
  it("does not reply when another run claimed the post first", async () => {
    vi.mocked(prisma.post.updateMany).mockResolvedValue({ count: 0 } as never);
    const body = await call();
    expect(publishReplyWithRetryForBrand).not.toHaveBeenCalled();
    expect(body.results[0].plugged).toEqual([]);
  });

  // The reply may have gone out before the error, so the claim stays and nothing retries.
  it("records a failed reply without releasing the claim", async () => {
    vi.mocked(prisma.post.findMany).mockResolvedValue([{ ...post, errorLog: "First comment failed: x" }] as never);
    vi.mocked(publishReplyWithRetryForBrand).mockRejectedValueOnce(new Error("[restricted] blocked"));

    const body = await call();

    expect(prisma.post.update).toHaveBeenCalledWith({
      where: { id: "post_1" },
      data: { errorLog: "First comment failed: x\nAuto-plug failed: [restricted] blocked" },
    });
    expect(publishReplyWithRetryForBrand).toHaveBeenCalledTimes(1);
    expect(body.results[0]).toMatchObject({ plugged: [], errors: [{ postId: "post_1", error: "[restricted] blocked" }] });
  });

  it("dryRun reports the posts that would be plugged without writing or replying", async () => {
    const body = await call("?dryRun=1");
    expect(prisma.post.updateMany).not.toHaveBeenCalled();
    expect(publishReplyWithRetryForBrand).not.toHaveBeenCalled();
    expect(body.results[0]).toMatchObject({ dryRun: true, plugged: [{ postId: "post_1" }] });
  });

  it("skips a brand whose Threads token expired", async () => {
    vi.mocked(prisma.brand.findMany).mockResolvedValue([{ ...brand, tokenExpiry: new Date(Date.now() - 1000) }] as never);
    const body = await call();
    expect(prisma.post.findMany).not.toHaveBeenCalled();
    expect(body.results).toEqual([{ slug: "cosmicpath", skipped: "token_expired" }]);
  });
});
