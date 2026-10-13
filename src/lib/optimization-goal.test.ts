import { describe, expect, it } from "vitest";
import {
  calculateGoalReward,
  calculateLearningScore,
  resolveOptimizationGoal,
} from "@/lib/optimization-goal";
import { parseBrandConfig } from "@/types/brand";

const metrics = { views: 5000, likes: 10, replies: 2, reposts: 1, clicks: 0, conversions: 0, manualPaidConversions: 1 };

describe("resolveOptimizationGoal", () => {
  it("defaults to reach and honours an explicit conversion setting", () => {
    expect(resolveOptimizationGoal(parseBrandConfig("{}"))).toBe("reach");
    expect(resolveOptimizationGoal(parseBrandConfig(JSON.stringify({ optimizationGoal: "conversion" })))).toBe("conversion");
    expect(resolveOptimizationGoal(parseBrandConfig(JSON.stringify({ optimizationGoal: "bogus" })))).toBe("reach");
  });
});

describe("calculateLearningScore", () => {
  it("scores by views under reach and by revenue under conversion", () => {
    expect(calculateLearningScore("reach", metrics)).toBe(5000);
    // 1000 (views) + 80 + 25 + 2500 (paid)
    expect(calculateLearningScore("conversion", metrics)).toBe(3605);
    expect(calculateLearningScore("reach", { ...metrics, views: null })).toBe(0);
  });
});

describe("calculateGoalReward", () => {
  const observation = { formulaId: "f", views: 1000, likes: 0, replies: 0, reposts: 0, paidConversions: 1 };

  it("under reach, rewards relative to the brand's median views and caps at double", () => {
    expect(calculateGoalReward("reach", observation, { medianViews: 1000 })).toBe(0.5);
    expect(calculateGoalReward("reach", { ...observation, views: 2000 }, { medianViews: 1000 })).toBe(1);
    expect(calculateGoalReward("reach", { ...observation, views: 100 }, { medianViews: 1000 })).toBe(0.05);
  });

  it("under reach, a paid conversion does not move the reward", () => {
    const withPaid = calculateGoalReward("reach", observation, { medianViews: 1000 });
    const without = calculateGoalReward("reach", { ...observation, paidConversions: 0 }, { medianViews: 1000 });
    expect(withPaid).toBe(without);
  });

  it("under conversion, keeps the revenue-first blended reward", () => {
    const paying = calculateGoalReward("conversion", observation, { medianViews: 1000 });
    const silent = calculateGoalReward("conversion", { ...observation, paidConversions: 0 }, { medianViews: 1000 });
    expect(paying).toBeGreaterThan(silent);
  });
});
