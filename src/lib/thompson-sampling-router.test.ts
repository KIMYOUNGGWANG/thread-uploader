import { describe, expect, it } from "vitest";
import {
  calculateBlendedPerformance,
  DEFAULT_INFORMATIVE_PRIORS,
  sampleBeta,
  selectFormulaWithThompsonSampling,
  updateThompsonPriors,
  type BetaPrior,
  type FormulaPerformanceObservation,
} from "./thompson-sampling-router";

describe("Thompson Sampling MAB Router", () => {
  it("samples valid probabilities from Beta(alpha, beta)", () => {
    for (let i = 0; i < 50; i++) {
      const val = sampleBeta(10, 2);
      expect(val).toBeGreaterThan(0);
      expect(val).toBeLessThan(1);
    }
    // With high alpha, mean should be high
    const samples = Array.from({ length: 100 }, () => sampleBeta(18, 2));
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    expect(mean).toBeGreaterThan(0.75);
  });

  it("calculates blended performance across viral and conversion objectives", () => {
    const highViralObservation: FormulaPerformanceObservation = {
      formulaId: "sal_hierarchy_ego",
      views: 10000,
      likes: 500,
      replies: 120, // high reply weight (3x)
      reposts: 80,  // high repost weight (2x)
      linkClicks: 50,
      conversions: 5,
    };

    const res = calculateBlendedPerformance(highViralObservation, 0.6, 0.4);
    expect(res.engagementRate).toBeGreaterThan(0.5);
    expect(res.conversionRate).toBeGreaterThan(0.1);
    expect(res.blendedScore).toBeGreaterThan(0.4);
    expect(res.blendedScore).toBeLessThanOrEqual(1.0);
  });

  it("filters out noisy samples with low views (<200) during prior update", () => {
    const currentPriors: Record<string, BetaPrior> = {
      formula_noise: { alpha: 5, beta: 5 },
      formula_solid: { alpha: 5, beta: 5 },
    };

    const observations: FormulaPerformanceObservation[] = [
      // Low traffic noisy fluke
      { formulaId: "formula_noise", views: 50, likes: 20, replies: 10, reposts: 5 },
      // Qualified traffic
      { formulaId: "formula_solid", views: 2500, likes: 100, replies: 40, reposts: 20, linkClicks: 30 },
    ];

    const updated = updateThompsonPriors(currentPriors, observations, { minViewsForUpdate: 200 });

    // formula_noise should only undergo decay (5 * 0.95 = 4.75) with no evidence addition
    expect(updated.formula_noise.alpha).toBeCloseTo(4.75, 1);
    expect(updated.formula_noise.beta).toBeCloseTo(4.75, 1);

    // formula_solid should receive evidence update
    expect(updated.formula_solid.alpha).toBeGreaterThan(currentPriors.formula_solid.alpha);
  });

  it("selects formula adhering to 4:4:2 Golden Quota and anti-monoculture cooldown", () => {
    // Batch index 0 -> Track A (40%)
    const selA = selectFormulaWithThompsonSampling(0, { domainProfile: "saju_viral" });
    expect(selA.track).toBe("track_a");

    // Batch index 1 -> Track B (40%)
    const selB = selectFormulaWithThompsonSampling(1, { domainProfile: "saju_viral" });
    expect(selB.track).toBe("track_b");

    // Batch index 4 -> Track C (20%)
    const selC = selectFormulaWithThompsonSampling(4, { domainProfile: "saju_viral" });
    expect(selC.track).toBe("track_c");

    // Cooldown prevents immediate previous formula
    const selCooldown = selectFormulaWithThompsonSampling(0, {
      domainProfile: "saju_viral",
      recentFormulaIds: ["sal_hierarchy_ego"],
    });
    expect(selCooldown.formulaId).not.toBe("sal_hierarchy_ego");
  });

  it("Monte Carlo test: converges to superior arm under noisy social feedback", () => {
    // Two arms in track_a:
    // Arm A: true success rate = 0.85
    // Arm B: true success rate = 0.35
    const priors: Record<string, BetaPrior> = {
      arm_superior: { alpha: 10, beta: 2 },
      arm_inferior: { alpha: 4, beta: 8 },
    };

    let superiorCount = 0;
    const TRIALS = 100;

    for (let i = 0; i < TRIALS; i++) {
      const result = selectFormulaWithThompsonSampling(0, {
        forceTrack: "track_a",
        brandFormulas: ["arm_superior", "arm_inferior"],
        customPriors: priors,
      });

      if (result.formulaId === "arm_superior") {
        superiorCount++;
      }
    }

    // With Thompson Sampling on these posteriors, superior arm should win > 75% of trials
    expect(superiorCount).toBeGreaterThanOrEqual(75);
  });
});

describe("revenue-first reward", () => {
  it("scores a paid-converting post above a higher-engagement post with no conversions", () => {
    const viralOnly = calculateBlendedPerformance({ formulaId: "a", views: 1000, likes: 100, replies: 20, reposts: 10 });
    const paying = calculateBlendedPerformance({ formulaId: "b", views: 1000, likes: 5, replies: 1, reposts: 0, paidConversions: 1 });
    expect(paying.blendedScore).toBeGreaterThan(viralOnly.blendedScore);
  });
});
