import { describe, expect, it } from "vitest";
import { selectLeanViralMode } from "./lean-mode-selector";
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
