import { describe, expect, it } from "vitest";
import { calculatePerformanceScore, isAutopilotFormula } from "@/lib/growth-learning";
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
