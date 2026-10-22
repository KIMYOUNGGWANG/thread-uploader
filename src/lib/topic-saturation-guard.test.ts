import { describe, expect, it } from "vitest";
import { findSaturatedTopics, formatSaturationReason, isSituationSaturated, SATURATION_WINDOW } from "@/lib/topic-saturation-guard";

const offsetPost = "한국인 10명 중 7명은 진태양시 30분 오차 때문에 시주를 잘못 알고 있다.";
const otherPost = "이직할지 버틸지 고민될 때 3가지 기준부터 나눠봐.";

describe("findSaturatedTopics", () => {
  it("flags a marker group once recent posts already hit the cap and the candidate repeats it", () => {
    const recent = [offsetPost, otherPost, otherPost];
    expect(findSaturatedTopics("1961년 동경시 32분 오차 얘기 들어봤어?", recent)).toEqual([
      { id: "birth_time_offset", recentHits: 1, maxInRecent: 1 },
    ]);
  });

  it("does not flag when recent posts stay under the cap", () => {
    expect(findSaturatedTopics("1961년 동경시 32분 오차 얘기 들어봤어?", [otherPost, otherPost])).toEqual([]);
  });

  it("does not flag when the candidate itself has no marker", () => {
    expect(findSaturatedTopics(otherPost, [offsetPost, offsetPost, offsetPost])).toEqual([]);
  });

  it("only looks at the most recent window", () => {
    const recent = [...Array.from({ length: SATURATION_WINDOW }, () => otherPost), offsetPost, offsetPost];
    expect(findSaturatedTopics(offsetPost, recent)).toEqual([]);
  });

  it("caps one friction at two of the recent ten situations", () => {
    const friction = "친한 사이라 거절하기 어려운 동업 제안";
    const used = `${friction} 상황에서 관계의 속도가 서로 다른 결정을 내려야 하는 순간`;
    expect(isSituationSaturated(friction, [used, "이직 제안받았는데 밤새 고민될 때 (생활 리듬 차이 맥락)"])).toBe(false);
    expect(isSituationSaturated(friction, [used, null, `퇴사 골든타임 (${friction} 맥락)`])).toBe(true);
    // Only the recent window counts
    expect(isSituationSaturated(friction, [...Array(SATURATION_WINDOW).fill("다른 상황"), used, used])).toBe(false);
  });

  it("formats a reason the retry prompt can act on", () => {
    expect(formatSaturationReason({ id: "birth_time_offset", recentHits: 2, maxInRecent: 1 })).toContain("birth_time_offset");
    expect(formatSaturationReason({ id: "birth_time_offset", recentHits: 2, maxInRecent: 1 })).toContain("2");
  });
});
