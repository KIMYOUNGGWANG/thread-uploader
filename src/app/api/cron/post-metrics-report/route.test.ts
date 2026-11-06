import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ verify: vi.fn(), findBrand: vi.fn(), findPosts: vi.fn() }));
vi.mock("@/lib/cron-auth", () => ({ verifyCronSecret: mocks.verify }));
vi.mock("@/lib/prisma", () => ({ prisma: { brand: { findUnique: mocks.findBrand }, post: { findMany: mocks.findPosts } } }));

const call = async (query: string) => {
  const { GET } = await import("@/app/api/cron/post-metrics-report/route");
  const response = await GET({ headers: new Headers(), nextUrl: new URL(`http://localhost/api/cron/post-metrics-report?${query}`) } as never);
  return { status: response.status, body: await response.json() };
};

describe("GET /api/cron/post-metrics-report", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verify.mockReturnValue(true);
    mocks.findBrand.mockResolvedValue({ id: "b1" });
    mocks.findPosts.mockResolvedValue([
      { id: "p1", publishedAt: new Date("2026-11-05T16:00:00Z"), formulaId: "cost_loss_punch", postCategory: "GROWTH", content: "\n복채 10만원 내고\n둘째 줄", views: 42, likes: 1, replies: 1, reposts: 0, clicks: null, linkUrl: null, metricsAt: null },
    ]);
  });

  it("requires the cron secret and a brand", async () => {
    mocks.verify.mockReturnValueOnce(false);
    expect((await call("brand=cosmicpath")).status).toBe(401);
    expect((await call("")).status).toBe(400);
  });

  it("returns published posts with metrics and only the opening line", async () => {
    const { body } = await call("brand=cosmicpath&days=7");
    expect(mocks.findPosts).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ brandId: "b1", status: "PUBLISHED" }) }));
    expect(body.posts[0]).toMatchObject({ formulaId: "cost_loss_punch", views: 42, linked: false, opening: "복채 10만원 내고" });
    expect(body.days).toBe(7);
  });

  it("caps the window at 60 days", async () => {
    expect((await call("brand=cosmicpath&days=999")).body.days).toBe(60);
  });
});
