import { describe, it, expect } from "vitest";
import { calculatePerformanceScore, getPerformanceTier } from "./growth-learning";

describe("Revenue-Weighted Attribution Scoring", () => {
  it("rewards paid conversions (2,500 pts) much higher than passive views", () => {
    const postA_Score = calculatePerformanceScore({
      views: 10000,
      likes: 20,
      replies: 5,
      reposts: 2,
      clicks: 10,
      conversions: 0,
      manualPaidConversions: 0,
    });

    const postB_Score = calculatePerformanceScore({
      views: 1000,
      likes: 5,
      replies: 2,
      reposts: 1,
      clicks: 50,
      conversions: 10,
      manualPaidConversions: 2,
    });

    expect(postB_Score).toBeGreaterThan(postA_Score);
    expect(postB_Score).toBeGreaterThan(10000);
    expect(getPerformanceTier(postB_Score)).toBe("breakout");
  });

  it("calculates accurate tier transitions for revenue signals", () => {
    const basicScore = calculatePerformanceScore({
      views: 100,
      likes: 0,
      replies: 1,
      reposts: 0,
      clicks: 1,
      conversions: 0,
      manualPaidConversions: 0,
    });
    expect(getPerformanceTier(basicScore)).toBe("promising");

    const conversionScore = calculatePerformanceScore({
      views: 100,
      likes: 0,
      replies: 1,
      reposts: 0,
      clicks: 5,
      conversions: 1,
      manualPaidConversions: 0,
    });
    expect(getPerformanceTier(conversionScore)).toBe("strong");
  });
});
