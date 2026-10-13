import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  updateBrand: vi.fn<(args: { data: { brandConfig: string } }) => Promise<object>>(async () => ({})),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: mocks.create };
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: { brand: { update: mocks.updateBrand } } }));

const textMessage = (text: string, stopReason = "end_turn") => ({
  content: [{ type: "text", text }],
  stop_reason: stopReason,
});

const harvestJson = "```json\n" + JSON.stringify([{
  unspokenAnxiety: "권고사직 불안",
  cognitiveDissonance: "간판 믿었는데 배신",
  headlineHook: "대기업 간판 믿고 간 사람들 1년 뒤",
  choiceOptions: ["A. 버팀", "B. 이동", "C. 준비"],
}]) + "\n```";

const transposedJson = JSON.stringify({
  hookHeadline: "이직 1년 차에 무너지는 사주 공통점",
  openingNarrative: "실력이 아니라 대운 타이밍",
  brandEquivalentConcept: "대운 교운기",
  choiceMatrix: ["A. 버팀", "B. 이동", "C. 준비"],
});

describe("refreshBrandTrendRadar", () => {
  beforeEach(() => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    mocks.create.mockReset();
    mocks.updateBrand.mockClear();
  });

  it("resumes a paused web search and stores transposed hooks on brandConfig", async () => {
    mocks.create.mockImplementation(async (params: { tools?: unknown[]; messages: unknown[] }) => {
      if (!params.tools) return textMessage(transposedJson);
      return params.messages.length === 1 ? textMessage("", "pause_turn") : textMessage(harvestJson);
    });
    const { refreshBrandTrendRadar } = await import("./trend-radar-service");

    const result = await refreshBrandTrendRadar({ id: "b1", slug: "cosmicpath", name: "CosmicPath", brandConfig: '{"topics":["커리어"]}' });

    expect(result).toEqual({ slug: "cosmicpath", skeletons: 3, saved: 3 });
    const savedArgs = mocks.updateBrand.mock.calls[0]?.[0];
    if (!savedArgs) throw new Error("brand.update was not called");
    const saved = JSON.parse(savedArgs.data.brandConfig);
    expect(saved.topics).toEqual(["커리어"]);
    expect(saved.trendRadar.items[0].hookHeadline).toBe("이직 1년 차에 무너지는 사주 공통점");
  });

  it("skips English brands without calling Claude", async () => {
    const { refreshBrandTrendRadar } = await import("./trend-radar-service");
    const result = await refreshBrandTrendRadar({ id: "b2", slug: "cosmicpath-global", name: "Global", brandConfig: "{}" });
    expect(result.skipped).toBe("trend radar sources are Korean-only");
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
