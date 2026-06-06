import { describe, expect, it } from "vitest";
import {
  analyzeViralText,
  buildViralMemory,
} from "@/lib/viral-analysis";

describe("analyzeViralText", () => {
  it("detects self-classification mechanics distinctly", () => {
    const analysis = analyzeViralText(
      "지금 연락해도 될지 모르겠다면\nA. 연락 B. 대기 C. 축소 D. 보류 중 가까운 쪽만 체크해."
    );

    expect(analysis.structureType).toBe("자기분류");
    expect(analysis.ctaType).toBe("자기분류 셀프체크");
    expect(analysis.keyTakeaway).toContain("자기분류");
  });

  it("detects saveable tools distinctly", () => {
    const analysis = analyzeViralText(
      "이직 밀기 전 3가지만 체크해.\n1. 에너지 2. 조건 3. 다음 선택지. 저장해두고 흔들릴 때 다시 봐."
    );

    expect(analysis.structureType).toBe("저장형 도구");
    expect(analysis.ctaType).toBe("저장 유도");
    expect(analysis.keyTakeaway).toContain("저장형 도구");
  });
});

describe("buildViralMemory", () => {
  it("recommends participatory mechanics from learned examples", () => {
    const memory = buildViralMemory([
      {
        id: "example_1",
        source: "manual",
        content: "지금 연락 고민이면 A/B/C/D 중 하나만 체크해.",
        viralScore: 90,
        hookType: "질문형 훅",
        topic: "연락",
        emotionalDriver: "불안",
        structureType: "자기분류",
        ctaType: "자기분류 셀프체크",
      },
    ]);

    expect(memory.topPatterns[0]?.recommendation).toContain("자기분류");
    expect(memory.recommendations.join(" ")).toContain("자기분류");
  });
});
