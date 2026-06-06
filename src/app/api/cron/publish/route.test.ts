import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findBrands: vi.fn(),
  findPost: vi.fn(),
  updatePost: vi.fn(async ({ data }) => ({ id: "post_1", ...data })),
  publishPostWithCredentials: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    brand: {
      findMany: mocks.findBrands,
    },
    post: {
      findFirst: mocks.findPost,
      count: vi.fn(async () => 0),
      update: mocks.updatePost,
    },
  },
}));

vi.mock("@/lib/threads-api", () => ({
  getFreshBrandCredentials: vi.fn(async () => ({ accessToken: "token", userId: "user" })),
  publishPostWithCredentials: mocks.publishPostWithCredentials,
  publishReplyWithRetryForBrand: vi.fn(),
}));

describe("GET /api/cron/publish", () => {
  it("blocks stale quality-passing reply-burden posts before cron publish", async () => {
    mocks.findBrands.mockResolvedValue([{ id: "brand_1", name: "CosmicPath" }]);
    mocks.findPost.mockResolvedValue({
      id: "post_1",
      brandId: "brand_1",
      status: "PENDING",
      qualityPass: true,
      content: "이직할지 버틸지 모르겠다면 A/B/C 중 골라봐. 댓글에 지금 상황 짧게 써줘. 같이 보자.",
      firstComment: null,
      imageUrls: "[]",
    });
    const { GET } = await import("@/app/api/cron/publish/route");

    const response = await GET({
      headers: new Headers(),
      nextUrl: new URL("http://localhost/api/cron/publish"),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.skipped).toEqual([{ brandId: "brand_1", brandName: "CosmicPath", reason: "quality_blocked" }]);
    expect(mocks.updatePost).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "post_1" },
      data: expect.objectContaining({ qualityPass: false }),
    }));
    expect(mocks.publishPostWithCredentials).not.toHaveBeenCalled();
  });
});
