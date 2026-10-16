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

// Learning only ranks formulas with 5+ posts, so every fixture formula gets five.
const HIGH_VIEWS = [5000, 4000, 4500, 4800, 4200];
const LOW_VIEWS = [100, 120, 110, 90, 130];
const posts = (prefix: string, formulaId: string, views: number[]) =>
  views.map((count, index) => post(`${prefix}${index}`, formulaId, count));

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
      ...posts("w", "winner", HIGH_VIEWS),
      ...posts("l", "loser", LOW_VIEWS),
    ]);
  });

  it("under the default reach goal, a paid conversion on a low-view formula does not make it the winner", async () => {
    mocks.findPosts.mockResolvedValue([
      ...posts("w", "winner", HIGH_VIEWS),
      ...posts("l", "loser", LOW_VIEWS).map((lowPost) => ({ ...lowPost, manualPaidConversions: 1 })),
    ]);

    const result = await learnBrandGrowth("brand_1");

    expect(result.promotedFormulas).toEqual(["winner"]);
    expect(result.demotedFormulas).toEqual(["loser"]);
    expect(result.memory.formulaWinners).toEqual(["winner"]);
  });

  it("under the conversion goal, the paying formula wins", async () => {
    mocks.findBrand.mockResolvedValue({ id: "brand_1", formulaWeights: "{}", brandConfig: JSON.stringify({ optimizationGoal: "conversion" }) });
    mocks.findPosts.mockResolvedValue([
      ...posts("r", "reach", HIGH_VIEWS),
      ...posts("m", "money", LOW_VIEWS).map((lowPost) => ({ ...lowPost, manualPaidConversions: 1 })),
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
