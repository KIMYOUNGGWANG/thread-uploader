import { describe, expect, it } from "vitest";
import { getDomainPreset } from "./domain-registry";

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

  it("falls back to saju_viral for undefined domain", () => {
    const preset = getDomainPreset(undefined);
    expect(preset.domainId).toBe("saju_viral");
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
});

