import { describe, it, expect } from "vitest";
import { determineNextTrack, selectFormulaWithQuota, applyHardWeightCap } from "./quota-bandit-router";

describe("4:4:2 Quota & MAB Router", () => {
  it("enforces exact 4:4:2 track sequence over 10 iterations", () => {
    const tracks = Array.from({ length: 10 }, (_, i) => determineNextTrack(i));
    const countA = tracks.filter((t) => t === "track_a").length;
    const countB = tracks.filter((t) => t === "track_b").length;
    const countC = tracks.filter((t) => t === "track_c").length;

    expect(countA).toBe(4);
    expect(countB).toBe(4);
    expect(countC).toBe(2);
  });

  it("prioritizes highest weighted formula within track during exploitation", () => {
    const result = selectFormulaWithQuota(1, { // Index 1 is Track B
      epsilon: 0, // Force 100% exploitation
      customWeights: {
        talent_reality_check: 10,
        wealth_vault_unlock: 5,
        reveal: 2,
      },
    });

    expect(result.track).toBe("track_b");
    expect(result.formulaId).toBe("talent_reality_check");
    expect(result.isExploration).toBe(false);
  });

  it("avoids recent formulas to prevent repetition (anti-monoculture cooldown)", () => {
    const result = selectFormulaWithQuota(1, { // Index 1 is Track B
      epsilon: 0,
      recentFormulaIds: ["talent_reality_check"],
      customWeights: {
        talent_reality_check: 10,
        wealth_vault_unlock: 5,
      },
    });

    expect(result.formulaId).toBe("wealth_vault_unlock");
  });

  it("selects exploration pattern when MAB is triggered", () => {
    const result = selectFormulaWithQuota(0, {
      epsilon: 1.0, // Force 100% exploration
      explorationPool: ["untested_novel_pattern_x"],
    });

    expect(result.formulaId).toBe("untested_novel_pattern_x");
    expect(result.isExploration).toBe(true);
  });

  it("applies hard cap on oversized custom weights to prevent single formula monopoly", () => {
    const formulas = ["formula_a", "formula_b", "formula_c"];
    const extremeWeights = {
      formula_a: 100, // 90%+ monopoly attempt
      formula_b: 5,
      formula_c: 5,
    };
    const capped = applyHardWeightCap(formulas, extremeWeights, 0.35);

    // Total was 110. Max allowed is 110 * 0.35 = 38.5
    expect(capped.formula_a).toBeLessThan(40);
    expect(capped.formula_a).toBeCloseTo(38.5, 1);
    expect(capped.formula_b).toBe(5);
  });

  it("strictly avoids repeating the immediately previous formula even when all formulas are in recent list", () => {
    const trackBFormulas = ["talent_reality_check", "wealth_vault_unlock", "destiny_partner_sign", "solar_distortion_truth"];
    const result = selectFormulaWithQuota(1, { // Track B
      epsilon: 0,
      recentFormulaIds: trackBFormulas, // all are in history, but solar_distortion_truth is immediately previous
      brandFormulas: trackBFormulas,
      customWeights: {
        solar_distortion_truth: 100, // even if it has massive weight
      },
    });

    expect(result.formulaId).not.toBe("solar_distortion_truth");
  });
});
