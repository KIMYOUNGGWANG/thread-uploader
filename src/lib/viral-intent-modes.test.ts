import { describe, expect, it } from "vitest";
import {
  checkViralModeFidelity,
  IDENTITY_MARKER_PATTERN,
  normalizeViralIntentModeId,
  resolveViralIntentMode,
  selectViralIntentMode,
  VIRAL_INTENT_MODES, pickClosingFormat } from "./viral-intent-modes";

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

  // Openers from a 2026-10-15 cosmicpath refill that the gate dropped 3/3 while "보다" was the only accepted comparison.
  it("accepts '아니라·아님·뿐·정작' contrasts that drafts use instead of the banned 보다-센 template", () => {
    const hierarchy = checkViralModeFidelity("고백 타이밍을 재다가 놓치는 건 설렘이 아니라 자리임.\n만날 때 편한 감정은 재성 자리에서 나옴.", "concept_hierarchy");
    const demoted = checkViralModeFidelity("새벽 연락 왔다고 설레지 마. 살은 끌림 신호일 뿐임.\n정작 봐야 할 건 상대 원국에서 나를 재성으로 보는지임.", "concept_hierarchy");
    const relationship = checkViralModeFidelity("정리했다던 사람의 새벽 연락, 설렘 아님.\n한쪽만 노력하는 궁합의 신호임.", "relationship_tension");
    expect(hierarchy.failureCodes).not.toContain("missing_hierarchy");
    expect(demoted.failureCodes).not.toContain("missing_hierarchy");
    expect(relationship.failureCodes).not.toContain("missing_relationship_contrast");
  });

  it("still rejects a myth-bust opener that never compares anything", () => {
    const result = checkViralModeFidelity("설렘이 커질수록 빨리 고백해야 한다? 그건 감정 온도만 잰 거임.\n진짜 기준은 헤어진 뒤 불안이 어디로 튀느냐임.", "concept_hierarchy");
    expect(result.failureCodes).toContain("missing_hierarchy");
  });

  it("drops the copied hierarchy sentence from the hierarchy rules", () => {
    expect(modeById.get("concept_hierarchy")?.rules.join(" ")).not.toContain("A보다 센 B보다 센");
  });

  it("gives every lean mode a link-free first-comment direction instead of a bridge", () => {
    for (const id of ["imagination_dilemma", "concept_hierarchy", "identity_profile", "relationship_tension", "beginner_qa"] as const) {
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

  it("requires the beginner Q&A opener to be the reader's question", () => {
    const asked = checkViralModeFidelity("태어난 시간 모르면 사주 못 봐?\n결론부터, 볼 수 있음. 일주까지는 시간 없이 나옴.", "beginner_qa");
    const told = checkViralModeFidelity("태어난 시간 몰라도 사주 볼 수 있음.\n일주까지는 시간 없이 나옴.", "beginner_qa");
    expect(asked.pass).toBe(true);
    expect(told.failureCodes).toContain("missing_beginner_question");
    expect(normalizeViralIntentModeId("beginner_qa")).toBe("beginner_qa");
  });

  it("exports the identity marker pattern for scorer and anti-repeat reuse", () => {
    expect(IDENTITY_MARKER_PATTERN.test("신금 일주는 정으로 베임")).toBe(true);
  });
});

describe("pickClosingFormat", () => {
  it("rotates closings so questions and choices outnumber plain statements", () => {
    const formats = Array.from({ length: 12 }, (_, index) => pickClosingFormat(index, "concept_hierarchy"));
    expect(formats.filter((format) => format === "question")).toHaveLength(6);
    expect(formats.filter((format) => format === "statement")).toHaveLength(4);
    expect(formats.filter((format) => format === "choices")).toHaveLength(2);
  });

  it("keeps the 3-choice dilemma on numbered choices whatever the slot", () => {
    for (let index = 0; index < 6; index++) expect(pickClosingFormat(index, "imagination_dilemma")).toBe("choices");
  });
});
