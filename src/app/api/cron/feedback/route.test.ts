import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    brand: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    post: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/cron-auth", () => ({
  verifyCronSecret: vi.fn().mockReturnValue(true),
}));

import { GET } from "./route";
import { prisma } from "@/lib/prisma";

describe("GET /api/cron/feedback", () => {
  it("evaluates feedback loop and returns preview when apply is false", async () => {
    vi.mocked(prisma.brand.findMany).mockResolvedValueOnce([
      {
        id: "b1",
        slug: "cosmicpath",
        name: "CosmicPath",
        formulaWeights: "{}",
        viralMemory: "{}",
      } as any,
    ]);

    const oldDate = new Date(Date.now() - 80 * 60 * 60 * 1000);
    vi.mocked(prisma.post.findMany).mockResolvedValueOnce([
      {
        id: "p1",
        content: "테스트 포스트 본문 훅\n상세 내용",
        campaignFormulaId: "imagination_dilemma",
        publishedAt: oldDate,
        metricsAt: oldDate,
        views: 2000,
        replies: 10,
        reposts: 2,
        conversions: 1,
      } as any,
    ]);

    const req = new NextRequest("http://localhost:3000/api/cron/feedback");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.reports[0].applied).toBe(false);
    expect(data.reports[0].report.maturePostCount).toBe(1);
    expect(prisma.brand.update).not.toHaveBeenCalled();
  });

  it("applies recommended weights and viral memory when apply=true", async () => {
    vi.mocked(prisma.brand.findMany).mockResolvedValueOnce([
      {
        id: "b1",
        slug: "cosmicpath",
        name: "CosmicPath",
        formulaWeights: "{}",
        viralMemory: "{}",
      } as any,
    ]);

    const oldDate = new Date(Date.now() - 80 * 60 * 60 * 1000);
    vi.mocked(prisma.post.findMany).mockResolvedValueOnce([
      {
        id: "p1",
        content: "테스트 포스트 본문 훅\n상세 내용",
        campaignFormulaId: "imagination_dilemma",
        publishedAt: oldDate,
        metricsAt: oldDate,
        views: 2000,
        replies: 10,
        reposts: 2,
        conversions: 1,
      } as any,
    ]);

    const req = new NextRequest("http://localhost:3000/api/cron/feedback?apply=true");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.reports[0].applied).toBe(true);
    expect(prisma.brand.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "b1" },
      })
    );
  });
});
