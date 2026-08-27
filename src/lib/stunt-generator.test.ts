import { describe, expect, it } from "vitest";
import { generateAudaciousStunts } from "./stunt-generator";
import { VIRAL_INTENT_MODES, normalizeViralIntentModeId, resolveViralIntentMode } from "./viral-intent-modes";

describe("Roy Lee Stunt Generator & Viral Intent Modes", () => {
  it("includes controversy_stunt and common_enemy in VIRAL_INTENT_MODES", () => {
    const ids = VIRAL_INTENT_MODES.map((m) => m.id);
    expect(ids).toContain("controversy_stunt");
    expect(ids).toContain("common_enemy");
  });

  it("normalizes controversy and enemy_strike legacy keys", () => {
    expect(normalizeViralIntentModeId("controversy")).toBe("controversy_stunt");
    expect(normalizeViralIntentModeId("enemy_strike")).toBe("common_enemy");
  });

  it("resolves viral intent mode correctly", () => {
    const mode = resolveViralIntentMode("controversy_stunt", 0);
    expect(mode.id).toBe("controversy_stunt");
    expect(mode.primaryMetric).toBe("replies");
  });

  it("generates 3 audacious stunt concepts for a product profile", () => {
    const stunts = generateAudaciousStunts(
      "CosmicPath",
      "SaaS Founders",
      "High Customer Acquisition Cost"
    );

    expect(stunts).toHaveLength(3);
    expect(stunts[0].hook).toContain("SaaS Founders");
    expect(stunts[0].hook).toContain("High Customer Acquisition Cost");
    expect(stunts[0].royWarning).toBeTruthy();
    expect(stunts[0].conversionPath).toBeTruthy();
  });
});
