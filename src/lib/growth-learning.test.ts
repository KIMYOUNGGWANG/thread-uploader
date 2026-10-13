import { describe, expect, it } from "vitest";
import { buildGrowthMemory, calculatePerformanceScore, computeWeeklyLift, isAutopilotFormula, type GrowthPostInput } from "@/lib/growth-learning";
import { EMPTY_GROWTH_MEMORY } from "@/types/brand";

describe("calculatePerformanceScore", () => {
  it("weights views replies reposts clicks conversions and paid conversions", () => {
    const metrics = {
      views: 1000,
      likes: null,
      replies: 2,
      reposts: 1,
      clicks: 3,
      conversions: 1,
      manualPaidConversions: 1,
    };

    const score = calculatePerformanceScore(metrics);

    // 200 (views) + 80 (replies) + 25 (reposts) + 150 (clicks) + 300 (conversions) + 2500 (paid) = 3255
    expect(score).toBe(3255);
  });
});

describe("isAutopilotFormula", () => {
  const memory = {
    ...EMPTY_GROWTH_MEMORY,
    winners: [
      { dimension: "formula" as const, value: "dilemma", count: 3, avgScore: 900, avgViews: 0, avgLikes: 0, avgReplies: 0, avgReposts: 0 },
      { dimension: "hook" as const, value: "new_formula", count: 3, avgScore: 900, avgViews: 0, avgLikes: 0, avgReplies: 0, avgReposts: 0 },
    ],
  };

  it("auto-queues only formula winners", () => {
    expect(isAutopilotFormula("dilemma", memory)).toBe(true);
    expect(isAutopilotFormula("new_formula", memory)).toBe(false);
    expect(isAutopilotFormula(null, memory)).toBe(false);
    expect(isAutopilotFormula("dilemma", EMPTY_GROWTH_MEMORY)).toBe(false);
  });
});

describe("computeWeeklyLift", () => {
  const now = new Date("2026-10-08T00:00:00Z");
  const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  it("compares the latest mature week against the week before and ignores immature posts", () => {
    const lift = computeWeeklyLift([
      { publishedAt: daysAgo(1), views: 99999, conversions: 99, performanceScore: 99999 }, // < 72h, ignored
      { publishedAt: daysAgo(4), views: 1000, conversions: 2, performanceScore: 300 },
      { publishedAt: daysAgo(12), views: 1000, conversions: 1, performanceScore: 200 },
    ], now);

    expect(lift.current).toEqual({ posts: 1, avgScore: 300, conversionsPer1kViews: 2 });
    expect(lift.previous).toEqual({ posts: 1, avgScore: 200, conversionsPer1kViews: 1 });
    expect(lift.scoreLiftPct).toBe(50);
  });

  it("returns null lift when a week has no evidence", () => {
    expect(computeWeeklyLift([], now).scoreLiftPct).toBeNull();
  });
});

describe("formulaWinners", () => {
  const post = (id: string, formulaId: string, hookType: string, views: number): GrowthPostInput => ({
    id, formulaId, hookType, topic: hookType, targetAudience: null, ctaType: null,
    views, likes: 0, replies: 0, reposts: 0, performanceScore: null,
  });
  // The formula averages its hot and cold posts; three hook+topic pairs above that
  // average (6 patterns) push every formula out of the mixed top-5 winners.
  const posts: GrowthPostInput[] = [
    post("1", "steady", "h1", 2000), post("2", "steady", "h1", 2000),
    post("3", "steady", "h2", 1800), post("4", "steady", "h2", 1800),
    post("5", "steady", "h3", 1600), post("6", "steady", "h3", 1600),
    post("7", "steady", "h4", 200), post("8", "steady", "h4", 200),
    post("9", "steady", "h5", 100), post("10", "steady", "h5", 100),
    post("11", "weak", "h6", 10), post("12", "weak", "h6", 10),
  ];

  it("lists formulas with 2+ posts scoring at or above the brand average", () => {
    const memory = buildGrowthMemory(posts);
    expect(memory.formulaWinners).toEqual(["steady"]);
  });

  it("auto-queues a formula winner even when mixed winners are all hooks", () => {
    const memory = buildGrowthMemory(posts);
    expect(memory.winners.some((winner) => winner.dimension === "formula")).toBe(false);
    expect(isAutopilotFormula("steady", memory)).toBe(true);
    expect(isAutopilotFormula("weak", memory)).toBe(false);
  });
});
