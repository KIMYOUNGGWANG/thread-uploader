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
      { dimension: "formula" as const, value: "dilemma", count: 5, avgScore: 900, medianScore: 900, avgViews: 0, avgLikes: 0, avgReplies: 0, avgReposts: 0 },
      { dimension: "hook" as const, value: "new_formula", count: 5, avgScore: 900, medianScore: 900, avgViews: 0, avgLikes: 0, avgReplies: 0, avgReposts: 0 },
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
  const repeat = (count: number, formulaId: string, hookType: string, views: number) =>
    Array.from({ length: count }, (_, index) => post(`${formulaId}-${hookType}-${index}`, formulaId, hookType, views));
  // "steady" has more cold than hot posts, so its median (40) beats the brand median (20) but
  // three hot hook+topic pairs above it (6 patterns) push every formula out of the mixed top-5 winners.
  const posts: GrowthPostInput[] = [
    ...repeat(5, "steady", "h1", 2000), ...repeat(5, "steady", "h2", 1800), ...repeat(5, "steady", "h3", 1700),
    ...repeat(8, "steady", "h4", 200), ...repeat(8, "steady", "h5", 100),
    ...repeat(20, "weak", "h6", 10),
  ];

  it("lists formulas with 5+ posts at or above the brand median", () => {
    const memory = buildGrowthMemory(posts);
    expect(memory.formulaWinners).toEqual(["steady"]);
  });

  // Regression: 2026-10 cosmicpath crowned controversy_stunt (42,329 + 115 views) and a CTA whose
  // mean was 6,123 views but median 79. One breakout or two lucky posts must not prove a pattern.
  it("ignores patterns carried by one breakout post or too few posts", () => {
    const memory = buildGrowthMemory([
      ...repeat(10, "steady", "x", 150),
      post("s1", "stunt", "x", 42329), post("s2", "stunt", "x", 115), post("s3", "stunt", "x", 80),
      post("s4", "stunt", "x", 60), post("s5", "stunt", "x", 50),
      post("l1", "lucky", "x", 9000), post("l2", "lucky", "x", 8000),
    ]);

    expect(memory.formulaWinners).toEqual(["steady"]);
    expect(memory.winners.map((winner) => winner.value)).not.toContain("stunt");
    expect(memory.winners.map((winner) => winner.value)).not.toContain("lucky");
    expect(memory.weakSignals.map((weak) => weak.value)).toContain("stunt");
    expect(isAutopilotFormula("stunt", memory)).toBe(false);
    expect(isAutopilotFormula("lucky", memory)).toBe(false);
  });

  it("auto-queues a formula winner even when mixed winners are all hooks", () => {
    const memory = buildGrowthMemory(posts);
    expect(memory.winners.some((winner) => winner.dimension === "formula")).toBe(false);
    expect(isAutopilotFormula("steady", memory)).toBe(true);
    expect(isAutopilotFormula("weak", memory)).toBe(false);
  });
});
