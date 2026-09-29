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
});
