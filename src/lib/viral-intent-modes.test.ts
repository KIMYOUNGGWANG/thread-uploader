import { describe, expect, it } from "vitest";
import {
  checkViralModeFidelity,
  IDENTITY_MARKER_PATTERN,
  normalizeViralIntentModeId,
  resolveViralIntentMode,
  selectViralIntentMode,
  VIRAL_INTENT_MODES,
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

describe("viral mode shapes", () => {
  const modeById = new Map(VIRAL_INTENT_MODES.map((mode) => [mode.id, mode]));

  it("accepts a concept hierarchy with a single comparison", () => {
    const result = checkViralModeFidelity("화개살은 도화살보다 늦게 터지는데 오래 감.\n둘 다 있으면 30대 중반부터 판이 바뀜.", "concept_hierarchy");
    expect(result.failureCodes).not.toContain("missing_hierarchy");
  });

  it("still rejects a concept hierarchy with no comparison", () => {
    const result = checkViralModeFidelity("화개살은 늦게 터지는데 오래 감.\n30대 중반부터 판이 바뀜.", "concept_hierarchy");
    expect(result.failureCodes).toContain("missing_hierarchy");
  });

  it("drops the copied hierarchy sentence from the hierarchy rules", () => {
    expect(modeById.get("concept_hierarchy")?.rules.join(" ")).not.toContain("A보다 센 B보다 센");
  });

  it("gives every lean mode a link-free first-comment direction instead of a bridge", () => {
    for (const id of ["imagination_dilemma", "concept_hierarchy", "identity_profile", "relationship_tension"] as const) {
      const rules = modeById.get(id)?.rules ?? [];
      expect(rules.find((rule) => rule.startsWith("첫 댓글:"))).toContain("링크·홍보 문구는 넣지 않는다");
      expect(rules.join(" ")).not.toContain("브릿지");
    }
  });

  it("keeps numbered choices out of the identity and relationship modes", () => {
    for (const id of ["identity_profile", "relationship_tension"] as const) {
      expect(modeById.get(id)?.rules).toContain("번호 선택지를 쓰지 않고, 독자에게 직접 묻는 한 문장으로 끝낸다.");
    }
  });

  it("exports the identity marker pattern for scorer and anti-repeat reuse", () => {
    expect(IDENTITY_MARKER_PATTERN.test("신금 일주는 정으로 베임")).toBe(true);
  });
});
