import { describe, expect, it } from "vitest";
import { scoreThreadsPostAlgorithmic } from "./threads-algorithm-scorer";

describe("threads-algorithm-scorer", () => {
  it("scores high on high-tension, interactive, organic posts", () => {
    const post = [
      "20대에 1억 모은 사람보다 센 건 뭘까?",
      "",
      "통장에 돈 많은 것보다 진짜 무서운 건",
      "실패해도 다음 달에 다시 일어설 수 있는 복구력입니다.",
      "",
      "주변에서 본 가장 강한 사람은 어느 쪽이었나요?",
      "1. 무조건 아껴서 2억 모은 사람",
      "2. 다 날려보고도 다시 월 500 찍은 사람",
      "",
      "댓글로 여러분의 생각을 남겨주세요.",
    ].join("\n");

    const result = scoreThreadsPostAlgorithmic(post, "개인적으로는 2번이 더 생명력 있다고 봅니다. 여러분은?");

    expect(result.totalScore).toBeGreaterThanOrEqual(80);
    expect(result.pass).toBe(true);
    expect(result.escapeVelocityProbability).toBeGreaterThan(0.65);
    expect(result.dimensions.hookTension.score).toBeGreaterThanOrEqual(18);
    expect(result.dimensions.conversationDepth.score).toBeGreaterThanOrEqual(18);
    expect(result.dimensions.penaltyRisk.score).toBe(15);
  });

  it("penalizes robotic AI buzzwords and body links", () => {
    const slopPostWithLink = [
      "혁신적인 인공지능 기술의 새로운 지평을 함께 살펴보겠습니다.",
      "",
      "우리의 독보적인 솔루션은 마법 같은 최적화된 가치를 창출합니다.",
      "지금 바로 확인하세요: https://my-cool-link.com",
    ].join("\n");

    const result = scoreThreadsPostAlgorithmic(slopPostWithLink);

    expect(result.totalScore).toBeLessThan(70);
    expect(result.pass).toBe(false);
    expect(result.actionableFixes.some((fix) => fix.includes("본문 링크") || fix.includes("AI 클리셰"))).toBe(true);
  });

  it("penalizes meta policy violation keywords", () => {
    const scamPost = [
      "월 1000만원 무조건 수익 보장하는 로또 1등 비법 알려드립니다.",
      "",
      "1. 계좌 이체",
      "2. 비법 수령",
    ].join("\n");

    const result = scoreThreadsPostAlgorithmic(scamPost);

    expect(result.pass).toBe(false);
    expect(result.dimensions.penaltyRisk.score).toBeLessThanOrEqual(7);
  });

  const FACT_POST = [
    "한국인 10명 중 7명은 자기 시주를 잘못 알고 있음.",
    "",
    "출생 시각을 표준시로만 넣으면 진태양시랑 30분 넘게 어긋나는 경우가 많아서, 일주는 맞아도 시주 글자가 통째로 바뀜.",
    "",
    "시주가 바뀌면 말년운 해석이랑 자식 궁 읽는 기준이 전부 달라짐.",
    "",
    "너는 태어난 시간 정확히 알고 있음?",
  ].join("\n");
  const IDENTITY_POST = [
    "신금 일주는 끊을 때 칼이 아니라 정으로 베임.",
    "판단은 빠른데 인정은 제일 늦게 하는 타입이라, 이미 끝난 관계를 1년씩 끌고 감.",
    "",
    "강점은 한 번 정한 기준을 끝까지 지키는 거고, 맹점은 그 기준이 상대 사정을 못 봄.",
    "",
    "너는 지금 누구를 정 때문에 붙잡고 있음?",
  ].join("\n");

  it("passes fact and identity hooks that end with a direct question instead of numbered choices", () => {
    for (const post of [FACT_POST, IDENTITY_POST]) {
      const result = scoreThreadsPostAlgorithmic(post, "너넨 일주 뭐야? 같은 일주 있으면 이 맹점 맞는지 궁금함.");
      expect(result.dimensions.hookTension.score).toBeGreaterThanOrEqual(17);
      expect(result.dimensions.conversationDepth.score).toBeGreaterThanOrEqual(16);
      expect(result.totalScore).toBeGreaterThanOrEqual(80);
    }
  });

  it("never prescribes the hierarchy hook or numbered choices as a fix", () => {
    const fixes = scoreThreadsPostAlgorithmic("오늘은 날씨가 좋았음.\n\n사주 공부를 조금 했음.").actionableFixes.join(" ");
    expect(fixes).not.toContain("보다 센");
    expect(fixes).not.toContain("1번/2번");
    expect(fixes).not.toContain("선택지");
  });
});

describe("threads-algorithm-scorer english hooks", () => {
  it("rewards research-proven english hooks and choice endings", () => {
    const post = [
      "That Goat birth year on your phone? Probably wrong.",
      "",
      "Korean saju flips the year at Ipchun (Feb 4), not January 1st.",
      "",
      "A) Born before Feb 4",
      "B) Born after Feb 4",
      "",
      "Which one are you?",
    ].join("\n");
    const result = scoreThreadsPostAlgorithmic(post, "Did your animal change too?");
    expect(result.dimensions.hookTension.score).toBeGreaterThanOrEqual(17);
    expect(result.dimensions.conversationDepth.score).toBeGreaterThanOrEqual(20);
  });

  // Global top posts (300-600 views) were declarative; question-only openers sat near 10-20 views.
  it("gives a declarative english hook full hook tension without a question mark", () => {
    const result = scoreThreadsPostAlgorithmic("Your zodiac animal is probably wrong.\n\nSaju flips the year at Ipchun.");
    expect(result.dimensions.hookTension.score).toBe(25);
  });
});
