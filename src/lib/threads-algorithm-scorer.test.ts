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

  // Drafts generated in production on 2026-10-14 that scored 75-77 and were rewritten twice.
  const GENERATED_DRAFTS: Array<{ post: string; comment: string }> = [
    {
      post: [
        "좋은 사람이랑 맞는 사람은 다른 칸임.",
        "SNS 몰래 보는 건 미련이 아니라 결정을 미루는 거임.",
        "상견례 날짜는 잡혔는데 상대 일간이 재성을 쥐고 흔들리는 대운이라고 치자. 셋 중 하나만 골라.",
        "",
        "1. 지금 접는다",
        "2. 상견례까지 밀어붙인다",
        "3. 6개월 거리 두고 다시 잰다",
      ].join("\n"),
      comment: "셋 중 왜 그걸 골랐는지 한 줄로 적어줘.",
    },
    {
      post: [
        "정 때문에 못 끊는 사이, 사실 궁합이 아니라 리듬이 어긋난 것일 수도 있음.",
        "통념은 \"정이 있으면 버틴다\"지만, 사주에선 감정보다 하루 템포를 맞추는 식상과 재성의 흐름이 먼저 무너짐.",
        "",
        "사소한 다툼이 반복되는 건 상관처럼 불만이 새고, 편관처럼 압박이 쌓이기 때문임.",
        "",
        "지금 둘 중 하나라면? 정 때문에 버티는 쪽인가, 아니면 리듬이 달라서 지친 쪽인가.",
      ].join("\n"),
      comment: "네 원국에 상관이 자리 잡고 있는지 한 번 확인해봐. 있다면 생활 리듬이 어긋날 때 어떤 장면에서 먼저 튀어나오는지 한 줄로 적어줘.",
    },
    {
      post: [
        "먼저 고백하면 진다는 생각, 사주로 보면 반대임.",
        "4년 사귀고 결혼 얘기만 나오면 둘 다 입 닫는 커플 많음. 혼자 볼 땐 운이 좋아 보여도 둘이 붙으면 재성끼리 눈치만 보다 시간이 감.",
        "",
        "지금 상대가 먼저 말 안 꺼내고 있다면 너는?",
        "1. 오늘 밤 먼저 말한다",
        "2. 한 달만 더 기다린다",
        "3. 대운 바뀔 때까지 침묵 유지",
      ].join("\n"),
      comment: "1, 2, 3 중 고른 이유를 한 줄로 적어줘. 어느 쪽이 더 무서운지가 답이라고 봄.",
    },
  ];

  it("passes Korean contrarian hooks, question endings without '?', and 'write one line' comment asks", () => {
    for (const draft of GENERATED_DRAFTS) {
      expect(scoreThreadsPostAlgorithmic(draft.post, draft.comment).totalScore).toBeGreaterThanOrEqual(80);
    }
  });

  it("treats '반대·통념·아니라' on the first line as a contrast hook", () => {
    const result = scoreThreadsPostAlgorithmic("먼저 고백하면 진다는 생각, 사주로 보면 반대임.\n\n일간끼리 눈치만 보다 시간이 감.");
    expect(result.dimensions.hookTension.strengths.join(" ")).toContain("대비");
  });
});

describe("threads-algorithm-scorer english hooks", () => {
  it("rewards research-proven english hooks and choice endings", () => {
    const post = [
      "That Goat birth year on your phone is probably wrong.",
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

  it("does not reward a question mark on an English first line", () => {
    const q = scoreThreadsPostAlgorithmic("Is your birth hour actually wrong, instead?\nbody line").dimensions.hookTension.score;
    const flat = scoreThreadsPostAlgorithmic("Your birth hour is not the problem.\nbody line").dimensions.hookTension.score;
    expect(flat).toBeGreaterThan(q);
  });

  // The English hook rule forbids "vs": no contrast bonus and no flat-hook bonus for it.
  it("gives no hook bonus for 'vs' on an English first line", () => {
    const result = scoreThreadsPostAlgorithmic("Saturn return vs midlife crisis.\nbody line");
    expect(result.dimensions.hookTension.score).toBe(10);
  });

  // Values measured on e40642a before the English hook change; Korean lines must not move.
  it("keeps Korean hook scoring unchanged", () => {
    const question = scoreThreadsPostAlgorithmic("혹시 너도 이거 착각하고 있어?\n본문");
    expect(question.dimensions.hookTension.score).toBe(25);
    expect(question.totalScore).toBe(83);
    expect(scoreThreadsPostAlgorithmic("그건 착각이야\n본문").dimensions.hookTension.score).toBe(18);
    expect(scoreThreadsPostAlgorithmic("이직 vs 존버 중 진짜 당신에게 맞는 선택은 뭘까요?\n본문").totalScore).toBe(87);
  });
});
