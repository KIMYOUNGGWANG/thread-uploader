import { describe, it, expect, vi, beforeEach } from "vitest";
import { calculatePerformanceScore, getPerformanceTier } from "./growth-learning";
import { NextRequest } from "next/server";
import { prisma } from "./prisma";

describe("Revenue-Weighted Attribution Scoring", () => {
  it("rewards paid conversions (2,500 pts) much higher than passive views", () => {
    const postA_Score = calculatePerformanceScore({
      views: 10000,
      likes: 20,
      replies: 5,
      reposts: 2,
      clicks: 10,
      conversions: 0,
      manualPaidConversions: 0,
    });

    const postB_Score = calculatePerformanceScore({
      views: 1000,
      likes: 5,
      replies: 2,
      reposts: 1,
      clicks: 50,
      conversions: 10,
      manualPaidConversions: 2,
    });

    expect(postB_Score).toBeGreaterThan(postA_Score);
    expect(postB_Score).toBeGreaterThan(10000);
    expect(getPerformanceTier(postB_Score)).toBe("breakout");
  });

  it("calculates accurate tier transitions for revenue signals", () => {
    const basicScore = calculatePerformanceScore({
      views: 100,
      likes: 0,
      replies: 1,
      reposts: 0,
      clicks: 1,
      conversions: 0,
      manualPaidConversions: 0,
    });
    expect(getPerformanceTier(basicScore)).toBe("promising");

    const conversionScore = calculatePerformanceScore({
      views: 100,
      likes: 0,
      replies: 1,
      reposts: 0,
      clicks: 5,
      conversions: 1,
      manualPaidConversions: 0,
    });
    expect(getPerformanceTier(conversionScore)).toBe("strong");
  });
});

describe("Conversion Webhook Route Handler", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.CONVERSION_WEBHOOK_SECRET;
  });

  it("rejects unauthorized webhook calls when secret is configured", async () => {
    process.env.CONVERSION_WEBHOOK_SECRET = "super_secret_123";
    const { POST } = await import("@/app/api/webhooks/conversion/route");

    const req = new NextRequest("http://localhost:3000/api/webhooks/conversion", {
      method: "POST",
      body: JSON.stringify({ postId: "post_1", eventType: "click" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized webhook secret");
  });

  it("accepts valid secret and increments conversions for first_result_view", async () => {
    process.env.CONVERSION_WEBHOOK_SECRET = "super_secret_123";
    const { POST } = await import("@/app/api/webhooks/conversion/route");

    const mockPost = {
      id: "post_1",
      formulaId: "contrarian",
      views: 100,
      likes: 2,
      replies: 1,
      reposts: 0,
      clicks: 5,
      conversions: 2,
      manualPaidConversions: 0,
      performanceScore: 500,
      performanceTier: "strong",
    };

    vi.spyOn(prisma.post, "findUnique").mockResolvedValue(mockPost as unknown as Awaited<ReturnType<typeof prisma.post.findUnique>>);
    vi.spyOn(prisma.post, "update").mockImplementation((args) => {
      const data = args.data as any;
      return Promise.resolve({
        id: "post_1",
        formulaId: "contrarian",
        clicks: data.clicks,
        conversions: data.conversions,
        manualPaidConversions: data.manualPaidConversions,
        performanceScore: data.performanceScore,
        performanceTier: data.performanceTier,
      } as unknown as Awaited<ReturnType<typeof prisma.post.update>>);
    });

    const req = new NextRequest("http://localhost:3000/api/webhooks/conversion", {
      method: "POST",
      body: JSON.stringify({
        secret: "super_secret_123",
        pid: "post_1",
        eventType: "first_result_view",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.eventType).toBe("conversion");
    expect(data.post.conversions).toBe(3);
  });

  it("deduplicates repeated events within same session", async () => {
    process.env.CONVERSION_WEBHOOK_SECRET = "super_secret_123";
    const { POST } = await import("@/app/api/webhooks/conversion/route");

    const mockPost = {
      id: "post_dedupe_test",
      formulaId: "contrarian",
      views: 100,
      likes: 0,
      replies: 0,
      reposts: 0,
      clicks: 1,
      conversions: 0,
      manualPaidConversions: 0,
      performanceScore: 50,
      performanceTier: "learning",
    };

    vi.spyOn(prisma.post, "findUnique").mockResolvedValue(mockPost as unknown as Awaited<ReturnType<typeof prisma.post.findUnique>>);
    const updateSpy = vi.spyOn(prisma.post, "update").mockResolvedValue(mockPost as unknown as Awaited<ReturnType<typeof prisma.post.update>>);

    const firstReq = new NextRequest("http://localhost:3000/api/webhooks/conversion", {
      method: "POST",
      body: JSON.stringify({
        secret: "super_secret_123",
        pid: "post_dedupe_test",
        eventType: "paid_conversion",
        sessionId: "session_user_999",
      }),
    });

    const firstRes = await POST(firstReq);
    expect(firstRes.status).toBe(200);
    const firstData = await firstRes.json();
    expect(firstData.deduped).toBe(false);

    // Second call with same sessionId & eventType
    const secondReq = new NextRequest("http://localhost:3000/api/webhooks/conversion", {
      method: "POST",
      body: JSON.stringify({
        secret: "super_secret_123",
        pid: "post_dedupe_test",
        eventType: "paid_conversion",
        sessionId: "session_user_999",
      }),
    });

    const secondRes = await POST(secondReq);
    expect(secondRes.status).toBe(200);
    const secondData = await secondRes.json();
    expect(secondData.deduped).toBe(true);
  });
});

