import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findBrand: vi.fn(),
  findPosts: vi.fn(),
  updateBrand: vi.fn(async () => ({})),
  updatePost: vi.fn(async () => ({})),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    brand: { findUnique: mocks.findBrand, update: mocks.updateBrand },
    post: { findMany: mocks.findPosts, update: mocks.updatePost },
  },
}));

import { learnBrandGrowth } from "@/lib/growth-service";

function post(id: string, formulaId: string, views: number) {
  return {
    id,
    brandId: "brand_1",
    formulaId,
    topic: null,
    targetAudience: null,
    situation: null,
    hookType: null,
    ctaType: null,
    campaignId: null,
    views,
    likes: 0,
    replies: 0,
    reposts: 0,
    clicks: 0,
    conversions: 0,
    manualPaidConversions: 0,
    performanceScore: null,
    publishedAt: new Date("2026-10-01T00:00:00Z"),
    metricsAt: new Date("2026-10-05T00:00:00Z"),
  };
}

describe("learnBrandGrowth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findBrand.mockResolvedValue({
      id: "brand_1",
      // Stored weights already drifted to the ceiling from previous daily runs.
      formulaWeights: JSON.stringify({ winner: 10, loser: 1 }),
      brandConfig: "{}",
    });
    mocks.findPosts.mockResolvedValue([
      post("1", "winner", 5000),
      post("2", "winner", 4000),
      post("3", "loser", 100),
      post("4", "loser", 120),
    ]);
  });

  it("under the default reach goal, a paid conversion on a low-view formula does not make it the winner", async () => {
    mocks.findPosts.mockResolvedValue([
      post("1", "winner", 5000),
      post("2", "winner", 4000),
      { ...post("3", "loser", 100), manualPaidConversions: 1 },
      { ...post("4", "loser", 120), manualPaidConversions: 1 },
    ]);

    const result = await learnBrandGrowth("brand_1");

    expect(result.promotedFormulas).toEqual(["winner"]);
    expect(result.demotedFormulas).toEqual(["loser"]);
    expect(result.memory.formulaWinners).toEqual(["winner"]);
  });

  it("under the conversion goal, the paying formula wins", async () => {
    mocks.findBrand.mockResolvedValue({ id: "brand_1", formulaWeights: "{}", brandConfig: JSON.stringify({ optimizationGoal: "conversion" }) });
    mocks.findPosts.mockResolvedValue([
      post("1", "reach", 5000),
      post("2", "reach", 4000),
      { ...post("3", "money", 100), manualPaidConversions: 1 },
      { ...post("4", "money", 120), manualPaidConversions: 1 },
    ]);

    const result = await learnBrandGrowth("brand_1");

    expect(result.promotedFormulas).toEqual(["money"]);
  });

  it("rebuilds formula weights from the window instead of stacking on stored weights", async () => {
    const result = await learnBrandGrowth("brand_1");

    expect(result.updatedWeights?.winner).toBe(4);
    expect(result.updatedWeights?.loser).toBe(2);
    expect(mocks.updateBrand).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ formulaWeights: expect.stringContaining('"winner":4') }),
    }));
  });
});
