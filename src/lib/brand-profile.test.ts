import { describe, it, expect } from "vitest";
import { resolveBrandProfile, type BrandProfile } from "./brand-profile";

describe("brand-profile resolution", () => {
  it("resolves default CosmicPath KR profile with Korean saju markers", () => {
    const profile = resolveBrandProfile("{}", "cosmicpath", "CosmicPath");
    expect(profile.language).toBe("ko");
    expect(profile.fidelity.identityMarkers).toContain("진술축미");
    expect(profile.fidelity.identityMarkers).toContain("화개살");
    expect(profile.fidelity.supportedFormats).toContain("SINGLE_CARD");
    expect(profile.fidelity.supportedFormats).toContain("CAROUSEL");
  });

  it("resolves CosmicPath Global profile with English astrology markers", () => {
    const profile = resolveBrandProfile("{}", "cosmicpath-global", "CosmicPath Global");
    expect(profile.language).toBe("en");
    expect(profile.fidelity.identityMarkers).toContain("Saturn Return");
    expect(profile.fidelity.identityMarkers).toContain("Scorpio");
  });

  it("allows custom overrides via brandConfig JSON", () => {
    const customConfig = JSON.stringify({
      language: "en",
      persona: "Tech Startup Advisor",
      fidelity: {
        identityMarkers: ["Founder", "CTO", "Bootstrapped"],
        prohibitedPhrases: ["guaranteed 10x"],
        supportedFormats: ["CAROUSEL"],
      },
    });

    const profile = resolveBrandProfile(customConfig, "tech-brand", "Tech Brand");
    expect(profile.persona).toBe("Tech Startup Advisor");
    expect(profile.fidelity.identityMarkers).toEqual(["Founder", "CTO", "Bootstrapped"]);
    expect(profile.fidelity.prohibitedPhrases).toEqual(["guaranteed 10x"]);
    expect(profile.fidelity.supportedFormats).toEqual(["CAROUSEL"]);
  });

  it("validates English viral content using brand profile rules without false positive formal_tone errors", async () => {
    const { checkViralModeFidelity } = await import("./viral-intent-modes");
    const globalProfile = resolveBrandProfile("{}", "cosmicpath-global", "CosmicPath Global");

    const content = `Are you feeling drained by your Saturn Return?
Check whether you are facing a karmic relationship clash or career shift. Save this.`;

    const result = checkViralModeFidelity(content, "identity_profile", {
      isEnglish: globalProfile.language === "en",
      identityMarkers: globalProfile.fidelity.identityMarkers,
    });

    expect(result.pass).toBe(true);
    expect(result.failureCodes).toEqual([]);
  });
});

