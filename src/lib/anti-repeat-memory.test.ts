import { describe, expect, it } from "vitest";
import {
  calculateJaccardSimilarity,
  checkAntiRepeatSimilarity,
  extractFirstSentence,
  formatAntiRepeatContext,
} from "./anti-repeat-memory";

describe("anti-repeat-memory", () => {
  it("extracts first sentence cleanly", () => {
    expect(extractFirstSentence("[퇴사 고민] 이직할지 버틸지 모르겠다면 지금 당장 체크해봐. 다음 내용입니다."))
      .toBe("이직할지 버틸지 모르겠다면 지금 당장 체크해봐.");
    expect(extractFirstSentence("타이밍은 느낌이 아니라 반복되는 신호다!\n다음 줄"))
      .toBe("타이밍은 느낌이 아니라 반복되는 신호다!");
  });

  it("calculates Jaccard word similarity accurately", () => {
    const textA = "이직할지 버틸지 모를 때 확인해야 할 3가지 조건";
    const textB = "이직할지 버틸지 모를 때 꼭 체크할 3가지 조건";
    const sim = calculateJaccardSimilarity(textA, textB);
    expect(sim).toBeGreaterThan(0.6);

    const textC = "완전히 다른 주제인 주식 투자와 부동산 이야기";
    const lowSim = calculateJaccardSimilarity(textA, textC);
    expect(lowSim).toBeLessThan(0.1);
  });

  it("formats anti-repeat prompt context with recent posts", () => {
    const recentPosts = [
      {
        content: "이직할지 버틸지 고민이라면 3칸 체크부터 해봐.\nA. 버팀형 B. 이동형",
        topic: "이직 타이밍",
        hookType: "질문형 훅",
      },
    ];

    const context = formatAntiRepeatContext(recentPosts, 5);
    expect(context).toContain("최근 작성된 1개 포스트 목록입니다.");
    expect(context).toContain("이직 타이밍");
    expect(context).toContain("질문형 훅");
    expect(context).toContain("[안티 리피트 필수 지침]");
  });

  it("flags candidate post if its first sentence is too similar to a recent post", () => {
    const recentPosts = [
      { content: "이직할지 버틸지 모를 때 확인해야 할 3가지 체크리스트" },
      { content: "연봉 협상에서 절대로 하지 말아야 할 실수" },
    ];

    const duplicateCandidate = "이직할지 버틸지 모를 때 확인해야 할 3가지 선택지입니다.";
    const check = checkAntiRepeatSimilarity(duplicateCandidate, recentPosts);

    expect(check.isDuplicate).toBe(true);
    expect(check.matchedIndex).toBe(0);
    expect(check.reason).toContain("첫 문장 훅 유사도");
  });

  it("passes candidate post if angle and content are distinct", () => {
    const recentPosts = [
      { content: "이직할지 버틸지 모를 때 확인해야 할 3가지 체크리스트" },
    ];

    const distinctCandidate = "팀장과의 갈등이 반복될 때 감정보다 업무 로그를 먼저 남겨야 하는 이유.";
    const check = checkAntiRepeatSimilarity(distinctCandidate, recentPosts);

    expect(check.isDuplicate).toBe(false);
  });
});
