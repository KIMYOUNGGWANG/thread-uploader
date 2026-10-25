import type { Brand } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Passes every New Year fact check (mentions 입춘, no day masters, no month+ganji pair, only 2027)
// and the existing gates, so the slot tests measure slot assignment rather than fact checks.
const NY_SAFE_REPLY = "1월에 보는 신년운세, 사실 작년 흐름일 수 있어\n\n사주에서 해가 바뀌는 날은 1월 1일이 아니라 입춘이야\n2027년 흐름은 2월부터 시작되는 셈\n\n너는 새해 계획 언제 세우는 편이야?";

// Mentions only "Lichun" (rewritten to "Ipchun" on cleanup) and 2027, so it passes only when ny_ipchun owns
// the year-boundary claim and the EN fact check accepts the Ipchun spelling.
const EN_IPCHUN_REPLY = "Your January horoscope may be reading last year.\n\nIn saju the year turns at Lichun, not on January 1.\n\nSo 2027 really starts a little later.\n\nWhen do you usually make your yearly plans?";

// ny_zodiac harmony topic (돼지·토끼·말): passes the same gates as NY_SAFE_REPLY.
const NY_ZODIAC_REPLY = "2027년, 사람이 들어오기 쉬운 띠가 있어\n\n띠로 보는 사주 이야기야\n돼지띠 (95·83·71·07년생): 사람이 들어오기 쉬운 해\n토끼띠 (99·87·75년생): 새 인연이 붙기 쉬운 해\n말띠 (02·90·78년생): 사람이 늘기 쉬운 해\n\n사주에선 입춘(2월 4일)부터 띠를 바꿔 봐서 1월~2월 초생이면 앞 해 띠일 수 있어\n가족 띠도 찾아서 보내 줘";

const state = vi.hoisted(() => ({
  reply: "",
  comment: "",
  postCount: 0,
  created: [] as Array<{ formulaId: string | null }>,
  updates: [] as Array<{ linkUrl?: string; firstComment?: string }>,
  requests: [] as string[],
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = {
      create: vi.fn(async (request: unknown) => {
        state.requests.push(JSON.stringify(request));
        return { content: [{ type: "text", text: `${state.reply}\n\n===FIRST_COMMENT===\n${state.comment}` }] };
      }),
    };
  },
}));

const RECENT_POSTS = Array.from({ length: 12 }, (_, i) => ({
  content: `최근 글 ${i}번 고양이 사료 ${i}종 비교 후기 ${i}`,
  firstComment: null,
  topic: null,
  situation: null,
  hookType: null,
  ctaType: null,
  campaignFormulaId: null,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      findMany: vi.fn(async () => RECENT_POSTS),
      findFirst: vi.fn(async () => null),
      count: vi.fn(async () => state.postCount),
      create: vi.fn(async ({ data }: { data: { formulaId: string | null } }) => {
        state.created.push(data);
        return { id: `post_${state.created.length}`, ...data };
      }),
      update: vi.fn(async ({ data }: { data: { linkUrl?: string; firstComment?: string } }) => {
        state.updates.push(data);
        return data;
      }),
    },
  },
}));

vi.mock("@/lib/winner-replay", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/winner-replay")>()),
  loadWinnerReplaySource: vi.fn(async () => null),
}));

vi.mock("@/lib/length-experiment", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/length-experiment")>()),
  loadLengthExperimentState: vi.fn(async () => null),
}));

vi.mock("@/lib/remediation-engine", () => ({
  remediatePostAlgorithmic: vi.fn(async (content: string, firstComment: string | null) => ({
    content,
    firstComment,
    pass: true,
    scoreResult: { totalScore: 90, dimensions: {} },
    method: "INITIAL_PASS",
    rewriteCount: 0,
    actionableFixes: [],
  })),
}));

vi.mock("@/lib/quality-gate", () => ({
  checkQuality: vi.fn(() => ({ pass: true, score: 5, profile: "saju_viral", reasons: [] })),
}));

import { generatePostsForBrand } from "@/lib/generate-posts";

const cosmicBrand = {
  id: "brand_cosmic",
  slug: "cosmicpath",
  brandConfig: JSON.stringify({
    systemPrompt: "Write concise CosmicPath posts.",
    topics: ["대운 교운기 번아웃"],
    targets: ["이직을 고민하는 직장인"],
    situations: ["퇴사와 이직 사이에서 흔들리는 상황"],
    websiteUrl: "",
    productProfile: { productName: "CosmicPath" },
    campaigns: [{
      id: "cosmicpath_lean_sprint",
      name: "CosmicPath Lean Sprint",
      mode: "landing-test",
      qualityProfile: "saju_viral",
      perPostLinks: false,
      formulas: [{ id: "concept_hierarchy", name: "개념 서열 비교", weight: 1, instruction: "서열 비교" }],
    }],
    activeCampaignId: "cosmicpath_lean_sprint",
    qualityProfile: "saju_viral",
  }),
  formulaWeights: "{}",
  growthMemory: "{}",
  viralMemory: "{}",
} as unknown as Brand;
const globalBrand = {
  ...cosmicBrand,
  id: "brand_global",
  slug: "cosmicpath-global",
  brandConfig: JSON.stringify({
    systemPrompt: "Write concise posts in English.",
    topics: ["career switch timing"],
    targets: ["people thinking about a job change"],
    situations: ["stuck between staying and leaving"],
    websiteUrl: "",
    productProfile: { productName: "CosmicPath Global" },
    voiceProfile: { language: "en" },
    campaigns: [{
      id: "cosmicpath_global_d2c",
      name: "CosmicPath Global",
      mode: "landing-test",
      qualityProfile: "ecommerce_d2c",
      perPostLinks: false,
      formulas: [{ id: "two_birthday_compatibility", name: "Two birthdays", weight: 1, instruction: "Compare two birthdays" }],
    }],
    activeCampaignId: "cosmicpath_global_d2c",
    qualityProfile: "ecommerce_d2c",
  }),
} as unknown as Brand;
const input = { count: 1, insertAtFront: false, requestedCampaignId: null, approvedCampaignStart: false, postCategory: "GENERAL" };

describe("New Year season slots in generatePostsForBrand", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    state.created.length = 0;
    state.updates.length = 0;
    state.requests.length = 0;
    state.reply = NY_SAFE_REPLY;
    state.comment = "저장해두고 다시 봐";
    state.postCount = 0;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("시즌 정점의 cosmicpath 5개 생성 중 2개가 신년 모드이고, 첫 댓글이 고정 문구+단축 링크", async () => {
    vi.setSystemTime(new Date("2027-01-10T03:00:00Z"));
    await generatePostsForBrand(cosmicBrand, { ...input, count: 5 });
    const ny = state.created.filter((p) => p.formulaId?.startsWith("ny_"));
    expect(ny).toHaveLength(2);
    expect(state.updates.filter((u) => u.linkUrl?.includes("utm_campaign=new_year_2027"))).toHaveLength(2);
    expect(state.updates.find((u) => u.linkUrl?.includes("utm_campaign=new_year_2027"))?.firstComment).toMatch(/^내 2027 캘린더는 홈 맨 위에서:\nhttps?:\/\/.+\/r\//);
  });

  it("신년 칸의 프롬프트에 신년 자료가 들어간다", async () => {
    vi.setSystemTime(new Date("2027-01-10T03:00:00Z"));
    await generatePostsForBrand(cosmicBrand, { ...input, count: 5 });
    expect(state.requests.join("\n")).toContain("[신년 자료:");
  });

  it("시즌 전(10/30)에는 신년 칸이 없다", async () => {
    vi.setSystemTime(new Date("2026-10-30T03:00:00Z"));
    await generatePostsForBrand(cosmicBrand, { ...input, count: 5 });
    expect(state.created.filter((p) => p.formulaId?.startsWith("ny_"))).toHaveLength(0);
  });

  it("다른 브랜드는 시즌 정점에도 신년 칸이 없다", async () => {
    vi.setSystemTime(new Date("2027-01-10T03:00:00Z"));
    await generatePostsForBrand({ ...cosmicBrand, slug: "other-brand" } as Brand, { ...input, count: 5 });
    expect(state.created.filter((p) => p.formulaId?.startsWith("ny_"))).toHaveLength(0);
  });

  it("EN 시즌 정점의 ny_ipchun 초안은 Lichun을 써도 저장되고, 프롬프트 헤더는 영어", async () => {
    vi.setSystemTime(new Date("2027-01-10T03:00:00Z"));
    // Four existing posts make this run's first slot the 2nd EN New Year slot, which is ny_ipchun.
    state.postCount = 4;
    state.reply = EN_IPCHUN_REPLY;
    state.comment = "Save this for February";
    await generatePostsForBrand(globalBrand, input);
    expect(state.created.map((p) => p.formulaId)).toEqual(["ny_ipchun"]);
    const prompt = state.requests.join("\n");
    expect(prompt).toContain("[New Year facts:");
    expect(prompt).not.toContain("[신년 자료:");
    // The formula block runs from "[Formula:" to the first blank line (requests are JSON, so "\n" is escaped).
    const formulaBlock = prompt.slice(prompt.indexOf("[Formula:"), prompt.indexOf("\\n\\n", prompt.indexOf("[Formula:")));
    expect(formulaBlock).toContain("[Formula: Lichun Twist]");
    expect(formulaBlock).not.toMatch(/[가-힣]/);
    const update = state.updates.find((u) => u.linkUrl?.includes("lang=en") && u.linkUrl?.includes("utm_campaign=new_year_2027"));
    expect(update?.firstComment).toMatch(/^Your 2027 calendar is at the top of the home page:\nhttps?:\/\/.+\/r\//);
  });

  it("사실 검사에 걸린 신년 초안은 저장되지 않는다", async () => {
    vi.setSystemTime(new Date("2027-01-10T03:00:00Z"));
    state.reply = "2028년엔 다 잘 풀림"; // year violation
    await generatePostsForBrand(cosmicBrand, { ...input, count: 5 }).catch(() => null);
    expect(state.created.filter((p) => p.formulaId?.startsWith("ny_"))).toHaveLength(0);
  });

  it("정점 KO의 띠 칸은 그 칸 주제의 띠 글을 저장한다", async () => {
    vi.setSystemTime(new Date("2027-01-10T03:00:00Z"));
    state.postCount = 5; // slotIndex 5 is nth 2 of the KO cycle: ny_zodiac, harmony topic
    state.reply = NY_ZODIAC_REPLY;
    await generatePostsForBrand(cosmicBrand, input);
    expect(state.created.map((p) => p.formulaId)).toEqual(["ny_zodiac"]);
    expect(state.requests.join("\n")).toContain("돼지띠");
  });

  it("띠 칸에 다른 주제 띠를 쓴 초안은 저장되지 않는다 (slotIndex가 값 검사에 전달됨)", async () => {
    vi.setSystemTime(new Date("2027-01-10T03:00:00Z"));
    state.postCount = 5;
    state.reply = NY_ZODIAC_REPLY.replace("말띠 (02·90·78년생)", "쥐띠 (96·84·72년생)");
    await generatePostsForBrand(cosmicBrand, input).catch(() => null);
    expect(state.created.filter((p) => p.formulaId === "ny_zodiac")).toHaveLength(0);
  });
});
