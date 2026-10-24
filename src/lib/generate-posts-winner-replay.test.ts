import type { Brand } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const SOURCE = {
  id: "winner_1",
  content: "화개살 있는 사람이 혼자 있는 시간을 꼭 지켜야 하는 진짜 이유\n\n사람 많은 자리 다녀오면 이틀은 방전돼\n그건 예민한 게 아니라 충전 방식이 다른 거야\n\n너도 그래?",
  views: 5521,
};

const state = vi.hoisted(() => ({
  reply: "",
  created: [] as Array<{ formulaId: string | null; qualityReasons: string }>,
  requests: [] as string[],
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
      findMany: vi.fn(async () => RECENT_POSTS),
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
  loadWinnerReplaySource: vi.fn(async () => SOURCE),
}));

vi.mock("@/lib/length-experiment", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/length-experiment")>()),
  loadLengthExperimentState: vi.fn(async () => null),
}));

vi.mock("@/lib/lean-mode-selector", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/lean-mode-selector")>();
  return { ...actual, selectLeanViralMode: vi.fn(actual.selectLeanViralMode) };
});

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
import { loadWinnerReplaySource, WINNER_REPLAY_SOURCE_PREFIX } from "@/lib/winner-replay";
import { loadLengthExperimentState } from "@/lib/length-experiment";
import { selectLeanViralMode } from "@/lib/lean-mode-selector";

const LEAN_ARMS = ["imagination_dilemma", "concept_hierarchy", "identity_profile", "relationship_tension", "beginner_qa"];
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
    thompsonPriors: {
      ...Object.fromEntries(LEAN_ARMS.map((id) => [id, { alpha: 1, beta: 1000 }])),
      winner_replay: { alpha: 1000, beta: 1 },
    },
  }),
  formulaWeights: "{}",
  growthMemory: "{}",
  viralMemory: "{}",
} as unknown as Brand;
const input = { count: 1, insertAtFront: false, requestedCampaignId: null, approvedCampaignStart: false, postCategory: "GENERAL" };

describe("winner_replay draft gate", () => {
  beforeEach(() => {
    state.created.length = 0;
    state.requests.length = 0;
    vi.mocked(selectLeanViralMode).mockClear();
  });

  it("drops a replay draft that copies its source even when 10+ recent posts fill the anti-repeat window", async () => {
    state.reply = SOURCE.content;
    // Two drafts: the replay one must be dropped by the source check, the regular sibling is saved.
    const result = await generatePostsForBrand(brand, { ...input, count: 2 });
    if (!result.ok) throw new Error(result.error);
    expect(result.summary.failureReasons).toHaveLength(1);
    expect(result.summary.failureReasons[0]).toContain("승자 원본");
    expect(state.created.map((post) => post.formulaId)).not.toContain("winner_replay");
  });

  it("saves a replay draft that only borrows the structure, tagged with its source", async () => {
    state.reply = "도화살 있는 사람이 연락 답장을 일부러 늦게 하는 진짜 속사정\n\n관심 없어서가 아니라 기대받는 게 부담스러워서야\n\n너 주변에도 이런 사람 있어?";
    const result = await generatePostsForBrand(brand, input);
    expect(result.ok).toBe(true);
    expect(state.created).toHaveLength(1);
    expect(state.created[0]?.formulaId).toBe("winner_replay");
    expect(JSON.parse(state.created[0]?.qualityReasons ?? "[]")).toContain(`${WINNER_REPLAY_SOURCE_PREFIX}${SOURCE.id}`);
  });

  it("does not offer the replay arm while the length experiment is running", async () => {
    vi.mocked(loadLengthExperimentState).mockResolvedValueOnce({
      config: { startAt: "2026-10-01T00:00:00Z", sequence: "SL", shortMax: 260, longMin: 390 },
      position: 0,
      arm: "S",
      pending: { S: 0, L: 0 },
    });
    state.reply = "도화살 있는 사람이 연락 답장을 일부러 늦게 하는 진짜 속사정\n\n관심 없어서가 아니라 기대받는 게 부담스러워서야\n\n너 주변에도 이런 사람 있어?";
    await generatePostsForBrand(brand, input);
    expect(vi.mocked(selectLeanViralMode).mock.calls.length).toBeGreaterThan(0);
    expect(vi.mocked(selectLeanViralMode).mock.calls.every((call) => call[4] === false)).toBe(true);
    expect(state.created.map((post) => post.formulaId)).not.toContain("winner_replay");
  });

  it("keeps generating when the winner source lookup fails", async () => {
    vi.mocked(loadWinnerReplaySource).mockRejectedValueOnce(new Error("db down"));
    state.reply = "도화살 있는 사람이 연락 답장을 일부러 늦게 하는 진짜 속사정\n\n관심 없어서가 아니라 기대받는 게 부담스러워서야\n\n너 주변에도 이런 사람 있어?";
    const result = await generatePostsForBrand(brand, input);
    expect(result.ok).toBe(true);
    expect(state.created).toHaveLength(1);
    expect(state.created[0]?.formulaId).not.toBe("winner_replay");
  });

  it("writes the saju_viral prompt so jargon is capped at one term instead of required", async () => {
    vi.mocked(loadLengthExperimentState).mockResolvedValueOnce({
      config: { startAt: "2026-10-01T00:00:00Z", sequence: "SL", shortMax: 260, longMin: 390 },
      position: 0,
      arm: "S",
      pending: { S: 0, L: 0 },
    });
    state.reply = "도화살 있는 사람이 연락 답장을 일부러 늦게 하는 진짜 속사정\n\n관심 없어서가 아니라 기대받는 게 부담스러워서야\n\n너 주변에도 이런 사람 있어?";
    await generatePostsForBrand(brand, input);
    const prompt = state.requests.join("\n");
    expect(prompt).not.toContain("사주 용어를 최소 1개");
    expect(prompt).toContain("사주 전문 용어(일간·재성·관성·도화살 등)는 1개까지만 쓰고");
    expect(prompt).toContain("독자의 원국·일주·사주 구조를 묻지 않는다");
    expect(prompt).toContain("지어낸 1인칭 경험담을 쓰지 않는다");
    expect(prompt).toContain("마지막 질문과 첫 댓글에는 사주 전문 용어를 쓰지 않는다");
  });
});
