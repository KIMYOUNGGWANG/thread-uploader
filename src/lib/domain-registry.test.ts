import { describe, expect, it } from "vitest";
import { ENGLISH_HOOK_RULE, findBorrowedYearBoundaryClaim, findFormulaShapeViolation, getDomainPreset, normalizeIpchunSpelling } from "./domain-registry";
import { checkQuality } from "./quality-gate";
import { scoreThreadsPostAlgorithmic } from "./threads-algorithm-scorer";
import { selectFormulaWithThompsonSampling } from "./thompson-sampling-router";

describe("Domain Intelligence Registry", () => {
  it("resolves product_growth preset cleanly", () => {
    const preset = getDomainPreset("product_growth");
    expect(preset.domainId).toBe("product_growth");
    expect(preset.forbiddenCrossDomainTerms).toContain("사주");
    expect(preset.forbiddenCrossDomainTerms).toContain("도화살");
    expect(preset.trackFormulas.track_a.length).toBeGreaterThan(0);
    expect(preset.trackFormulas.track_b.length).toBeGreaterThan(0);
    expect(preset.trackFormulas.track_c.length).toBeGreaterThan(0);
  });

  it("resolves saas_b2b preset cleanly", () => {
    const preset = getDomainPreset("saas_b2b");
    expect(preset.domainId).toBe("saas_b2b");
    expect(preset.forbiddenCrossDomainTerms).toContain("사주");
  });

  it("resolves career_decision preset cleanly", () => {
    const preset = getDomainPreset("career_decision");
    expect(preset.domainId).toBe("career_decision");
    expect(preset.forbiddenCrossDomainTerms).toContain("도화살");
  });

  it("resolves ecommerce_d2c preset cleanly", () => {
    const preset = getDomainPreset("ecommerce_d2c");
    expect(preset.domainId).toBe("ecommerce_d2c");
    expect(preset.forbiddenCrossDomainTerms).toContain("MRR");
  });

  it("ecommerce_d2c uses english-market viral formulas and allows Saju", () => {
    const preset = getDomainPreset("ecommerce_d2c");
    const formulas = [
      ...preset.trackFormulas.track_a,
      ...preset.trackFormulas.track_b,
      ...preset.trackFormulas.track_c,
    ];
    const ids = formulas.map((formula) => formula.id);
    expect(ids).toEqual(expect.arrayContaining([
      "trend_correction",
      "real_sign_boundary",
      "identity_callout",
      "all_twelve_series",
      "two_birthday_compatibility",
      "saturn_reboot_timeline",
    ]));
    // Track A slot (index 0) with a dominant prior must reach the age call-out the active campaign used to skip.
    const priors = Object.fromEntries(ids.map((id) => [id, { alpha: 1, beta: 1000 }]));
    priors.saturn_reboot_timeline = { alpha: 1000, beta: 1 };
    expect(selectFormulaWithThompsonSampling(0, { domainProfile: "ecommerce_d2c", customPriors: priors }).formulaId)
      .toBe("saturn_reboot_timeline");
    for (const formula of formulas) {
      expect(formula.forbiddenKeywords).not.toContain("Saju");
      expect(formula.forbiddenKeywords).toContain("사주");
    }
  });

  it("falls back to the generic product preset, never saju, for a missing or unknown domain", () => {
    expect(getDomainPreset(undefined).domainId).toBe("product_growth");
    expect(getDomainPreset("catchdex").domainId).toBe("product_growth");
  });

  it("verifies saju_viral has the 3 modernized wedges and retired legacy solar distortion", () => {
    const preset = getDomainPreset("saju_viral");
    expect(preset.domainId).toBe("saju_viral");

    // Legacy solar distortion must be completely gone
    const allFormulas = [
      ...preset.trackFormulas.track_a,
      ...preset.trackFormulas.track_b,
      ...preset.trackFormulas.track_c,
    ];
    const formulaIds = allFormulas.map((f) => f.id);
    expect(formulaIds).not.toContain("solar_distortion_truth");

    // New 3 wedges must be present
    expect(formulaIds).toContain("career_mismatch");
    expect(formulaIds).toContain("energy_reset_cycle");
    expect(formulaIds).toContain("multi_engine_audit");

    // Forbidden terms must include legacy stale wedge keywords
    expect(preset.forbiddenCrossDomainTerms).toContain("진태양시");
    expect(preset.forbiddenCrossDomainTerms).toContain("32분");
    expect(preset.forbiddenCrossDomainTerms).toContain("바넘 효과");
  });

  it("describes the saju hierarchy formula without the copied viral sentence or a comment bridge", () => {
    const formulas = Object.values(getDomainPreset("saju_viral").trackFormulas).flat();
    const hierarchy = formulas.find((formula) => formula.id === "concept_hierarchy");

    expect(hierarchy?.instruction).not.toMatch(/2~3개|십신|원국/);
    expect(hierarchy?.instruction).toContain("1개까지");
    expect(hierarchy?.instruction).not.toContain("보다 센 홍염보다 센");
    expect(hierarchy?.instruction).not.toContain("브릿지");
  });

  // "(A)…(B)" came back as literal "A:" / "B:" label lines in published posts.
  it("does not hand the model A/B placeholder labels", () => {
    const formulas = Object.values(getDomainPreset("saju_viral").trackFormulas).flat();
    for (const formula of formulas) expect(formula.instruction).not.toMatch(/\([AB]\)|A보다 B/);
  });

  it("keeps the sal hierarchy formula to one saju concept and a reader-answerable first comment", () => {
    const formulas = Object.values(getDomainPreset("saju_viral").trackFormulas).flat();
    const instruction = formulas.find((formula) => formula.id === "sal_hierarchy_ego")?.instruction ?? "";

    expect(instruction).not.toMatch(/도화.*홍염|백호|괴강|결핍 브릿지/);
    expect(instruction).toContain("1개까지");
    expect(instruction).toContain("보다");
  });
});

describe("ecommerce_d2c batch keeps one claim per formula", () => {
  // The 2026-10-15 refill: three formulas in one batch all wrote this same year-boundary claim.
  const yearBoundaryDraft = "Your zodiac animal is probably wrong.\n\nSaju changes the year at Ipchun (Feb 4), not January 1.\n\nBorn in January? You may be the previous year's animal.";
  const globalFormulas = Object.values(getDomainPreset("ecommerce_d2c").trackFormulas).flat();

  it("lets only real_sign_boundary use the ipchun year-boundary claim", () => {
    expect(findBorrowedYearBoundaryClaim("real_sign_boundary", yearBoundaryDraft)).toBeNull();
    const borrowers = globalFormulas.filter((formula) => formula.id !== "real_sign_boundary");
    expect(borrowers.length).toBeGreaterThan(0);
    for (const formula of borrowers) {
      expect(findBorrowedYearBoundaryClaim(formula.id, yearBoundaryDraft)).toContain("real_sign_boundary");
    }
  });

  // New Year season modes are built on the same claim (Rulings R7/R7b), so they co-own the angle.
  it("lets New Year modes use the year-boundary claim while other formulas still borrow it", () => {
    expect(findBorrowedYearBoundaryClaim("ny_ipchun", "Your zodiac year starts Feb 4")).toBeNull();
    expect(findBorrowedYearBoundaryClaim("ny_monthly", "The 2027 saju year starts at Lichun in February")).toBeNull();
    expect(findBorrowedYearBoundaryClaim("all_twelve_series", "Your zodiac year starts Feb 4")).toContain("real_sign_boundary");
  });

  it("catches the lichun spelling and passes a post on its own formula", () => {
    expect(findBorrowedYearBoundaryClaim("all_twelve_series", "Saju starts the year at lichun.")).not.toBeNull();
    const compatibility = "A Fire Horse and a Water Rat fall fast.\n\nThe pull is real; so is the friction.\n\nSend this to your Rat.";
    expect(findBorrowedYearBoundaryClaim("two_birthday_compatibility", compatibility)).toBeNull();
  });

  // The rule told the model to use wrong/instead, which produced "Is your birth hour actually wrong, instead?".
  it("no longer tells the model to use wrong/instead", () => {
    expect(ENGLISH_HOOK_RULE).not.toMatch(/wrong|instead/);
    expect(ENGLISH_HOOK_RULE).toMatch(/no question mark/);
  });

  it("does not seed a concrete claim in the hook rule every formula shares", () => {
    expect(ENGLISH_HOOK_RULE).not.toMatch(/zodiac|animal|ipchun/i);
    for (const formula of globalFormulas) {
      expect(formula.instruction).not.toMatch(/lichun/i);
    }
  });

  // 2026-10-15: every formula shared one 200-420 char A/B ending, so the 12-line list and the
  // send-it-to-them post came out as the same generic A/B post.
  const twelveDraft = [
    "Your 2027 money luck probably isn't your animal's.",
    "",
    "Rat: collect old debts.",
    "Ox: the slow raise lands.",
    "Tiger: pitch once, big.",
    "Rabbit: side income wins.",
    "Dragon: cancel 3 subs.",
    "Snake: late-year payout.",
    "Horse: wait 48h to buy.",
    "Goat: help first, paid later.",
    "Monkey: switch jobs, not fields.",
    "Rooster: savings finally stick.",
    "Dog: have the family talk.",
    "Pig: cap your giving.",
    "",
    "Saju reads it by element. Save this and find yours.",
  ].join("\n");
  const compatibilityDraft = "A Fire Horse and a Water Rat probably won't burn out.\n\nThe pull is instant. The friction shows up in plans, not feelings.\n\nSaju calls it a clash that still builds.\n\nSend this to your Rat.";
  const abDraft = "Your 2027 money luck probably isn't your animal's.\n\nSaju reads it by element.\n\nA) I save\nB) I spend\nWhich one are you?";
  const formulaById = new Map(globalFormulas.map((formula) => [formula.id, formula]));

  it("gives the 12-line and compatibility formulas their own length and ending", () => {
    for (const id of ["all_twelve_series", "two_birthday_compatibility"]) {
      const instruction = formulaById.get(id)?.instruction ?? "";
      expect(instruction).toContain(ENGLISH_HOOK_RULE);
      expect(instruction).not.toContain("Which one are you?");
      expect(instruction).not.toMatch(/200-420 characters[\s\S]*'A\) '[\s\S]*Which one/);
    }
    expect(formulaById.get("all_twelve_series")?.instruction).toMatch(/exactly 12 lines/);
    expect(formulaById.get("two_birthday_compatibility")?.instruction).toMatch(/send this to that person/);
    expect(formulaById.get("trend_correction")?.instruction).toContain("Which one are you?");
  });

  it("fails drafts that fall back to the generic A/B post", () => {
    expect(findFormulaShapeViolation("all_twelve_series", twelveDraft)).toBeNull();
    expect(findFormulaShapeViolation("all_twelve_series", abDraft)).toContain("Off-shape");
    expect(findFormulaShapeViolation("all_twelve_series", "Rat, Ox and Tiger lead 2027.\n\nSave this.")).toContain("3 of 12");
    expect(findFormulaShapeViolation("two_birthday_compatibility", compatibilityDraft)).toBeNull();
    expect(findFormulaShapeViolation("two_birthday_compatibility", abDraft)).toContain("Off-shape");
    expect(findFormulaShapeViolation("two_birthday_compatibility", compatibilityDraft.replace("Send this to your Rat.", "Which one are you?"))).toContain("send this");
    expect(findFormulaShapeViolation("trend_correction", abDraft)).toBeNull();
  });

  it("lets formula-shaped drafts through the English quality gate", () => {
    expect(twelveDraft.length).toBeLessThan(450);
    for (const draft of [twelveDraft, compatibilityDraft]) {
      expect(checkQuality(draft, "ecommerce_d2c").pass).toBe(true);
    }
  });

  // Dry run 2026-10-15: hooks that follow ENGLISH_HOOK_RULE (not / isn't) failed as "weak hook" + "no contrast".
  it("accepts the not/isn't hooks the shared hook rule asks for", () => {
    const hooks = ["The Rat isn't the one leaking money in 2027.", "In 2027, the money fight isn’t about money.", "Your zodiac animal is not your money sign."];
    for (const hook of hooks) {
      const result = checkQuality(`${hook}\n\nYour Chinese zodiac animal is one pillar of four.\n\nSend this to your Rat.`, "ecommerce_d2c");
      expect(result.reasons.filter((reason) => /훅|Contrast|용어/.test(reason))).toEqual([]);
      expect(result.pass).toBe(true);
    }
  });

  // Drafts under the algorithm score are dropped, so a formula whose shape can't reach 80 would never post.
  it("lets formula-shaped drafts clear the algorithm score", () => {
    for (const draft of [twelveDraft, compatibilityDraft]) {
      expect(scoreThreadsPostAlgorithmic(draft, "Which line hit closest?").totalScore).toBeGreaterThanOrEqual(80);
    }
  });

  it("normalizes lichun to ipchun", () => {
    expect(normalizeIpchunSpelling("Lichun (Feb 4) vs li-chun vs ipchun")).toBe("Ipchun (Feb 4) vs ipchun vs ipchun");
  });
});
