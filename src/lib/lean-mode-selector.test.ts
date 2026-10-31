import { describe, expect, it } from "vitest";
import { getDomainPreset } from "./domain-registry";
import { isLeanSprintRun, selectCampaignFormulaForViralMode, selectLeanViralMode } from "./lean-mode-selector";
import { resolveViralIntentMode, selectViralIntentMode, VIRAL_INTENT_MODES } from "./viral-intent-modes";

const LEAN_IDS = [
  "imagination_dilemma", "concept_hierarchy", "identity_profile", "relationship_tension", "beginner_qa",
  "cost_loss_punch", "wealth_vault_unlock", "talent_reality_check", "fact_bomb_incumbent_attack",
];

describe("selectLeanViralMode", () => {
  it("keeps the fixed lean allocation when no priors are learned yet", () => {
    for (let index = 0; index < 15; index++) {
      expect(selectLeanViralMode(index, [], undefined, []).id)
        .toBe(selectViralIntentMode(index, { sprintType: "lean_15post" }).id);
    }
  });

  it("follows learned priors instead of the fixed rotation", () => {
    const priors = Object.fromEntries(LEAN_IDS.map((id) => [id, { alpha: 1, beta: 1000 }]));
    priors.relationship_tension = { alpha: 1000, beta: 1 };
    // Index 0 is imagination_dilemma in the fixed allocation; learning must override it.
    expect(selectLeanViralMode(0, [], priors, []).id).toBe("relationship_tension");
  });

  it("lets learned priors pick the beginner Q&A arm", () => {
    const priors = Object.fromEntries(LEAN_IDS.map((id) => [id, { alpha: 1, beta: 1000 }]));
    priors.beginner_qa = { alpha: 1000, beta: 1 };
    expect(selectLeanViralMode(0, [], priors, []).id).toBe("beginner_qa");
  });

  it("never repeats the immediately previous arm", () => {
    const priors = Object.fromEntries(LEAN_IDS.map((id) => [id, { alpha: 1, beta: 1000 }]));
    priors.relationship_tension = { alpha: 1000, beta: 1 };
    const mode = selectLeanViralMode(0, [], priors, ["relationship_tension"]);
    expect(mode.id).not.toBe("relationship_tension");
    expect(LEAN_IDS).toContain(mode.id);
  });

  it("lets learned priors pick each breakout-shape arm with its registry formula", () => {
    const formulas = Object.values(getDomainPreset("saju_viral").trackFormulas).flat();
    for (const id of ["cost_loss_punch", "wealth_vault_unlock", "talent_reality_check", "fact_bomb_incumbent_attack"]) {
      const priors = Object.fromEntries(LEAN_IDS.map((arm) => [arm, { alpha: 1, beta: 1000 }]));
      priors[id] = { alpha: 1000, beta: 1 };
      const mode = selectLeanViralMode(0, formulas, priors, []);
      expect(mode.id).toBe(id);
      expect(resolveViralIntentMode(id, 0).id).toBe(id);
      expect(selectCampaignFormulaForViralMode(formulas, mode).instruction).not.toBe(mode.instruction);
    }
  });

  it("gives the unproven hit arms most picks against the learned arms, and lets their own posts take over", () => {
    // Means and evidence of the cosmicpath priors on 2026-10-31; the hit arms have no posts yet.
    const learned = {
      concept_hierarchy: { alpha: 55, beta: 25 },
      identity_profile: { alpha: 29.5, beta: 13.4 },
      relationship_tension: { alpha: 19.7, beta: 8.5 },
      imagination_dilemma: { alpha: 22.8, beta: 11.5 },
      beginner_qa: { alpha: 4.8, beta: 3.3 },
    };
    const hitIds = LEAN_IDS.slice(5);
    const share = (priors: Record<string, { alpha: number; beta: number }>, ids: string[]) => {
      let hits = 0;
      for (let i = 0; i < 3000; i++) if (ids.includes(selectLeanViralMode(0, [], priors, []).id)) hits++;
      return hits / 3000;
    };
    expect(share(learned, hitIds)).toBeGreaterThan(0.55);
    // 10 flopped posts on one hit arm push it below the learned arms despite the head start.
    expect(share({ ...learned, cost_loss_punch: { alpha: 2.5, beta: 14 } }, ["cost_loss_punch"])).toBeLessThan(0.05);
  });

  it("keeps the standard rotation unchanged for non-lean brands", () => {
    expect(VIRAL_INTENT_MODES).toHaveLength(12);
  });

  it("offers winner_replay only when a source is available", () => {
    const priors = { winner_replay: { alpha: 1000, beta: 1 } };
    expect(selectLeanViralMode(0, [], priors, [], true).id).toBe("winner_replay");
    expect(selectLeanViralMode(0, [], priors, [], false).id).not.toBe("winner_replay");
  });
});

describe("selectLeanViralMode exclusion", () => {
  it("skips an excluded mode even with a dominant prior", () => {
    const priors = { imagination_dilemma: { alpha: 1000, beta: 1 } };
    for (let i = 0; i < 20; i++) {
      expect(selectLeanViralMode(0, [], priors, [], false, ["imagination_dilemma"]).id).not.toBe("imagination_dilemma");
    }
  });

  it("skips an excluded fixed-allocation mode when no priors are learned", () => {
    // Index 0 is imagination_dilemma in the fixed allocation.
    expect(selectLeanViralMode(0, [], undefined, [], false, ["imagination_dilemma"]).id).not.toBe("imagination_dilemma");
  });

  it("ignores the exclusion when it would empty the pool", () => {
    const priors = { imagination_dilemma: { alpha: 1000, beta: 1 } };
    expect(LEAN_IDS).toContain(selectLeanViralMode(0, [], priors, [], false, LEAN_IDS).id);
  });
});

describe("isLeanSprintRun", () => {
  it("runs the lean sprint only on the saju profile it was tuned on", () => {
    expect(isLeanSprintRun("saju_viral")).toBe(true);
    for (const profile of ["ecommerce_d2c", "product_growth", "saas_b2b", "career_decision", undefined]) {
      expect(isLeanSprintRun(profile)).toBe(false);
    }
  });
});
