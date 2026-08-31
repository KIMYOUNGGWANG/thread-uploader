import { describe, expect, it } from "vitest";
import { computeAdaptiveFormulaWeights, type PostPerformanceRecord } from "@/lib/growth-feedback-loop";

describe("computeAdaptiveFormulaWeights", () => {
  it("promotes top performing formulas and demotes bottom performing formulas", () => {
    const currentWeights = {
      formula_a: 3,
      formula_b: 3,
      formula_c: 3,
      formula_d: 3,
      formula_e: 3,
    };

    const knownFormulaIds = ["formula_a", "formula_b", "formula_c", "formula_d", "formula_e"];

    const posts: PostPerformanceRecord[] = [
      // formula_a: High performance
      { id: "1", formulaId: "formula_a", performanceScore: 1200, views: 5000, replies: 50, reposts: 20 },
      { id: "2", formulaId: "formula_a", performanceScore: 900, views: 4000, replies: 40, reposts: 15 },

      // formula_b: Medium-high
      { id: "3", formulaId: "formula_b", performanceScore: 500, views: 2000, replies: 20, reposts: 8 },
      { id: "4", formulaId: "formula_b", performanceScore: 450, views: 1800, replies: 18, reposts: 6 },

      // formula_c: Medium
      { id: "5", formulaId: "formula_c", performanceScore: 300, views: 1000, replies: 10, reposts: 4 },
      { id: "6", formulaId: "formula_c", performanceScore: 320, views: 1100, replies: 11, reposts: 5 },

      // formula_d: Medium-low
      { id: "7", formulaId: "formula_d", performanceScore: 150, views: 600, replies: 5, reposts: 2 },
      { id: "8", formulaId: "formula_d", performanceScore: 140, views: 550, replies: 4, reposts: 1 },

      // formula_e: Low performance
      { id: "9", formulaId: "formula_e", performanceScore: 20, views: 100, replies: 0, reposts: 0 },
      { id: "10", formulaId: "formula_e", performanceScore: 30, views: 120, replies: 1, reposts: 0 },
    ];

    const result = computeAdaptiveFormulaWeights(currentWeights, posts, knownFormulaIds, {
      minSamplesPerFormula: 2,
      promotionStep: 1,
      demotionStep: 1,
    });

    expect(result.promotedFormulas).toContain("formula_a");
    expect(result.demotedFormulas).toContain("formula_e");

    // formula_a weight increased from 3 -> 4
    expect(result.updatedWeights["formula_a"]).toBe(4);
    // formula_e weight decreased from 3 -> 2
    expect(result.updatedWeights["formula_e"]).toBe(2);
    // formula_c remains unchanged at 3
    expect(result.updatedWeights["formula_c"]).toBe(3);
  });

  it("respects minWeight and maxWeight boundaries", () => {
    const currentWeights = {
      formula_top: 10,
      formula_bottom: 1,
    };

    const knownFormulaIds = ["formula_top", "formula_bottom"];

    const posts: PostPerformanceRecord[] = [
      { id: "1", formulaId: "formula_top", performanceScore: 1000, views: 5000, replies: 50, reposts: 20 },
      { id: "2", formulaId: "formula_top", performanceScore: 900, views: 4000, replies: 40, reposts: 15 },
      { id: "3", formulaId: "formula_bottom", performanceScore: 10, views: 100, replies: 0, reposts: 0 },
      { id: "4", formulaId: "formula_bottom", performanceScore: 15, views: 110, replies: 0, reposts: 0 },
    ];

    const result = computeAdaptiveFormulaWeights(currentWeights, posts, knownFormulaIds, {
      minSamplesPerFormula: 2,
      minWeight: 1,
      maxWeight: 10,
    });

    expect(result.updatedWeights["formula_top"]).toBe(10); // Capped at 10
    expect(result.updatedWeights["formula_bottom"]).toBe(1); // Floored at 1
  });

  it("skips formulas with insufficient samples", () => {
    const currentWeights = {
      formula_single: 3,
      formula_other: 3,
    };

    const posts: PostPerformanceRecord[] = [
      { id: "1", formulaId: "formula_single", performanceScore: 2000, views: 10000, replies: 100, reposts: 50 },
    ];

    const result = computeAdaptiveFormulaWeights(currentWeights, posts, ["formula_single", "formula_other"], {
      minSamplesPerFormula: 2,
    });

    expect(result.promotedFormulas).toHaveLength(0);
    expect(result.demotedFormulas).toHaveLength(0);
    expect(result.updatedWeights["formula_single"]).toBe(3);
  });
});
