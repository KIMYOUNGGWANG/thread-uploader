import { describe, expect, it } from "vitest";
import {
  buildTwoLineContrastHook,
  buildAdmissionFirstComment,
  buildConversationIgniterComment,
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
  it("generates exactly 4 lines with bio-first closing by default", () => {
    const comment = buildAdmissionFirstComment("본문 내용", {
      topic: "퇴사 판단표",
      linkUrl: "https://cosmicpath.app/timing",
    });

    const lines = comment.split("\n");
    expect(lines).toHaveLength(4);
    // Line 1: Admission starting with 📌
    expect(lines[0]).toMatch(/^📌/);
    // Line 4: Bio guide without raw URL
    expect(lines[3]).toContain("프로필 상단 링크에 남겨둠");
    expect(lines[3]).not.toContain("https://cosmicpath.app/timing");
  });

  it("includes raw linkUrl only when linkPlacement is explicitly firstComment", () => {
    const comment = buildAdmissionFirstComment("본문 내용", {
      topic: "퇴사 판단표",
      linkUrl: "https://cosmicpath.app/timing",
      linkPlacement: "firstComment",
    });

    const lines = comment.split("\n");
    expect(lines).toHaveLength(4);
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

  it("generates authentic English 4-line admission comment with bio-first default", () => {
    const comment = buildAdmissionFirstComment("Why you attract avoidant partners with Venus in Gemini", {
      topic: "Avoidant Attachment",
      linkUrl: "https://www.etsy.com/shop/ByYoungStudio",
    });

    const lines = comment.split("\n");
    expect(lines).toHaveLength(4);
    expect(lines[0]).toMatch(/^📌/);
    // Default bio-first: no raw URLs
    expect(lines[3]).toContain("linked at the top of my profile");
    expect(lines[3]).not.toContain("etsy.com");
  });

  it("generates English 4-line admission comment with direct link when linkPlacement is firstComment", () => {
    const comment = buildAdmissionFirstComment("Why you attract avoidant partners with Venus in Gemini", {
      topic: "Avoidant Attachment",
      linkUrl: "https://www.etsy.com/shop/ByYoungStudio",
      linkPlacement: "firstComment",
    });

    const lines = comment.split("\n");
    expect(lines).toHaveLength(4);
    expect(lines[3]).toContain("etsy.com");
  });
});

describe("buildConversationIgniterComment", () => {
  it("generates 3-choice dilemma spark for lotto and choice formulas", () => {
    const spark = buildConversationIgniterComment("1. 직장 존버\n2. 즉시 퇴사\n3. 치킨집 창업", {
      formulaId: "lotto_zero_friction",
    });
    expect(spark).toMatch(/몇 번|어느 쪽/);
  });

  it("generates ego/identity spark for hierarchy formulas", () => {
    const spark = buildConversationIgniterComment("화개살의 치명적 기운", {
      formulaId: "sal_hierarchy_ego",
      topic: "화개살",
    });
    expect(spark).toMatch(/기운|사주|체감/);
  });

  it("generates fact bomb discussion spark for attack formulas", () => {
    const spark = buildConversationIgniterComment("동경시 32분 오차", {
      formulaId: "fact_bomb_incumbent_attack",
      topic: "출생시간",
    });
    expect(spark).toMatch(/오차|태어난 시|사주/);
  });
});
