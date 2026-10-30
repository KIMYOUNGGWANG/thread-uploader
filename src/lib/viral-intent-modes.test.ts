import { describe, expect, it } from "vitest";
import {
  checkViralModeFidelity,
  IDENTITY_MARKER_PATTERN,
  normalizeViralIntentModeId,
  resolveViralIntentMode,
  selectViralIntentMode,
  VIRAL_INTENT_MODES, pickClosingFormat, formatViralIntentModePrompt, type ViralIntentModeId,
  ENGLISH_VIRAL_MODE_LABELS, REFERENCE_REPLAY_MODE, referenceReplayMode } from "./viral-intent-modes";
import { getDomainPreset } from "./domain-registry";

describe("mode prompts never ask for invented first-person stories", () => {
  it.each([false, true])("every mode (isEnglish=%s)", (isEnglish) => {
    for (const mode of VIRAL_INTENT_MODES) {
      const prompt = formatViralIntentModePrompt(mode, isEnglish);
      expect(prompt, mode.id).not.toMatch(/본인 경험담으로|실제 겪은 일처럼|raw personal confession|authentic first-person/i);
    }
  });
});

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

  // checkViralModeFidelity reads only the first two lines, and the first-line chart gate rejects a 살·일주 callout
  // on line 1, so each structured mode's rules must say what goes in those two lines (simulated 2026-10-24 refill:
  // 5/9 drops were these three codes).
  it("tells structured modes to put their shape in the first two lines, with no 살·일주 callout on line 1", () => {
    const rules = (id: ViralIntentModeId) => modeById.get(id)?.rules.join(" ") ?? "";
    expect(rules("identity_profile")).not.toContain("1줄에 직설적으로 호명");
    expect(rules("identity_profile")).toContain("둘째 줄");
    expect(rules("concept_hierarchy")).toContain("첫 두 줄");
    expect(rules("relationship_tension")).toContain("첫 두 줄");
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

  it("turns a numbered-choice slot into a question once the numbered-choice cap is hit", () => {
    const formats = Array.from({ length: 6 }, (_, index) => pickClosingFormat(index, "concept_hierarchy", true));
    expect(formats).not.toContain("choices");
    expect(formats[3]).toBe("question");
  });

  it("keeps the 3-choice dilemma on numbered choices whatever the slot", () => {
    for (let index = 0; index < 6; index++) expect(pickClosingFormat(index, "imagination_dilemma")).toBe("choices");
  });
});

describe("winner_replay mode", () => {
  it("resolves winner_replay to its own mode", () => {
    expect(resolveViralIntentMode("winner_replay", 0).id).toBe("winner_replay");
  });

  it("stays out of the standard rotation", () => {
    expect(VIRAL_INTENT_MODES.map((mode) => mode.id)).not.toContain("winner_replay");
  });
});

describe("ref_replay mode", () => {
  it("resolves ref_replay to its own mode and stays out of the standard rotation", () => {
    expect(resolveViralIntentMode("ref_replay", 0).id).toBe("ref_replay");
    expect(VIRAL_INTENT_MODES.map((mode) => mode.id)).not.toContain("ref_replay");
  });

  it("takes the situation and emotional arc but forbids copying details", () => {
    const mode = resolveViralIntentMode("ref_replay", 0);
    expect(mode.instruction).toContain("감정의 흐름");
    expect(mode.rules.some((rule) => rule.includes("고유 디테일은 전부 바꾼다"))).toBe(true);
    expect(mode.rules.some((rule) => rule.includes("소재(인물·상황·사례)도 가져오지 않는다"))).toBe(false);
  });
});

describe("global offer formulas", () => {
  it.each([
    ["synastry_blueprint_offer", "relationship_tension"],
    ["d2c_etsy_offer", "quiet_contrarian"],
  ])("maps %s to %s, not self_classification", (id, mode) => {
    for (const index of [0, 3, 6]) expect(resolveViralIntentMode(id, index).id).toBe(mode);
  });

  it("does not make offer ids campaign-normalizable", () => {
    expect(normalizeViralIntentModeId("d2c_etsy_offer")).toBeNull();
    expect(normalizeViralIntentModeId("synastry_blueprint_offer")).toBeNull();
  });

  it("concept_hierarchy no longer asks for 2-3 saju concepts or the reader's chart", () => {
    const mode = resolveViralIntentMode("concept_hierarchy", 0);
    const text = [mode.instruction, ...mode.rules].join("\n");
    expect(text).not.toMatch(/2~3개|십신|원국/);
    expect(mode.rules).toContain("첫 댓글: 독자가 자기 경험으로 답할 수 있는 질문 한 줄. 링크·홍보 문구는 넣지 않는다.");
  });

  it("keeps first comments and jargon in the lean modes answerable by a reader who does not know saju", () => {
    const identity = VIRAL_INTENT_MODES.find((mode) => mode.id === "identity_profile")?.rules.join("\n") ?? "";
    expect(identity).not.toContain("자기 일주나 살을 꺼내게");
    const beginner = VIRAL_INTENT_MODES.find((mode) => mode.id === "beginner_qa")?.rules.join("\n") ?? "";
    expect(beginner).not.toContain("1~2개");
  });
});

describe("referenceReplayMode", () => {
  it("cosmicpath story keeps today's exact instruction and rules", () => {
    const mode = referenceReplayMode("story", "cosmicpath", "사주·궁합·타이밍");
    expect(mode.id).toBe("ref_replay");
    expect(mode.instruction).toBe("아래 참고 글의 상황(무슨 일이 있었는지)과 감정의 흐름(예: 황당 → 찔림 → 체념)을 가져와, cosmicpath 독자가 자기 일처럼 느낄 새 글을 쓴다. 구조(첫 줄 방식, 줄 구성, 마무리)도 참고하되 그대로 베끼지 않는다.");
    expect(mode.rules).toContain("감정선은 가져오되 결론·시선은 cosmicpath(사주·궁합·타이밍)로 가져온다. 원글의 결론을 반복하지 않는다.");
    expect(REFERENCE_REPLAY_MODE).toEqual(mode); // constant stays the cosmicpath story mode
  });
  it("product brand info mode carries brand angle and no saju words", () => {
    const preset = getDomainPreset("product_growth");
    const mode = referenceReplayMode("info", "catchdex", preset.referenceAngle ?? preset.description);
    expect(mode.id).toBe("ref_replay_info");
    const text = [mode.instruction, ...mode.rules].join("\n");
    expect(text).toContain("catchdex");
    expect(text).toContain(preset.description);
    for (const word of ["사주", "궁합", "운세", "cosmicpath"]) expect(text).not.toContain(word);
  });
  it("saju preset defines referenceAngle; others fall back to description", () => {
    expect(getDomainPreset("saju_viral").referenceAngle).toBe("사주·궁합·타이밍");
    expect(getDomainPreset("product_growth").referenceAngle).toBeUndefined();
  });
  it("resolves ref_replay_info and has an English label", () => {
    expect(resolveViralIntentMode("ref_replay_info", 0).id).toBe("ref_replay_info");
    expect(ENGLISH_VIRAL_MODE_LABELS.ref_replay_info.instruction).toMatch(/link|tool|resource/i);
  });
});
