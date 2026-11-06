import { describe, expect, it } from "vitest";
import { findEnglishNegationHook, findMissingFirstLineConcept, hasFirstLineSajuConcept } from "./first-line-rules";

describe("hasFirstLineSajuConcept", () => {
  // First lines of cosmicpath posts that reached 300+ views.
  it.each([
    "혹시 '도화'보다 센 '홍염'보다 센 게 뭔지 알아? 바로 '화개'야.",
    "사주에 진술축미(辰戌丑未) 깔려 있는 애들은 주목해.",
    "혹시 겁재보다 센 양인보다 더 센 게 뭔지 알아? 바로 괴강이야.",
    "자격증 5개 있는데 취업 안 되는 애들, 사주 보면 인성이 과하게 깔려 있는 경우 많음.",
    "삼재 들었다고 1년 내내 쫄아 있는 사람 많은데, 12띠 중 3띠가 매년 걸림.",
    "올해 이동수 없다는 말 듣고 기회를 3년 연속 넘긴 사람, 생각보다 많음.",
    "경금 일주에 화개살이 있으면, 재회 후 불안을 사랑으로 착각하기 쉬움",
    "12월 7일 대설부터 흐름이 바뀌는 호랑이띠",
  ])("accepts %s", (line) => {
    expect(hasFirstLineSajuConcept(`${line}\n둘째 줄`)).toBe(true);
  });

  // First lines of the low performers since 10/17 (30-70 views).
  it.each([
    "자격증은 여러 개 땄는데 연봉은 그대로인 사람, 주변에 꼭 한 명 있음.",
    "복채 10만원 내고 '좋은 흐름 온다' 한 줄 듣고 나왔음.",
    "태어난 시간을 모르는 사람이 결정을 제일 오래 미룸.",
    "\"성격 차이\"가 제일 편한 변명인 연애가 있음.",
    "서른살 넘어서 이직 고민하는 사람",
    "상관없이 그냥 질러버린 사람",
  ])("rejects %s", (line) => {
    expect(hasFirstLineSajuConcept(`${line}\n사주로 보면 대운이 바뀌는 중`)).toBe(false);
    expect(findMissingFirstLineConcept(line)).toContain("첫 줄에 사주 개념이 없음");
  });

  it("reads only the root part of a threaded post", () => {
    expect(hasFirstLineSajuConcept("\n\n화개살 있는 애들 특징\n===NEXT===\n답글")).toBe(true);
  });
});

describe("findEnglishNegationHook", () => {
  it.each([
    "Your zodiac animal is not the first thing saju checks.",
    "Saju doesn't have a 29 problem.",
    "Imposter syndrome isn't a confidence problem.",
    "Your sun sign was never the problem.",
  ])("rejects the correction opener %s", (line) => {
    expect(findEnglishNegationHook(`${line}\n\nMore.`)).toContain("Line 1 corrects the reader");
  });

  it.each([
    "Water Day Masters, check in.",
    "Horse years feel everything first.",
    "Sat Nov 7 starts the Pig month in saju.",
    "Once upon a time, the rat rode the ox.",
  ])("accepts %s", (line) => {
    expect(findEnglishNegationHook(`${line}\n\nAnd this isn't line 1.`)).toBeNull();
  });
});
