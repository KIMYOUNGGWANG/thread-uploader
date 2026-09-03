import { describe, it, expect } from "vitest";
import { determineNextTrack, selectFormulaWithQuota, QUOTA_TRACKS } from "./quota-bandit-router";

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
        timing_inflection_signs: 10,
        relationship_cutoff_truth: 5,
        reveal: 2,
      },
    });

    expect(result.track).toBe("track_b");
    expect(result.formulaId).toBe("timing_inflection_signs");
    expect(result.isExploration).toBe(false);
  });

  it("avoids recent formulas to prevent repetition (anti-monoculture cooldown)", () => {
    const result = selectFormulaWithQuota(1, { // Index 1 is Track B
      epsilon: 0,
      recentFormulaIds: ["timing_inflection_signs"],
      customWeights: {
        timing_inflection_signs: 10,
        relationship_cutoff_truth: 5,
      },
    });

    expect(result.formulaId).toBe("relationship_cutoff_truth");
  });

  it("selects exploration pattern when MAB is triggered", () => {
    const result = selectFormulaWithQuota(0, {
      epsilon: 1.0, // Force 100% exploration
      explorationPool: ["untested_novel_pattern_x"],
    });

    expect(result.formulaId).toBe("untested_novel_pattern_x");
    expect(result.isExploration).toBe(true);
  });
});
