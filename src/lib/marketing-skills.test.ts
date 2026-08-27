import { describe, expect, it } from "vitest";
import {
  HOOK_ARCHETYPES,
  CONTENT_PILLARS,
  formatMarketingSkillsPrompt,
  validateAntiSlop,
} from "./marketing-skills";

describe("marketing-skills", () => {
  it("defines all 4 hook archetypes with templates and examples", () => {
    expect(Object.keys(HOOK_ARCHETYPES)).toEqual([
      "curiosity",
      "story",
      "value",
      "contrarian",
    ]);
    expect(HOOK_ARCHETYPES.curiosity.templates.length).toBeGreaterThan(0);
    expect(HOOK_ARCHETYPES.contrarian.examples.length).toBeGreaterThan(0);
  });

  it("defines all 5 content pillars with ratios totaling 100%", () => {
    expect(Object.keys(CONTENT_PILLARS)).toEqual([
      "insight",
      "story",
      "education",
      "opinion",
      "promotion",
    ]);
    const totalRatio = Object.values(CONTENT_PILLARS).reduce((acc, p) => acc + p.targetRatio, 0);
    expect(Math.round(totalRatio * 100)).toBe(100);
  });

  it("formats prompt context with selected hook and pillar", () => {
    const prompt = formatMarketingSkillsPrompt({
      hookArchetype: "contrarian",
      pillar: "insight",
    });

    expect(prompt).toContain("Corey Haines 마케팅 지능 프레임워크");
    expect(prompt).toContain("상식 뒤집기/역발상 훅");
    expect(prompt).toContain("업계 인사이트");
    expect(prompt).toContain("Clarity Over Cleverness");
  });

  it("fails Anti-Slop check if banned buzzwords or excessive exclamation marks exist", () => {
    const badCopy = "이것은 정말 혁신적인 차세대 올인원 솔루션입니다!!! 엄청난 결과를 약속합니다!";
    const result = validateAntiSlop(badCopy);

    expect(result.pass).toBe(false);
    expect(result.score).toBeLessThan(7);
    expect(result.issues.some((i) => i.includes("느낌표"))).toBe(true);
    expect(result.issues.some((i) => i.includes("혁신적인"))).toBe(true);
  });

  it("passes Anti-Slop check for clear, specific, grounded copy", () => {
    const goodCopy = "견적서 작성 시간을 주 4시간에서 5분으로 줄였습니다. 복잡한 툴 대신 3개 항목만 남겼습니다.";
    const result = validateAntiSlop(goodCopy);

    expect(result.pass).toBe(true);
    expect(result.score).toBe(10);
    expect(result.issues.length).toBe(0);
  });
});
