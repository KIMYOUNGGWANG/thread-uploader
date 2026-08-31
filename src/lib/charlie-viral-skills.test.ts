import { describe, expect, it } from "vitest";
import {
  buildTwoLineContrastHook,
  buildAdmissionFirstComment,
} from "@/lib/charlie-viral-skills";

describe("buildTwoLineContrastHook", () => {
  it("enforces max 40 characters for both opening and contrast lines", () => {
    const hook = buildTwoLineContrastHook("이직 타이밍", "회사에서 인정 못 받고 힘들 때");

    expect(hook.opening.length).toBeLessThanOrEqual(40);
    expect(hook.contrast.length).toBeLessThanOrEqual(40);
    expect(hook.combined.split("\n")).toHaveLength(2);
  });

  it("handles long topics safely without exceeding length constraints", () => {
    const longTopic = "엄청나게 길고 복잡하며 끝이 보이지 않는 커리어 정체기와 번아웃 상황";
    const hook = buildTwoLineContrastHook(longTopic, "어떻게 극복할 것인가");

    expect(hook.opening.length).toBeLessThanOrEqual(40);
    expect(hook.contrast.length).toBeLessThanOrEqual(40);
  });
});

describe("buildAdmissionFirstComment", () => {
  it("generates exactly 4 lines with admission, flip, win, and closing", () => {
    const comment = buildAdmissionFirstComment("본문 내용", {
      topic: "퇴사 판단표",
      linkUrl: "https://cosmicpath.app/timing",
    });

    const lines = comment.split("\n");
    expect(lines).toHaveLength(4);
    // Line 1: Admission starting with 📌
    expect(lines[0]).toMatch(/^📌/);
    // Line 4: Contains linkUrl
    expect(lines[3]).toContain("https://cosmicpath.app/timing");
  });

  it("incorporates custom voiceProfile admission style", () => {
    const comment = buildAdmissionFirstComment("본문", {
      topic: "사주 운세",
      voiceProfile: {
        tone: "provocative",
        perspective: "사주 상담가",
        sentenceLength: "short_punchy",
        paragraphStyle: "single_line_breath",
        admissionStyle: "나도 사주 처음 배울 때 이 공식 때문에 망했다.",
        forbiddenPhrases: [],
      },
    });

    const lines = comment.split("\n");
    expect(lines[0]).toContain("나도 사주 처음 배울 때 이 공식 때문에 망했다.");
  });
});
