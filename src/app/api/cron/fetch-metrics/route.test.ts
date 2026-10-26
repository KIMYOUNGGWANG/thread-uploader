import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { calculatePerformanceScore } from "@/lib/growth-learning";

const HOUR = 60 * 60 * 1000;
const published = {
  id: "post_1", brandId: "brand_1", status: "PUBLISHED", threadsId: "t1",
  publishedAt: new Date(Date.now() - 24 * HOUR), metricsAt: null,
  views: 10, likes: 0, replies: 0, reposts: 0, clicks: 30, conversions: 4, manualPaidConversions: 1,
};

vi.mock("@/lib/prisma", () => ({
  prisma: { post: { findMany: vi.fn(), update: vi.fn() } },
}));
vi.mock("@/lib/threads-api", () => ({
  getFreshBrandCredentials: vi.fn(async () => ({ accessToken: "fresh", userId: "u" })),
}));

vi.mock("@/lib/channels/publication-mirror", () => ({
  mirrorThreadsFromPost: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from "@/lib/prisma";
import { mirrorThreadsFromPost } from "@/lib/channels/publication-mirror";
import { getFreshBrandCredentials } from "@/lib/threads-api";
import { GET } from "./route";

describe("GET /api/cron/fetch-metrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.post.findMany).mockResolvedValue([published] as never);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      data: [{ name: "views", values: [{ value: 500 }] }, { name: "replies", values: [{ value: 3 }] }],
    }))));
  });

  it("keeps click/conversion counters in the refreshed score and uses fresh credentials", async () => {
    const res = await GET(new NextRequest("http://localhost/api/cron/fetch-metrics"));
    expect((await res.json()).updated).toBe(1);
    expect(getFreshBrandCredentials).toHaveBeenCalledWith("brand_1");
    expect(mirrorThreadsFromPost).toHaveBeenCalledWith("post_1");

    const expected = calculatePerformanceScore({ ...published, views: 500, likes: 0, replies: 3, reposts: 0 });
    const insightsOnly = calculatePerformanceScore({ views: 500, likes: 0, replies: 3, reposts: 0 });
    expect(expected).toBeGreaterThan(insightsOnly);
    expect(prisma.post.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ views: 500, performanceScore: expected }),
    }));
  });

  it("archives a post deleted on Threads so it stops topping the never-collected queue", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      error: { message: "Unsupported get request. Object with ID 't1' does not exist, cannot be loaded due to missing permissions, or does not support this operation" },
    }), { status: 400 })));

    const body = await (await GET(new NextRequest("http://localhost/api/cron/fetch-metrics"))).json();

    expect(body).toMatchObject({ updated: 0, archived: 1, errors: [] });
    expect(prisma.post.update).toHaveBeenCalledWith({
      where: { id: "post_1" },
      data: { status: "ARCHIVED", errorLog: expect.stringContaining("Deleted on Threads") },
    });
    expect(mirrorThreadsFromPost).toHaveBeenCalledWith("post_1");
  });

  it("keeps other insights failures as errors without touching the post", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { message: "Rate limit" } }), { status: 429 })));

    const body = await (await GET(new NextRequest("http://localhost/api/cron/fetch-metrics"))).json();

    expect(body).toMatchObject({ updated: 0, archived: 0 });
    expect(body.errors).toHaveLength(1);
    expect(prisma.post.update).not.toHaveBeenCalled();
    expect(mirrorThreadsFromPost).not.toHaveBeenCalled();
  });
});
