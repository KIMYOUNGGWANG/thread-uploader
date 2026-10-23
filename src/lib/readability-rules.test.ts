import { describe, expect, it } from "vitest";
import { checkReadabilityRules, findJargonTerms } from "@/lib/readability-rules";

describe("checkReadabilityRules", () => {
  it("fails a post with several jargon terms", () => {
    const r = checkReadabilityRules("결혼 얘기만 나오면 끊기지?\n밀어붙이는 쪽의 겁재가 아니라 기다리는 쪽 정관이 원인임.", "어떻게 생각해?");
    expect(r.pass).toBe(false);
    expect(r.reasons[0]).toContain("사주 용어 2개");
  });

  it("counts a repeated term once", () => {
    expect(checkReadabilityRules("도화살이 있어서 그래. 도화살은 끌림 신호임.", "너라면 답장해?").pass).toBe(true);
  });

  it("passes one term with plain words around it", () => {
    expect(
      checkReadabilityRules(
        "새벽 2시 \"자?\"는 설렘보다 외로움일 때가 많음.\n사주로 치면 도화살, 끌림이 잠깐 켜지는 신호임.\n답장은 아침에 해도 늦지 않음.",
        "너라면 바로 답장해, 아침까지 둬?"
      ).pass
    ).toBe(true);
  });

  it("fails a closing question the reader can't answer", () => {
    expect(checkReadabilityRules("연락 텀보다 중요한 게 있음.\n너 원국에서 정관이 어느 자리에 앉아 있어?", "").pass).toBe(false);
    expect(checkReadabilityRules("연락 텀보다 중요한 게 있음.\n도화살이 어느 자리에 앉아 있어?", "").reasons).toContain(
      "독자가 답할 수 없는 질문: 자기 경험만으로 답할 수 있게"
    );
    expect(checkReadabilityRules("본문 한 줄", "혹시 네 사주에도 이런 구조 있는지 떠올려 봐.").pass).toBe(false);
  });

  it("ignores jargon in the link line of the first comment", () => {
    expect(checkReadabilityRules("본문 한 줄", "너라면 어떻게 해?\nhttps://example.com/도화살").pass).toBe(true);
  });

  it("fails a made-up first-person story in the first comment", () => {
    const r = checkReadabilityRules("본문 한 줄", "난 솔직히 3번 골랐다가 지분 반 넘겨주고 1년 뒤에 연락 끊었음. 너넨 몇 번임?");
    expect(r.pass).toBe(false);
    expect(r.reasons).toContain("첫 댓글에 지어낸 1인칭 경험담 금지");
  });
});

describe("findJargonTerms", () => {
  it.each([
    "갑자기 연락 옴",
    "상관없어",
    "기사 봤어?",
    "지지해줄게",
    "인성 좋은 사람",
    "일주일 동안 연락 없음",
    "세운 계획대로 감",
  ])("does not count everyday words: %s", (text) => {
    expect(findJargonTerms(text)).toEqual([]);
  });

  it("finds distinct terms once", () => {
    expect(findJargonTerms("겁재와 정관, 그리고 겁재 또 일주")).toEqual(["겁재", "정관", "일주"]);
  });
});
