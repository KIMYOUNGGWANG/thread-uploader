import { describe, it, expect } from "vitest";
import {
  isValuableObjectionComment,
  extractObjectionsFromComments,
  generateNextHooksFromObjections,
  type RawUserComment,
} from "./objection-hook-miner";

describe("objection-hook-miner", () => {
  it("filters out spam, generic praise, and trivial emojis", () => {
    expect(isValuableObjectionComment("감사합니다 잘 봤어요!")).toBe(false);
    expect(isValuableObjectionComment("👍👍👍")).toBe(false);
    expect(isValuableObjectionComment("광고 링크 차단")).toBe(false);
    expect(isValuableObjectionComment("근데 회사가 망해가는 중이면 그래도 버텨야 하나요?")).toBe(true);
    expect(isValuableObjectionComment("전 신금 일주인데 오히려 퇴사하고 대박 났는데요? 반론입니다")).toBe(true);
  });

  it("extracts and ranks valuable objections by like count and length", () => {
    const comments: RawUserComment[] = [
      { id: "c1", text: "좋은 정보 감사합니다!", likes: 50 },
      { id: "c2", text: "근데 망해가는 배에서는 대운 교운기라도 탈출해야 하지 않나요?", likes: 45 },
      { id: "c3", text: "전 반대 상황인데 이럴 땐 어떻게 해요?", likes: 10 },
    ];

    const objections = extractObjectionsFromComments(comments);
    expect(objections.length).toBe(2);
    expect(objections[0].text).toContain("망해가는 배에서는");
    expect(objections[0].likes).toBe(45);
  });

  it("generates next-generation follow-up hooks from extracted objections via mock LLM", async () => {
    const objections: RawUserComment[] = [
      { id: "c2", text: "근데 회사가 망해가는 중이면 그래도 버텨야 하나요?", likes: 45 },
    ];

    const mockQueryFn = async () => JSON.stringify({
      objectionCore: "회사 파산 위기 시 대운 교운기 탈출 기준",
      nextHeadlineHook: "지난 글에 '회사가 망해갈 땐 교운기라도 도망쳐야 하냐'는 질문 폭발해서 팩트만 정리함",
      followUpAngle: "침몰하는 배 탈출 시 딱 1가지만 지키면 되는 법칙",
    });

    const hooks = await generateNextHooksFromObjections("post-999", objections, mockQueryFn);
    expect(hooks.length).toBe(1);
    expect(hooks[0].parentPostId).toBe("post-999");
    expect(hooks[0].nextHeadlineHook).toContain("회사가 망해갈 땐");
    expect(hooks[0].objectionCore).toContain("회사 파산 위기");
  });
});
