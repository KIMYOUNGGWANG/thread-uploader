import { describe, expect, it } from "vitest";
import {
  calculateJaccardSimilarity,
  checkAntiRepeatSimilarity,
  checkStructureRepeat,
  extractFirstSentence,
  extractStructureSignature,
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

describe("structure repeat", () => {
  const hierarchyPost = "궁합 점수보다 센 게 일간이고, 일간보다 센 건 잠드는 리듬임.\n1. 맞춘다\n2. 버틴다\n저장해";
  const recentHierarchy = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
      content: hierarchyPost.replace("궁합", `궁합${index}`),
      firstComment: `기록 ${index}`,
    }));

  it("classifies a post's skeleton", () => {
    expect(extractStructureSignature(hierarchyPost, "난 솔직히 1번 골랐다가 망함. 너넨?")).toEqual({
      opener: "hierarchy",
      hasNumberedChoices: true,
      closer: "save",
      commentOpener: "난 솔직히",
    });
    expect(extractStructureSignature("[연애] 신금 일주는 끊을 때 정으로 베임.\n너는 누구 붙잡고 있음?", null)).toEqual({
      opener: "callout",
      hasNumberedChoices: false,
      closer: "other",
      commentOpener: null,
    });
  });

  it("does not call a single incidental comparison a hierarchy", () => {
    expect(extractStructureSignature("남들보다 답장이 늦는 너, 문창귀인 타입임.\n너는 몇 시간 넘으면 서운함?").opener).toBe("callout");
  });

  it("rejects a third post with the same skeleton within the last five", () => {
    const result = checkStructureRepeat(hierarchyPost, "새 댓글 하나", recentHierarchy(2));
    expect(result.isDuplicate).toBe(true);
    expect(result.reason).toContain("같은 틀");
  });

  it("allows a skeleton that appears only once in the last five", () => {
    expect(checkStructureRepeat(hierarchyPost, "새 댓글 하나", recentHierarchy(1)).isDuplicate).toBe(false);
  });

  it("ignores matches older than the window", () => {
    const newer = Array.from({ length: 5 }, (_, index) => ({ content: `신금 일주 이야기 ${index}.\n너는 어떻게 봄`, firstComment: `다른 ${index}` }));
    expect(checkStructureRepeat(hierarchyPost, "새 댓글 하나", [...newer, ...recentHierarchy(2)]).isDuplicate).toBe(false);
  });

  it("rejects a first comment that opens like a recent one", () => {
    const recentPosts = [{ content: "신금 일주는 정으로 베임.\n너는?", firstComment: "난 솔직히 3일 삐졌음" }];
    const result = checkStructureRepeat("한국인 10명 중 7명은 시주를 잘못 앎.\n너는 알고 있음?", "난 솔직히 몰랐음", recentPosts);
    expect(result.isDuplicate).toBe(true);
    expect(result.reason).toContain("난 솔직히");
  });

  it("does not treat two missing first comments as the same opener", () => {
    const recentPosts = [{ content: "신금 일주는 정으로 베임.\n너는?", firstComment: null }];
    expect(checkStructureRepeat("한국인 10명 중 7명은 시주를 잘못 앎.\n너는 알고 있음?", null, recentPosts).isDuplicate).toBe(false);
  });
});
