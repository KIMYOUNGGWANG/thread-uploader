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

import { prisma } from "@/lib/prisma";
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

    const expected = calculatePerformanceScore({ ...published, views: 500, likes: 0, replies: 3, reposts: 0 });
    const insightsOnly = calculatePerformanceScore({ views: 500, likes: 0, replies: 3, reposts: 0 });
    expect(expected).toBeGreaterThan(insightsOnly);
    expect(prisma.post.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ views: 500, performanceScore: expected }),
    }));
  });
});
