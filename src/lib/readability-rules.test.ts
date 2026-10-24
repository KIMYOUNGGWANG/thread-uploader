import { describe, expect, it } from "vitest";
import { checkReadabilityRules, checkTemplateCap, endsWithNumberedChoices, findJargonTerms, opensWithReversal, tightenChoiceLines } from "@/lib/readability-rules";

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
      "독자가 답할 수 없는 질문(도화살): 마지막 질문·첫 댓글엔 사주 용어 없이, 자기 경험만으로 답할 수 있게"
    );
    expect(checkReadabilityRules("본문 한 줄", "혹시 네 사주에도 이런 구조 있는지 떠올려 봐.").pass).toBe(false);
  });

  it("names the generic cause when the question asks about the reader's chart", () => {
    expect(checkReadabilityRules("본문 한 줄", "혹시 네 사주에도 이런 구조 있어?").reasons).toContain(
      "독자가 답할 수 없는 질문(사주 구조): 마지막 질문·첫 댓글엔 사주 용어 없이, 자기 경험만으로 답할 수 있게"
    );
  });

  it("fails a closing question that repeats the hook's 살", () => {
    expect(checkReadabilityRules("화개살 있는 사람 특징?\n혼자 있는 시간이 꼭 필요함.\n너 주변 화개살 있는 사람도 그래?", "").pass).toBe(false);
  });

  it.each([
    "대운이 뭔데?\n10년마다 바뀌는 큰 흐름이라고 보면 됨.\n그래서 요즘 꼬이는 게 다 네 탓은 아님.",
    "도화살 있는 사람 특징?\n사람을 끄는 힘이 강함.\n본인은 정작 잘 모름.",
  ])("treats a line-1 question as the hook, not the closing question: %s", (post) => {
    expect(checkReadabilityRules(post, "").pass).toBe(true);
  });

  it.each(["그렇네 사주 얘기 좀 해보자", "궁합 보니 사주가 비슷함"])("does not read a word ending in 네/니 as the reader's chart: %s", (comment) => {
    expect(checkReadabilityRules("본문 한 줄", comment).pass).toBe(true);
  });

  it.each(["네 사주 한번 봐봐", "너의 사주엔 뭐가 있어?", "당신 사주에는 이런 거 없어?"])("still catches the reader's chart: %s", (comment) => {
    expect(checkReadabilityRules("본문 한 줄", comment).pass).toBe(false);
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

describe("invented first-person story", () => {
  it.each([
    "난 그때 연락했음",
    "난 어제 걔 차단했어",
    "나는 작년에 헤어졌음",
    "난 솔직히 3번 골랐음",
    "난 솔직히 3번 골랐다가 후회함",
  ])("fails: %s", (comment) => {
    expect(checkReadabilityRules("본문 한 줄", comment).reasons).toContain("첫 댓글에 지어낸 1인칭 경험담 금지");
  });

  it.each([
    "나는 어느 쪽인지 골라봐",
    "너라면 바로 답장해, 아침까지 둬?",
    "나도 궁금한데 너는 시간 있어?",
    "난 궁금한 게 있어, 너는?",
    "나는 이쪽 고르겠어 너는?",
    "내가 그 자리에 있다면 어떻게 할까?",
    "난 2번. 너넨 몇 번 골랐어?",
    "나도 궁금함. 너는 먼저 연락했어?",
    "난 1번 고를 듯. 너는 어땠어?",
  ])("passes: %s", (comment) => {
    expect(checkReadabilityRules("본문 한 줄", comment).pass).toBe(true);
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
    "습관성 연락",
    "식상한 멘트",
    "다른 사람과 비견됨",
    "일간지 기사",
    "정관 수술",
    "대운하 공사",
    "신약 개발",
    "연락 빠른 편인 사람",
    "너는 먼저 연락하는 편인지 궁금함",
    "예민한 편인데 티는 안 냄",
    "고정관념",
    "비겁하게 굴지 마",
    "세계일주",
  ])("does not count everyday words: %s", (text) => {
    expect(findJargonTerms(text)).toEqual([]);
  });

  it("still counts real uses of guarded terms", () => {
    expect(findJargonTerms("식상이 강하면 말이 앞섬")).toEqual(["식상"]);
    expect(findJargonTerms("관성이 강한 편")).toEqual(["관성"]);
    expect(findJargonTerms("올해 대운이 바뀜")).toEqual(["대운"]);
    expect(findJargonTerms("일간이 약하면 신약")).toEqual(["일간", "신약"]);
    expect(findJargonTerms("편인이 강하면 생각이 많음")).toEqual(["편인"]);
    expect(findJargonTerms("정관이 있으면 선을 지킴")).toEqual(["정관"]);
    expect(findJargonTerms("비겁이 많으면 고집이 셈")).toEqual(["비겁"]);
    expect(findJargonTerms("일주가 같으면 잘 맞음")).toEqual(["일주"]);
  });

  it("finds distinct terms once", () => {
    expect(findJargonTerms("겁재와 정관, 그리고 겁재 또 일주")).toEqual(["겁재", "정관", "일주"]);
  });
});

describe("checkTemplateCap", () => {
  const choice = "고민임\n1. 바로 간다\n2. 기다린다\n3. 기록한다";
  const plain = "그냥 한 줄 생각\n오늘은 여기까지";
  const toRecent = (posts: string[]) => posts.map((content) => ({ content }));

  it("fails the 4th numbered-choice post in the last 10", () => {
    const r = checkTemplateCap(choice, toRecent([choice, choice, choice, plain]));
    expect(r.pass).toBe(false);
    expect(r.reasons).toEqual(["최근 10개 중 번호 선택지 글이 이미 3개: 다른 마무리로"]);
  });

  it("passes when the window holds fewer than the cap", () => {
    expect(checkTemplateCap(choice, toRecent([choice, choice, plain])).pass).toBe(true);
  });

  it("only counts the most recent 10", () => {
    expect(checkTemplateCap(choice, toRecent([...Array(10).fill(plain), choice, choice, choice])).pass).toBe(true);
  });

  it("passes a plain candidate even when the window is full of one template", () => {
    expect(checkTemplateCap(plain, toRecent([choice, choice, choice, choice])).pass).toBe(true);
  });

  it("caps reversal openers and tells the model how to compare instead", () => {
    const reversal = "새벽 연락은 설렘이 아니라 계산임.\n둘째 줄";
    const r = checkTemplateCap(reversal, toRecent([reversal, reversal, reversal]));
    expect(r.pass).toBe(false);
    expect(r.reasons).toEqual(["최근 10개 중 'X가 아니라 Y' 첫 줄이 이미 3개: 다른 훅으로 (비교가 필요하면 '~보다'로)"]);
  });
});

describe("template detectors", () => {
  it("detects a reversal opener", () => {
    expect(opensWithReversal("새벽 연락은 설렘이 아니라 계산임.\n둘째 줄")).toBe(true);
    expect(opensWithReversal("새벽 연락이 왔음.\n둘째 줄")).toBe(false);
    expect(opensWithReversal("첫 줄\n둘째 줄\n셋째 줄은 사랑이 아니라 습관")).toBe(false);
    expect(opensWithReversal("그건 아님이라 생각함")).toBe(false);
  });

  it("closes blank lines between consecutive numbered choices only", () => {
    expect(tightenChoiceLines("너라면?\n1. 일단 버틴다\n\n2. 이력서부터 돌린다\n3. 계산하고 움직인다")).toBe(
      "너라면?\n1. 일단 버틴다\n2. 이력서부터 돌린다\n3. 계산하고 움직인다"
    );
    expect(tightenChoiceLines("첫 문단\n\n1. 하나\n2. 둘\n\n마지막 문단")).toBe("첫 문단\n\n1. 하나\n2. 둘\n\n마지막 문단");
  });

  it("needs two numbered lines to count as numbered choices", () => {
    expect(endsWithNumberedChoices("고민임\n1. 바로 간다\n2. 기다린다")).toBe(true);
    expect(endsWithNumberedChoices("A) 가\nB) 나")).toBe(true);
    expect(endsWithNumberedChoices("고민임\n1. 하나만")).toBe(false);
  });
});
