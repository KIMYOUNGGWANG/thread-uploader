import { describe, expect, it } from "vitest";
import { calculatePerformanceScore, computeWeeklyLift, isAutopilotFormula } from "@/lib/growth-learning";
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
