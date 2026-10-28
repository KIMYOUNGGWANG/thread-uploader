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

  it("reports learning input differences between posts and Threads publications", async () => {
    const pub = (views: number) => ({ views, likes: 0, replies: 0, reposts: 0, metricsAt: new Date("2026-10-05T00:00:00Z") });
    mocks.findPosts.mockResolvedValue([
      { ...post("same", "f", 100), publications: [pub(100)] },
      { ...post("diff", "f", 100), publications: [pub(250)] },
      { ...post("none", "f", 100), publications: [] },
    ]);

    const result = await learnBrandGrowth("brand_1");

    expect(result.learningInputDiff).toEqual({ missing: 1, changed: 1, changedPostIds: ["diff"] });
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

  it("learns only from posts measured for at least 72 hours", async () => {
    const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000);
    mocks.findPosts.mockResolvedValue([
      { ...post("f", "fresh", 50), publishedAt: hoursAgo(24) },
      { ...post("m", "mature", 50), publishedAt: hoursAgo(100) },
      { ...post("n", "unpublished", 50), publishedAt: null },
    ]);

    await learnBrandGrowth("brand_1");

    const saved = mocks.updateBrand.mock.calls[0] as unknown as [{ data: { brandConfig: string } }];
    const priors = (JSON.parse(saved[0].data.brandConfig) as { thompsonPriors: Record<string, unknown> }).thompsonPriors;
    expect(Object.keys(priors)).toEqual(["mature"]);
  });

  it("keeps posts younger than 72 hours out of formula weights and growth memory", async () => {
    const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000);
    mocks.findPosts.mockResolvedValue([
      ...posts("w", "winner", HIGH_VIEWS),
      ...posts("l", "loser", LOW_VIEWS),
      ...posts("f", "fresh", [10, 10, 10, 10, 10]).map((freshPost) => ({ ...freshPost, publishedAt: hoursAgo(6) })),
    ]);

    const result = await learnBrandGrowth("brand_1");

    expect(result.demotedFormulas).not.toContain("fresh");
    expect(result.updatedWeights?.fresh).toBe(3);
    expect(JSON.stringify(result.memory)).not.toContain("fresh");
  });

  it("rebuilds persona and friction weights instead of stacking on stored context weights", async () => {
    const top = "점집에서 10만원 내고 나온 20대";
    const bottom = "월급이 들어오면 바로 사라지는 사람";
    mocks.findBrand.mockResolvedValue({
      id: "brand_1",
      formulaWeights: "{}",
      brandConfig: JSON.stringify({ qualityProfile: "saju_viral", contextWeights: { personaWeights: { [top]: 10, [bottom]: 1 }, frictionWeights: {} } }),
    });
    mocks.findPosts.mockResolvedValue([
      ...posts("w", "winner", HIGH_VIEWS).map((highPost) => ({ ...highPost, targetAudience: top })),
      ...posts("l", "loser", LOW_VIEWS).map((lowPost) => ({ ...lowPost, targetAudience: bottom })),
    ]);

    const result = await learnBrandGrowth("brand_1");

    expect(result.contextWeights?.personaWeights?.[top]).toBe(4);
    expect(result.contextWeights?.personaWeights?.[bottom]).toBe(2);
  });

  it("keeps New Year posts out of every learner", async () => {
    const savedConfig = async (fixture: ReturnType<typeof post>[]) => {
      mocks.updateBrand.mockClear();
      mocks.findPosts.mockResolvedValue(fixture);
      await learnBrandGrowth("brand_1");
      const saved = mocks.updateBrand.mock.calls[0] as unknown as [{ data: { brandConfig: string; formulaWeights: string; growthMemory: string } }];
      const { data } = saved[0];
      return {
        priors: (JSON.parse(data.brandConfig) as { thompsonPriors: Record<string, unknown> }).thompsonPriors,
        weights: JSON.parse(data.formulaWeights) as Record<string, number>,
        memory: { ...(JSON.parse(data.growthMemory) as Record<string, unknown>), updatedAt: undefined },
      };
    };
    const normal = posts("a", "normal", [100, 120, 140]);

    const withSeason = await savedConfig([...normal, ...posts("n", "ny_ranking", [5000, 5000])]);
    const withoutSeason = await savedConfig(normal);

    expect(Object.keys(withSeason.priors)).toEqual(["normal"]);
    expect(Object.keys(withSeason.weights).filter((id) => id.startsWith("ny_"))).toEqual([]);
    expect(withSeason).toEqual(withoutSeason);
  });

  it("still writes back the score of New Year posts", async () => {
    mocks.findPosts.mockResolvedValue([...posts("a", "normal", [100]), ...posts("n", "ny_ranking", [5000])]);

    await learnBrandGrowth("brand_1");

    const updatedIds = mocks.updatePost.mock.calls.map((call) => (call as unknown as [{ where: { id: string } }])[0].where.id);
    expect(updatedIds.sort()).toEqual(["a0", "n0"]);
  });
});
