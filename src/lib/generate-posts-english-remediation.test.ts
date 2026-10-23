import type { Brand } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL = "Most people pick the safe job and call it maturity.\n\nThe ones who switch early rarely regret the pay cut.\n\nA) I stayed\nB) I switched\n\nWhich one are you?";
const NATURAL_REWRITE = "Most people stay in the safe job and call it being grown up.\n\nThe ones who leave early rarely miss the pay.\n\nA) I stayed\nB) I left\n\nWhich one are you?";
const UNNATURAL_REWRITE = "Most people actually choose the safe job, instead, and call it maturity.\n\nThe ones who switch early rarely regret the pay cut.\n\nA) I stayed\nB) I switched\n\nWhich one are you?";

const state = vi.hoisted(() => ({
  rewrite: "",
  created: [] as Array<{ content: string; qualityReasons: string }>,
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = {
      create: vi.fn(async () => ({ content: [{ type: "text", text: `${ORIGINAL}\n\n===FIRST_COMMENT===\nSave this for later` }] })),
    };
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
      count: vi.fn(async () => 0),
      create: vi.fn(async ({ data }: { data: { content: string; qualityReasons: string } }) => {
        state.created.push(data);
        return { id: `post_${state.created.length}`, ...data };
      }),
      update: vi.fn(async ({ data }: { data: object }) => data),
    },
  },
}));

vi.mock("@/lib/remediation-engine", () => ({
  remediatePostAlgorithmic: vi.fn(async (_content: string, firstComment: string | null) => ({
    content: state.rewrite,
    firstComment,
    pass: true,
    scoreResult: { totalScore: 90, dimensions: {}, actionableFixes: [] },
    method: "TARGETED_REWRITE",
    rewriteCount: 1,
    actionableFixes: [],
  })),
}));

vi.mock("@/lib/quality-gate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/quality-gate")>()),
  checkQuality: vi.fn(() => ({ pass: true, score: 5, profile: "saju_viral", reasons: [] })),
}));

vi.mock("@/lib/english-naturalness", () => ({
  judgeEnglishNaturalness: vi.fn(async (post: string) =>
    post === UNNATURAL_REWRITE ? { natural: false, reason: "stacked hedge" } : { natural: true, reason: "" }
  ),
}));

vi.mock("@/lib/threads-algorithm-scorer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/threads-algorithm-scorer")>();
  return {
    ...actual,
    scoreThreadsPostAlgorithmic: vi.fn(() => ({ totalScore: 90, dimensions: {}, actionableFixes: [] })),
  };
});

import { generatePostsForBrand } from "@/lib/generate-posts";

const brand = {
  id: "brand_global",
  slug: "acme-global",
  brandConfig: JSON.stringify({
    systemPrompt: "Write concise posts in English.",
    topics: ["career switch timing"],
    targets: ["people thinking about a job change"],
    situations: ["stuck between staying and leaving"],
    websiteUrl: "",
    productProfile: { productName: "Acme Global" },
    voiceProfile: { language: "en" },
    campaigns: [{
      id: "acme_global_test",
      name: "Acme Global",
      mode: "landing-test",
      qualityProfile: "saju_viral",
      perPostLinks: false,
      formulas: [{ id: "concept_hierarchy", name: "Concept ranking", weight: 1, instruction: "rank" }],
    }],
    activeCampaignId: "acme_global_test",
    qualityProfile: "saju_viral",
  }),
  formulaWeights: "{}",
  growthMemory: "{}",
  viralMemory: "{}",
} as unknown as Brand;
const input = { count: 1, insertAtFront: false, requestedCampaignId: null, approvedCampaignStart: false, postCategory: "GENERAL" };

describe("English remediation rewrite naturalness", () => {
  beforeEach(() => {
    state.created.length = 0;
  });

  it("saves the original when the rewrite is judged unnatural", async () => {
    state.rewrite = UNNATURAL_REWRITE;
    const result = await generatePostsForBrand(brand, input);
    if (!result.ok) throw new Error(result.error);
    expect(state.created).toHaveLength(1);
    expect(state.created[0]?.content).toBe(ORIGINAL);
    expect(state.created[0]?.qualityReasons).toContain("remediation_reverted");
  });

  it("keeps a rewrite the judge finds natural", async () => {
    state.rewrite = NATURAL_REWRITE;
    const result = await generatePostsForBrand(brand, input);
    if (!result.ok) throw new Error(result.error);
    expect(state.created).toHaveLength(1);
    expect(state.created[0]?.content).toBe(NATURAL_REWRITE);
  });
});
