import { describe, expect, it } from "vitest";
import {
  LEAN_SPRINT_ALLOCATION,
  VIRAL_INTENT_MODES,
  formatViralIntentModePrompt,
  normalizeViralIntentModeId,
  resolveViralIntentMode,
  selectViralIntentMode,
} from "./viral-intent-modes";
import { scoreThreadsPostAlgorithmic } from "./threads-algorithm-scorer";

describe("Lean 14-Day Viral Sprint Architecture", () => {
  it("enforces 15-post master verified ratio: 4 Scenario Dilemma (300k) : 4 Concept Hierarchy (120k) : 4 Identity Profile (22k) : 3 Relationship Tension (23k)", () => {
    expect(LEAN_SPRINT_ALLOCATION).toHaveLength(15);

    const counts = LEAN_SPRINT_ALLOCATION.reduce<Record<string, number>>((acc, mode) => {
      acc[mode] = (acc[mode] ?? 0) + 1;
      return acc;
    }, {});

    expect(counts.imagination_dilemma).toBe(4);
    expect(counts.concept_hierarchy).toBe(4);
    expect(counts.identity_profile).toBe(4);
    expect(counts.relationship_tension).toBe(3);
  });

  it("rotates accurately when sprintType is lean_15post or lean_14day", () => {
    for (let i = 0; i < 30; i++) {
      const mode = selectViralIntentMode(i, { sprintType: "lean_15post" });
      const expectedId = LEAN_SPRINT_ALLOCATION[i % LEAN_SPRINT_ALLOCATION.length];
      expect(mode.id).toBe(expectedId);
    }
    for (let i = 0; i < 30; i++) {
      const mode = selectViralIntentMode(i, { sprintType: "lean_14day" });
      const expectedId = LEAN_SPRINT_ALLOCATION[i % LEAN_SPRINT_ALLOCATION.length];
      expect(mode.id).toBe(expectedId);
    }
  });

  it("preserves standard backward-compatible rotation when sprintType is omitted", () => {
    // Standard sprint divides by 7
    expect(selectViralIntentMode(0).id).toBe("self_classification");
    expect(selectViralIntentMode(6).id).toBe("self_classification");
    expect(selectViralIntentMode(7).id).toBe("saveable_tool");
    expect(selectViralIntentMode(13).id).toBe("saveable_tool");
    expect(selectViralIntentMode(14).id).toBe("quiet_contrarian");
    expect(selectViralIntentMode(21).id).toBe("friend_share");
  });

  it("normalizes and resolves concept_hierarchy correctly", () => {
    expect(normalizeViralIntentModeId("concept_hierarchy")).toBe("concept_hierarchy");
    const resolved = resolveViralIntentMode("concept_hierarchy", 0);
    expect(resolved.id).toBe("concept_hierarchy");
    expect(resolved.label).toContain("개념 서열 비교");
  });

  it("exposes lintScore in algorithmic prediction result without breaking escapeVelocityProbability contract", () => {
    const post = "도화보다 센 홍염보다 센 게 뭔지 알아? 바로 화개야.\n\n스님도 파계시키는 치명적 매력인데 네가 지금 위계 조직에서 썩고 있을 수도 있어.\n\n어디서 터질지 스스로 체크해봐.";
    const result = scoreThreadsPostAlgorithmic(post, null);

    expect(result.lintScore).toBe(result.totalScore);
    expect(typeof result.escapeVelocityProbability).toBe("number");
    expect(result.escapeVelocityProbability).toBeGreaterThan(0);
    expect(result.escapeVelocityProbability).toBeLessThanOrEqual(1.0);
  });

  it("formats prompt instructions in Korean and English for all 4 verified viral modes", () => {
    const verifiedModes = ["imagination_dilemma", "concept_hierarchy", "identity_profile", "relationship_tension"] as const;

    for (const modeId of verifiedModes) {
      const mode = resolveViralIntentMode(modeId, 0);
      const krPrompt = formatViralIntentModePrompt(mode, false);
      const enPrompt = formatViralIntentModePrompt(mode, true);

      expect(krPrompt).toContain("[바이럴 의도 모드]");
      expect(krPrompt).toContain(mode.label);
      expect(enPrompt).toContain("[Viral Intent Mode]");
      expect(enPrompt).toContain(modeId);
    }
  });
});
