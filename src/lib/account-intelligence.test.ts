import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findBrand: vi.fn(),
  findPosts: vi.fn(),
  updatePost: vi.fn(async () => ({})),
  createInsight: vi.fn(),
  mirror: vi.fn(async () => {}),
  fetchInsights: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    brand: { findUnique: mocks.findBrand },
    post: { findMany: mocks.findPosts, update: mocks.updatePost },
    accountInsight: { create: mocks.createInsight },
  },
}));
vi.mock("@/lib/channels/publication-mirror", () => ({ mirrorThreadsFromPost: mocks.mirror }));
vi.mock("@/lib/crypto", () => ({ decryptToken: (token: string) => token }));
vi.mock("@/lib/threads-api", () => ({
  fetchPostInsightsForBrand: mocks.fetchInsights,
  fetchFollowersCountForBrand: vi.fn(async () => null),
}));

import { runAccountIntelligence } from "@/lib/account-intelligence";

const metricsPost = { id: "post_1", threadsId: "t_1", clicks: 0, conversions: 0, manualPaidConversions: 0 };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findBrand.mockResolvedValue({ id: "brand_1", accessToken: "token", threadsUserId: null });
  mocks.findPosts.mockResolvedValueOnce([metricsPost]).mockResolvedValue([]);
  mocks.createInsight.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: "insight_1",
    generatedAt: new Date(),
    ...data,
  }));
});

describe("refreshRecentMetrics via runAccountIntelligence", () => {
  it("mirrors the Publication right after writing Threads metrics to Post", async () => {
    mocks.fetchInsights.mockResolvedValue({ views: 10, likes: 2, replies: 1, reposts: 0 });

    await runAccountIntelligence("brand_1");

    expect(mocks.updatePost).toHaveBeenCalledTimes(1);
    expect(mocks.mirror).toHaveBeenCalledWith("post_1");
    expect(mocks.updatePost.mock.invocationCallOrder[0]).toBeLessThan(mocks.mirror.mock.invocationCallOrder[0]);
  });

  it("does not mirror when the insights fetch fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.fetchInsights.mockRejectedValue(new Error("boom"));

    await runAccountIntelligence("brand_1");

    expect(mocks.updatePost).not.toHaveBeenCalled();
    expect(mocks.mirror).not.toHaveBeenCalled();
  });
});
