import type { Brand } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

const LONG = `Scorpios hold grudges like heirlooms.\n\n${"Korean saju reads the hour you were born, not just the month. ".repeat(6)}`;
const SHORT = "Scorpios hold grudges like heirlooms.\n\nKorean saju reads your birth hour too.\n\nThat hour is the part you never chose.";

const state = vi.hoisted(() => ({ prompts: [] as string[], replies: [] as string[], created: [] as Array<{ content: string }> }));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = {
      create: vi.fn(async (request: { messages: Array<{ content: string }> }) => {
        state.prompts.push(request.messages[0].content);
        const text = state.replies.shift() ?? SHORT;
        return { content: [{ type: "text", text: `${text}\n\n===FIRST_COMMENT===\nSave this for your next reading` }] };
      }),
    };
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
      count: vi.fn(async () => 0),
      create: vi.fn(async ({ data }: { data: { content: string } }) => {
        state.created.push(data);
        return { id: `post_${state.created.length}`, ...data };
      }),
      update: vi.fn(async ({ data }: { data: object }) => data),
    },
  },
}));

vi.mock("@/lib/remediation-engine", () => ({
  remediatePostAlgorithmic: vi.fn(async (content: string, firstComment: string | null) => ({
    content, firstComment, pass: true, scoreResult: { totalScore: 90, dimensions: {}, actionableFixes: [] },
    method: "NONE", rewriteCount: 0, actionableFixes: [],
  })),
}));

vi.mock("@/lib/quality-gate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/quality-gate")>()),
  checkQuality: vi.fn(() => ({ pass: true, score: 5, profile: "ecommerce_d2c", reasons: [] })),
}));

vi.mock("@/lib/english-naturalness", () => ({ judgeEnglishNaturalness: vi.fn(async () => ({ natural: true, reason: "" })) }));

import { generatePostsForBrand } from "@/lib/generate-posts";

const brand = {
  id: "brand_global",
  slug: "acme-global",
  brandConfig: JSON.stringify({
    systemPrompt: "Write concise posts in English.",
    topics: ["grudges"],
    targets: ["astrology fans"],
    situations: ["holding a grudge"],
    websiteUrl: "",
    productProfile: { productName: "Acme Global" },
    voiceProfile: { language: "en" },
    campaigns: [{
      id: "acme_global_test",
      name: "Acme Global",
      mode: "landing-test",
      qualityProfile: "ecommerce_d2c",
      perPostLinks: false,
      formulas: [{ id: "plain_take", name: "Plain take", weight: 1, instruction: "one take" }],
    }],
    activeCampaignId: "acme_global_test",
    qualityProfile: "ecommerce_d2c",
  }),
  formulaWeights: "{}",
  growthMemory: "{}",
  viralMemory: "{}",
} as unknown as Brand;

describe("too-long English draft retry", () => {
  it("hands the too-long draft back to be cut down instead of regenerating blind", async () => {
    expect(LONG.length).toBeGreaterThan(300);
    state.replies.push(LONG, SHORT);
    const result = await generatePostsForBrand(brand, { count: 1, insertAtFront: false, requestedCampaignId: null, approvedCampaignStart: false, postCategory: "GENERAL" });
    if (!result.ok) throw new Error(result.error);
    expect(state.prompts).toHaveLength(2);
    // The prompt states the gate's 300 cap, not the generic 500.
    expect(state.prompts[0]).toContain("max 300 chars");
    expect(state.prompts[0]).not.toContain("max 500 chars");
    expect(state.prompts[0]).not.toContain("Previous draft, too long");
    expect(state.prompts[1]).toContain("Too long:");
    expect(state.prompts[1]).toContain(`Previous draft, too long. Keep its hook and strongest lines and cut it down; do not write a new post:\n${LONG.trim()}`);
    expect(state.created[0]?.content).toBe(SHORT);
  });
});
