import type { Brand } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SOURCE = {
  id: "ex_1",
  content: "혹시 알고 있어? 한국인 10명 중 7명은 자기가 태어난 시간을 잘못 알고 있다.\n\n점집에서 들은 말이 전부 맞는 건 아니야\n그래서 기준을 먼저 세워야 해\n\n너는 몇 시에 태어났어?",
};

const state = vi.hoisted(() => ({
  reply: "",
  created: [] as Array<{ formulaId: string | null; qualityReasons: string }>,
  requests: [] as string[],
  recent: null as null | Array<Record<string, unknown>>,
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = {
      create: vi.fn(async (request: unknown) => {
        state.requests.push(JSON.stringify(request));
        return { content: [{ type: "text", text: `${state.reply}\n\n===FIRST_COMMENT===\n저장해두고 다시 봐` }] };
      }),
    };
  },
}));

// Twelve unrelated recent posts: more than the default anti-repeat window of 10.
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
      findMany: vi.fn(async () => state.recent ?? RECENT_POSTS),
      findFirst: vi.fn(async () => null),
      count: vi.fn(async () => 0),
      create: vi.fn(async ({ data }: { data: { formulaId: string | null; qualityReasons: string } }) => {
        state.created.push(data);
        return { id: `post_${state.created.length}`, ...data };
      }),
      update: vi.fn(async ({ data }: { data: object }) => data),
    },
  },
}));

vi.mock("@/lib/winner-replay", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/winner-replay")>()),
  loadWinnerReplaySource: vi.fn(async () => null),
}));

vi.mock("@/lib/length-experiment", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/length-experiment")>()),
  // A running length experiment must not leak an arm into a reference draft.
  loadLengthExperimentState: vi.fn(async () => ({
    config: { startAt: "2026-10-01T00:00:00Z", sequence: "SL", shortMax: 260, longMin: 390 },
    position: 0,
    arm: "S",
    pending: { S: 0, L: 0 },
  })),
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
import { loadWinnerReplaySource } from "@/lib/winner-replay";
import { REFERENCE_REPLAY_SOURCE_PREFIX } from "@/lib/reference-replay";

const brand = {
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
const input = { count: 3, insertAtFront: false, requestedCampaignId: null, approvedCampaignStart: false, postCategory: "GROWTH" };

describe("ref_replay draft", () => {
  beforeEach(() => {
    vi.stubEnv("NEW_YEAR_SEASON_DISABLED", "1");
    state.created.length = 0;
    state.requests.length = 0;
    vi.mocked(loadWinnerReplaySource).mockClear();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("writes one ref_replay draft tagged with its source and skips arm planning", async () => {
    state.reply = "점집에서 10만원 내고 들은 말이 '좋은 흐름 온다'뿐이었다면\n\n그 돈으로 차라리 내 흐름을 직접 읽는 법을 배우는 게 낫지 않을까\n\n너라면 어느 쪽이야?";
    await generatePostsForBrand(brand, { ...input, referenceReplay: SOURCE });
    expect(state.created).toHaveLength(1);
    expect(state.created[0]?.formulaId).toBe("ref_replay");
    expect(JSON.parse(state.created[0]?.qualityReasons ?? "[]")).toContain(`${REFERENCE_REPLAY_SOURCE_PREFIX}ex_1`);
    expect(state.requests).toHaveLength(1);
    expect(state.requests[0]).toContain("다른 계정에서 반응이 좋았던 글");
    expect(state.requests[0]).toContain("140~260자");
    expect(state.requests[0]).not.toContain("[길이 실험]");
    const prompt = state.requests[0];
    expect(prompt).toContain("[상황/맥락]\\n아래 [참고 글]의 상황");
    expect(prompt).not.toContain("퇴사와 이직 사이에서 흔들리는 상황");
    expect(prompt).toContain("상황과 감정의 흐름을 가져오되");
    expect(prompt).not.toContain("구조만 따르고 주제·소재·문장은 새로 써");
    expect(loadWinnerReplaySource).not.toHaveBeenCalled();
  });

  // A New Year slot used to win the branch and drop the reference from the prompt while the source was still tagged as used.
  it("keeps the reference in the prompt when the planned slot falls in the New Year season", async () => {
    vi.unstubAllEnvs();
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-12-20T00:00:00+09:00"));
      state.reply = "점집에서 10만원 내고 들은 말이 '좋은 흐름 온다'뿐이었다면\n\n그 돈으로 차라리 내 흐름을 직접 읽는 법을 배우는 게 낫지 않을까\n\n너라면 어느 쪽이야?";
      await generatePostsForBrand(brand, { ...input, referenceReplay: SOURCE });
      expect(state.requests[0]).toContain("다른 계정에서 반응이 좋았던 글");
      expect(state.requests[0]).not.toContain("[신년 자료");
    } finally {
      vi.useRealTimers();
    }
  });

  it("drops a ref_replay draft that copies the source without throwing", async () => {
    state.reply = SOURCE.content;
    const result = await generatePostsForBrand(brand, { ...input, referenceReplay: SOURCE });
    expect(state.created).toHaveLength(0);
    expect(result.ok && result.summary.count).toBe(0);
    expect(result.ok && result.summary.failureReasons.join(" ")).toMatch(/원본과 너무 비슷함/);
    // A similarity miss must not feed a retry: retries would paraphrase to just under the threshold.
    expect(state.requests).toHaveLength(1);
  });
});
