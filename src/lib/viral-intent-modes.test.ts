import { describe, expect, it } from "vitest";
import {
  selectViralIntentMode,
  normalizeViralIntentModeId,
  resolveViralIntentMode,
} from "./viral-intent-modes";

describe("viral intent mode rotation", () => {
  it("cycles a 28-post sprint into four 7-post mode groups", () => {
    const counts = Array.from({ length: 28 }, (_, index) => selectViralIntentMode(index).id)
      .reduce<Record<string, number>>((result, modeId) => {
        result[modeId] = (result[modeId] ?? 0) + 1;
        return result;
      }, {});

    expect(counts).toEqual({
      self_classification: 7,
      saveable_tool: 7,
      quiet_contrarian: 7,
      friend_share: 7,
    });
  });

  it("resolves modular_audit mode correctly from id or alias", () => {
    expect(normalizeViralIntentModeId("modular_audit")).toBe("modular_audit");
    expect(normalizeViralIntentModeId("modular_7_engine")).toBe("modular_audit");
    const mode = resolveViralIntentMode("modular_audit", 0);
    expect(mode.id).toBe("modular_audit");
    expect(mode.primaryMetric).toBe("saves");
    expect(mode.rules).toContain("댓글에 특정 단어 남기면 DM 발송 등의 Reply-Burden 금지.");
  });
});
