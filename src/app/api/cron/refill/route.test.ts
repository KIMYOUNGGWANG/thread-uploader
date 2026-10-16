import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findBrand: vi.fn(),
  countPosts: vi.fn(),
  findPosts: vi.fn<(args: { where: { status: string } }) => Promise<unknown[]>>(async () => []),
  generate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { brand: { findUnique: mocks.findBrand }, post: { count: mocks.countPosts, findMany: mocks.findPosts } },
}));
vi.mock("@/lib/generate-posts", () => ({ generatePostsForBrand: mocks.generate }));

const call = async (query: string) => {
  const { GET } = await import("@/app/api/cron/refill/route");
  const response = await GET({ headers: new Headers(), nextUrl: new URL(`http://localhost/api/cron/refill?${query}`) } as never);
  return { status: response.status, body: await response.json() };
};

describe("GET /api/cron/refill", () => {
  beforeEach(() => {
    mocks.findBrand.mockResolvedValue({ id: "b1", slug: "cosmicpath" });
    mocks.generate.mockReset();
  });

  it("tops the backlog up to the target without auto-approving campaigns", async () => {
    mocks.countPosts.mockResolvedValue(7);
    mocks.generate.mockResolvedValue({ ok: true, summary: { count: 3, failedCount: 0, linkedCount: 1, campaignId: null, auditSummary: { total: 3, passed: 3, needsReview: 0 } } });

    const { body } = await call("brand=cosmicpath&target=10");

    expect(mocks.generate).toHaveBeenCalledWith(expect.objectContaining({ id: "b1" }), expect.objectContaining({ count: 3, approvedCampaignStart: false }));
    expect(body.generated).toBe(3);
  });

  it("skips generation when the backlog already meets the target", async () => {
    mocks.countPosts.mockResolvedValue(12);
    const { body } = await call("brand=cosmicpath&target=10");
    expect(body.skipped).toBe("backlog_full");
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("reports generation failures instead of throwing", async () => {
    mocks.countPosts.mockResolvedValue(0);
    mocks.generate.mockRejectedValue(new Error("All 6 drafts failed to generate"));
    const { status, body } = await call("brand=cosmicpath&target=10");
    expect(status).toBe(500);
    expect(body.error).toBe("All 6 drafts failed to generate");
  });

  it("rejects missing params", async () => {
    expect((await call("brand=cosmicpath")).status).toBe(400);
  });

  it("under a length experiment, refills by per-arm pending drafts instead of the backlog", async () => {
    const lengthExperiment = { startAt: "2026-01-01T00:00:00.000Z", sequence: "LS", shortMax: 260, longMin: 390 };
    mocks.findBrand.mockResolvedValue({ id: "b1", slug: "cosmicpath", brandConfig: JSON.stringify({ lengthExperiment }) });
    mocks.countPosts.mockResolvedValue(12); // NEEDS_REVIEW nobody will approve during the experiment
    const shortDraft = { content: "가".repeat(200), postCategory: "GROWTH", formulaId: "f", createdAt: new Date("2026-02-01T00:00:00.000Z") };
    mocks.findPosts.mockImplementation(async ({ where }: { where: { status: string } }) => (where.status === "PENDING" ? Array(5).fill(shortDraft) : []));
    mocks.generate.mockResolvedValue({ ok: true, summary: { count: 5, failedCount: 0, linkedCount: 0, campaignId: null, auditSummary: { total: 5, passed: 5, needsReview: 0 } } });

    const { body } = await call("brand=cosmicpath&target=10");

    expect(mocks.generate).toHaveBeenCalledWith(expect.objectContaining({ id: "b1" }), expect.objectContaining({ count: 5 }));
    expect(body.lengthExperiment).toEqual({ arm: "L", pending: { S: 5, L: 0 } });
  });
});
