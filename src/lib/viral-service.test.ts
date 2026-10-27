import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { harvestFromThreadsSources, type HarvestedCandidate } from "@/lib/viral-harvester";
import { discoverViralExamples, getViralReport, learnViralPatterns } from "@/lib/viral-service";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    viralExample: {
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => 0),
      findUnique: vi.fn(async () => null),
      upsert: vi.fn(async () => ({})),
    },
    viralPattern: { findMany: vi.fn(async () => []), deleteMany: vi.fn(), create: vi.fn() },
    post: { findMany: vi.fn(async () => []) },
    brand: { findUnique: vi.fn(async () => ({ id: "b1", viralMemory: "{}", brandConfig: "{}" })), update: vi.fn() },
    $transaction: vi.fn(async (ops: unknown[]) => ops),
  },
}));

vi.mock("@/lib/crypto", () => ({ decryptToken: vi.fn(() => "token") }));
vi.mock("@/lib/viral-harvester", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/viral-harvester")>()),
  harvestFromThreadsSources: vi.fn(),
}));

const EXCLUDE_SHORTS = expect.objectContaining({ source: { not: "youtube_shorts" } });

describe("viral-service shorts exclusion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getViralReport excludes shorts from examples and sample count", async () => {
    await getViralReport("b1");

    expect(prisma.viralExample.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: EXCLUDE_SHORTS }),
    );
    expect(prisma.viralExample.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ brandId: "b1", source: { not: "youtube_shorts" } }),
    });
  });

  it("learnViralPatterns excludes shorts from pattern learning input", async () => {
    await learnViralPatterns("b1");

    expect(prisma.viralExample.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: EXCLUDE_SHORTS }),
    );
  });
});

describe("viral-service own-post candidates", () => {
  it("excludes New Year posts but keeps NULL formulaId rows", async () => {
    await discoverViralExamples("b1", { includeOwnPosts: true });

    expect(prisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: [{ OR: [{ formulaId: null }, { formulaId: { notIn: ["ny_ranking", "ny_ipchun", "ny_monthly", "ny_pick", "ny_zodiac"] } }] }],
        }),
      }),
    );
  });
});

describe("viral-service reference score and eligibility", () => {
  const DAY_MS = 24 * 60 * 60 * 1000;

  function harvested(authorUsername: string, sourceKey: string, publishedAt: Date): HarvestedCandidate {
    return {
      adapter: "threads_keyword",
      source: "keyword:사주",
      sourceKey,
      contentHash: sourceKey,
      authorUsername,
      permalink: null,
      content: "솔직히 사주 볼 때 이거 먼저 봐?\n1. 일간\n2. 월지",
      publishedAt,
      views: null,
      likes: null,
      replies: null,
      reposts: null,
      quotes: null,
      shares: null,
      rawMetrics: { searchRank: 1, keywordHits: 1, hasReplies: true },
    };
  }

  function mockHarvest(...candidates: HarvestedCandidate[]) {
    vi.mocked(harvestFromThreadsSources).mockResolvedValue({
      candidates,
      errors: [],
      totalDiscovered: candidates.length,
      attemptedSources: 1,
    });
  }

  type UpsertArg = { create: { authorUsername: string | null; rawMetrics: string } };
  function upsertCalls(): UpsertArg[] {
    return vi.mocked(prisma.viralExample.upsert).mock.calls.map(([arg]) => arg as unknown as UpsertArg);
  }

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(prisma.brand.findUnique).mockResolvedValue({
      id: "b1",
      viralMemory: "{}",
      accessToken: "enc",
      brandConfig: JSON.stringify({ viralDiscovery: { keywords: ["사주"], ownHandle: "@CosmicPath" } }),
    } as never);
    vi.mocked(prisma.viralExample.findMany).mockResolvedValue([]);
    vi.mocked(prisma.viralExample.count).mockResolvedValue(0);
    vi.mocked(prisma.viralExample.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.viralExample.upsert).mockResolvedValue({} as never);
    vi.mocked(prisma.viralPattern.findMany).mockResolvedValue([]);
    vi.mocked(prisma.post.findMany).mockResolvedValue([]);
  });

  it("stores referenceScore and eligibility on each saved example", async () => {
    const published = new Date(Date.now() - 3 * DAY_MS);
    mockHarvest(harvested("the.saju", "p1", published), harvested("cosmicpath", "p2", published));

    await discoverViralExamples("b1");

    const saved = upsertCalls().map((call) => ({ author: call.create.authorUsername, metrics: JSON.parse(call.create.rawMetrics) }));
    expect(saved).toHaveLength(2);
    expect(saved.find((item) => item.author === "cosmicpath")?.metrics.eligibleSource).toBe(false);
    expect(saved.every((item) => typeof item.metrics.referenceScore === "number")).toBe(true);
  });

  it("a post seen in two runs becomes eligible", async () => {
    mockHarvest(harvested("the.saju", "p1", new Date(Date.now() - 3 * DAY_MS)));

    await discoverViralExamples("b1");
    const first = JSON.parse(upsertCalls()[0].create.rawMetrics);
    expect(first).toMatchObject({ timesSeen: 1, eligibleSource: false });

    vi.mocked(prisma.viralExample.findUnique).mockResolvedValue({ rawMetrics: upsertCalls()[0].create.rawMetrics } as never);
    await discoverViralExamples("b1");
    const second = JSON.parse(upsertCalls()[1].create.rawMetrics);
    expect(second).toMatchObject({ timesSeen: 2, eligibleSource: true });
  });
});
