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
import { prisma } from "@/lib/prisma";
import { getDomainPreset } from "@/lib/domain-registry";
import { checkAntiRepeatSimilarity } from "@/lib/anti-repeat-memory";

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
const INFO_REWRITE = "디자이너 없이 화면 퀄리티 올리는 무료 사이트 3개\n\n1. uiverse.io — 버튼·카드 같은 조각을 복사해서 바로 붙이면 끝\n2. shadcn/ui — 기본 컴포넌트를 내 코드로 가져와서 마음대로 고칠 수 있음\n3. magicui.design — 랜딩에 움직임 하나 넣고 싶을 때 제일 빠름\n\n사주로 치면 내 일간에 맞는 도구를 고르는 셈이야. 저장해두고 다음 사이드 프로젝트 때 꺼내 써";

function withConfig(patch: (config: Record<string, unknown>) => void): Brand {
  const config: Record<string, unknown> = JSON.parse(brand.brandConfig);
  patch(config);
  return { ...brand, brandConfig: JSON.stringify(config) };
}
// Same brand with per-post links on, so a draft would normally get the product link.
const linkedBrand = withConfig((config) => {
  const campaigns = config.campaigns as Array<Record<string, unknown>>;
  campaigns[0] = { ...campaigns[0], perPostLinks: true, linkCadenceEvery: 1 };
});
// Passes validateProductGrowthCampaignReadiness, so the run reaches the prompt.
const productBrand = withConfig((config) => {
  const campaigns = config.campaigns as Array<Record<string, unknown>>;
  campaigns[0] = { ...campaigns[0], qualityProfile: "product_growth", landingUrl: "https://example.com/start" };
  config.qualityProfile = "product_growth";
  config.productProfile = {
    productName: "OpsFlow",
    oneLineDescription: "정산 자동화 도구",
    targetCustomer: "엑셀로 정산하는 작은 팀",
    offerPromise: "주 3시간 절약",
    landingUrl: "https://example.com/start",
  };
  config.activeExperiment = { status: "active" };
});
const input = { count: 3, insertAtFront: false, requestedCampaignId: null, approvedCampaignStart: false, postCategory: "GROWTH" };

describe("ref_replay draft", () => {
  beforeEach(() => {
    vi.stubEnv("NEW_YEAR_SEASON_DISABLED", "1");
    state.created.length = 0;
    state.requests.length = 0;
    vi.mocked(loadWinnerReplaySource).mockClear();
    vi.mocked(prisma.post.create).mockClear();
    vi.mocked(prisma.post.update).mockClear();
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

  it("manual info reference with link: NEEDS_REVIEW, original link in first comment, no product link", async () => {
    state.reply = INFO_REWRITE;
    await generatePostsForBrand(linkedBrand, {
      ...input,
      referenceReplay: { id: "ex_m", content: "5 free UI resources…", kind: "info", linkUrl: "https://uiverse.io", manual: true },
      initialStatus: "NEEDS_REVIEW",
    });
    expect(prisma.post.create).toHaveBeenCalledWith({ data: expect.objectContaining({ status: "NEEDS_REVIEW" }) });
    const created = vi.mocked(prisma.post.create).mock.calls[0]?.[0].data;
    expect(created?.firstComment).toMatch(/→ https:\/\/uiverse\.io$/);
    expect(created?.formulaId).toBe("ref_replay_info");
    const reasons: unknown = JSON.parse(String(created?.qualityReasons ?? "[]"));
    expect(reasons).toEqual(expect.arrayContaining(["ref_replay_manual", `${REFERENCE_REPLAY_SOURCE_PREFIX}ex_m`]));
    expect(prisma.post.update).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ linkUrl: expect.anything() }) }));
    const prompt = state.requests[0];
    expect(prompt).not.toContain("/r/");
    // The only prompt text that depends on shouldLink being true (formatCampaignPrompt's link policy).
    expect(prompt).not.toContain("이번 글은 첫 댓글에 링크가 붙을 예정");
  });

  it("info reference without link keeps the normal link policy", async () => {
    state.reply = INFO_REWRITE;
    await generatePostsForBrand(linkedBrand, { ...input, referenceReplay: { id: "ex_n", content: "5 free UI resources…", kind: "info" } });
    expect(prisma.post.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ linkUrl: expect.any(String) }) }));
  });

  it("calls without initialStatus still save PENDING", async () => {
    state.reply = "점집에서 10만원 내고 들은 말이 '좋은 흐름 온다'뿐이었다면\n\n그 돈으로 차라리 내 흐름을 직접 읽는 법을 배우는 게 낫지 않을까\n\n너라면 어느 쪽이야?";
    await generatePostsForBrand(brand, { ...input, referenceReplay: SOURCE });
    expect(prisma.post.create).toHaveBeenCalledWith({ data: expect.objectContaining({ status: "PENDING" }) });
  });

  it("prompt uses the brand's domain angle", async () => {
    state.reply = "엑셀로 매주 3시간씩 정산하던 팀이 자동화 하나로 퇴근이 빨라졌다\n\n도구 값보다 사람 시간이 더 비쌌던 거야\n\n너희 팀은 어디서 시간이 새?";
    const result = await generatePostsForBrand(productBrand, { ...input, approvedCampaignStart: true, referenceReplay: SOURCE });
    expect(result.ok).toBe(true);
    const prompt = state.requests[0];
    expect(prompt).toContain(getDomainPreset("product_growth").description);
    expect(prompt).not.toContain("사주·궁합·타이밍");
  });
});

describe("info rewrite similarity", () => {
  it("info rewrite that keeps tool names is not flagged as a copy", () => {
    const source = "5 free web UI resources 👇\n1. uiverse.io\n2. shadcn/ui\n3. magicui.design";
    const rewrite = "디자이너 없이 화면 퀄리티 올리는 무료 사이트 3개\n\n1. uiverse.io — 버튼·카드 같은 조각을 복사해서 바로 붙이면 끝\n2. shadcn/ui — 기본 컴포넌트를 내 코드로 가져와서 마음대로 고칠 수 있음\n3. magicui.design — 랜딩에 움직임 하나 넣고 싶을 때 제일 빠름\n\n저장해두고 다음 사이드 프로젝트 때 꺼내 써";
    expect(checkAntiRepeatSimilarity(rewrite, [{ content: source }]).isDuplicate).toBe(false);
  });
});
