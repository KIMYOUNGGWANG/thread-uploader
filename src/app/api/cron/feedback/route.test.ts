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
      } as never,
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
      } as never,
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

  it("applies viral memory but leaves formulaWeights to the learn cron when apply=true", async () => {
    vi.mocked(prisma.brand.findMany).mockResolvedValueOnce([
      {
        id: "b1",
        slug: "cosmicpath",
        name: "CosmicPath",
        formulaWeights: "{}",
        viralMemory: "{}",
      } as never,
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
      } as never,
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
    const updateArgs = vi.mocked(prisma.brand.update).mock.calls.at(-1)?.[0];
    expect(updateArgs?.data).not.toHaveProperty("formulaWeights");
  });
  it("keeps New Year posts out of the top performers that every prompt reuses", async () => {
    vi.mocked(prisma.brand.findMany).mockResolvedValueOnce([
      { id: "b1", slug: "cosmicpath", name: "CosmicPath", viralMemory: "{}", brandConfig: "{}" } as never,
    ]);
    const oldDate = new Date(Date.now() - 80 * 60 * 60 * 1000);
    const base = { publishedAt: oldDate, metricsAt: oldDate, replies: 10, reposts: 2, conversions: 1, campaignFormulaId: null };
    vi.mocked(prisma.post.findMany).mockResolvedValueOnce([
      { ...base, id: "p_ny", content: "2027년 일간별로 바쁜 데가 달라\n갑목·을목: 할 말이 많아지는 해", formulaId: "ny_ranking", views: 90000 },
      { ...base, id: "p_normal", content: "평범한 훅\n상세 내용", formulaId: "concept_hierarchy", views: 2000 },
    ] as never);

    const res = await GET(new NextRequest("http://localhost:3000/api/cron/feedback?apply=true"));
    const data = await res.json();

    expect(vi.mocked(prisma.post.findMany).mock.calls.at(-1)?.[0]?.select).toMatchObject({ formulaId: true });
    expect(data.reports[0].report.maturePostCount).toBe(1);
    const updateArgs = vi.mocked(prisma.brand.update).mock.calls.at(-1)?.[0];
    const memory = JSON.parse(String(updateArgs?.data.viralMemory)) as { topPerformers: Array<{ postId: string }> };
    expect(memory.topPerformers.map((tp) => tp.postId)).toEqual(["p_normal"]);
  });
});
