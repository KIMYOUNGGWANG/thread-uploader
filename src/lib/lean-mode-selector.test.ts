import { describe, expect, it } from "vitest";
import { isLeanSprintRun, selectLeanViralMode } from "./lean-mode-selector";
import { selectViralIntentMode } from "./viral-intent-modes";

const LEAN_IDS = ["imagination_dilemma", "concept_hierarchy", "identity_profile", "relationship_tension"];

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

  it("never repeats the immediately previous arm", () => {
    const priors = Object.fromEntries(LEAN_IDS.map((id) => [id, { alpha: 1, beta: 1000 }]));
    priors.relationship_tension = { alpha: 1000, beta: 1 };
    const mode = selectLeanViralMode(0, [], priors, ["relationship_tension"]);
    expect(mode.id).not.toBe("relationship_tension");
    expect(LEAN_IDS).toContain(mode.id);
  });
});

describe("isLeanSprintRun", () => {
  const base = { brandSlug: "cosmicpath-global", domainProfile: "saju_viral", campaignId: null, experimentId: null, productName: "CosmicPath Global", count: 6 };

  it("keeps the Korean lean sprint for cosmic-named Korean brands", () => {
    expect(isLeanSprintRun(base)).toBe(true);
    expect(isLeanSprintRun({ ...base, brandSlug: "cosmicpath", productName: "CosmicPath" })).toBe(true);
  });

  it("never runs the Korean lean sprint on the English D2C profile", () => {
    expect(isLeanSprintRun({ ...base, domainProfile: "ecommerce_d2c" })).toBe(false);
    expect(isLeanSprintRun({ ...base, domainProfile: "ecommerce_d2c", count: 15 })).toBe(false);
  });
});
