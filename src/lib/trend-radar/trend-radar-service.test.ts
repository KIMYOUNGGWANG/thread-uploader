import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  updateBrand: vi.fn<(args: { data: { brandConfig: string } }) => Promise<object>>(async () => ({})),
  getCredentials: vi.fn(),
  searchThreads: vi.fn(),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: mocks.create };
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: { brand: { update: mocks.updateBrand } } }));
vi.mock("@/lib/threads-api", () => ({
  getFreshBrandCredentials: mocks.getCredentials,
  searchThreadsByKeyword: mocks.searchThreads,
}));

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
    mocks.getCredentials.mockReset().mockResolvedValue({ accessToken: "token", userId: "u" });
    mocks.searchThreads.mockReset().mockResolvedValue([]);
  });

  it("searches Threads per domain keyword and feeds fresh posts into the harvest prompt with Sonnet", async () => {
    mocks.searchThreads.mockResolvedValue([
      { id: "t1", text: "이직 1년 만에 권고사직 당했는데 다들 어떻게 버팀", timestamp: new Date().toISOString() },
    ]);
    const prompts: string[] = [];
    mocks.create.mockImplementation(async (params: { model: string; tools?: unknown[]; messages: Array<{ content: unknown }> }) => {
      if (!params.tools) return textMessage(transposedJson);
      expect(params.model).toBe("claude-sonnet-5-5");
      prompts.push(String(params.messages[0]?.content));
      return textMessage(harvestJson);
    });
    const { refreshBrandTrendRadar } = await import("./trend-radar-service");

    const result = await refreshBrandTrendRadar({ id: "b1", slug: "cosmicpath", name: "CosmicPath", brandConfig: "{}" });

    expect(result.saved).toBe(3);
    expect(mocks.searchThreads).toHaveBeenCalledWith("token", expect.any(String), expect.any(Number));
    expect(mocks.searchThreads.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(prompts.every((prompt) => prompt.includes("권고사직 당했는데"))).toBe(true);
  });

  it("falls back to web search only when Threads credentials are unavailable", async () => {
    mocks.getCredentials.mockRejectedValue(new Error("token expired"));
    mocks.create.mockImplementation(async (params: { tools?: unknown[] }) =>
      textMessage(params.tools ? harvestJson : transposedJson)
    );
    const { refreshBrandTrendRadar } = await import("./trend-radar-service");

    const result = await refreshBrandTrendRadar({ id: "b1", slug: "cosmicpath", name: "CosmicPath", brandConfig: "{}" });

    expect(result.saved).toBe(3);
    expect(mocks.searchThreads).not.toHaveBeenCalled();
    expect(result.threadsSearch?.skipped).toBe("token expired");
  });

  it("reports keyword search failures in the run result instead of dropping them", async () => {
    mocks.searchThreads.mockRejectedValue(new Error("Threads discovery failed: missing permission"));
    mocks.create.mockImplementation(async (params: { tools?: unknown[] }) =>
      textMessage(params.tools ? harvestJson : transposedJson)
    );
    const { refreshBrandTrendRadar } = await import("./trend-radar-service");

    const result = await refreshBrandTrendRadar({ id: "b1", slug: "cosmicpath", name: "CosmicPath", brandConfig: "{}" });

    const calls = mocks.searchThreads.mock.calls.length;
    expect(result.threadsSearch).toEqual({
      calls,
      failed: calls,
      posts: 0,
      firstError: "Threads discovery failed: missing permission",
    });
  });

  it("resumes a paused web search and stores transposed hooks on brandConfig", async () => {
    mocks.create.mockImplementation(async (params: { tools?: unknown[]; messages: unknown[] }) => {
      if (!params.tools) return textMessage(transposedJson);
      return params.messages.length === 1 ? textMessage("", "pause_turn") : textMessage(harvestJson);
    });
    const { refreshBrandTrendRadar } = await import("./trend-radar-service");

    const result = await refreshBrandTrendRadar({ id: "b1", slug: "cosmicpath", name: "CosmicPath", brandConfig: '{"topics":["커리어"]}' });

    expect(result).toMatchObject({ slug: "cosmicpath", skeletons: 3, saved: 3 });
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
