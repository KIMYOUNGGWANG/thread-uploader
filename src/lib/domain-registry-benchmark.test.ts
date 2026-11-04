import { describe, expect, it } from "vitest";
import { findBorrowedYearBoundaryClaim, findFormulaShapeViolation, getDomainPreset } from "@/lib/domain-registry";
import { resolveViralIntentMode } from "@/lib/viral-intent-modes";

describe("global benchmark formulas (2026-11-04)", () => {
  const preset = getDomainPreset("ecommerce_d2c");
  const all = Object.values(preset.trackFormulas).flat();

  it("adds the four formulas and lowers the correction formulas", () => {
    for (const id of ["element_bridge", "check_in", "sky_now", "zodiac_lore"]) {
      const formula = all.find((f) => f.id === id);
      expect(formula?.instruction).toContain("Romanize any Korean term");
      expect(resolveViralIntentMode(id, 0).id).toBe("friend_share");
    }
    expect(all.find((f) => f.id === "trend_correction")?.weight).toBe(2);
    expect(all.find((f) => f.id === "real_sign_boundary")?.weight).toBe(2);
  });

  it("checks each shape without demanding the A/B ending", () => {
    expect(findFormulaShapeViolation("check_in", "Water Day Masters, check in.\n\nYou carry everyone.\n\nReply with your element.")).toBeNull();
    expect(findFormulaShapeViolation("check_in", "Water Day Masters carry everyone.")).toContain("check in");
    expect(findFormulaShapeViolation("sky_now", "Nov 7 starts the Pig month in Korean saju.\n\nIf this week feels heavy, that tracks.")).toBeNull();
    expect(findFormulaShapeViolation("sky_now", "Winter energy is coming.\n\nRest.\n\nIt tracks.")).toContain("date");
    expect(findFormulaShapeViolation("element_bridge", "Fire signs are loud.\n\nA) yes\nB) no")).toContain("A) ");
    expect(findFormulaShapeViolation("zodiac_lore", "The cat missed the race.\n\nIt was a legend.")).toBeNull();
  });

  it("lets sky_now name the Ipchun year turn", () => {
    expect(findBorrowedYearBoundaryClaim("sky_now", "Ipchun on Feb 4 starts the Fire Goat year.")).toBeNull();
    expect(findBorrowedYearBoundaryClaim("check_in", "Born before Ipchun? You may be the year before.")).not.toBeNull();
  });
});
