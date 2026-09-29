import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findBrands: vi.fn(),
  updateBrand: vi.fn(),
  findPost: vi.fn(),
  updatePost: vi.fn(async ({ data }) => ({ id: "post_1", ...data })),
  publishPostWithCredentials: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    brand: {
      findMany: mocks.findBrands,
      update: mocks.updateBrand,
    },
    post: {
      findFirst: mocks.findPost,
      findUnique: mocks.findPost,
      count: vi.fn(async () => 0),
      update: mocks.updatePost,
      updateMany: vi.fn(async () => ({ count: 1 })),
      create: vi.fn(async ({ data }) => ({ id: "created_post", ...data })),
    },
  },
}));

vi.mock("@/lib/threads-api", () => ({
  getFreshBrandCredentials: vi.fn(async () => ({ accessToken: "token", userId: "user" })),
  publishPostWithCredentials: mocks.publishPostWithCredentials,
  publishReplyWithRetryForBrand: vi.fn(),
  publishThreadChainWithCredentials: vi.fn(async () => ({ rootThreadsId: "threads_root_123", partIds: ["threads_root_123"] })),
}));

vi.mock("@/lib/behavioral-jitter", async () => {
  const actual = await vi.importActual<typeof import("@/lib/behavioral-jitter")>("@/lib/behavioral-jitter");
  return {
    ...actual,
    isCircadianQuietHour: vi.fn(() => false),
    checkMinimumCooldown: vi.fn(() => ({ allowed: true, remainingMinutes: 0, earliestAllowedAt: new Date() })),
  };
});

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

  it("skips scheduled tick when sporadic mode is active and marks lastTickSkipped", async () => {
    mocks.updateBrand.mockResolvedValue({});

    mocks.findBrands.mockResolvedValue([
      {
        id: "brand_sporadic",
        name: "CosmicPath",
        brandConfig: JSON.stringify({ sporadicEnabled: true, lastTickSkipped: false }),
      },
    ]);
    mocks.findPost.mockResolvedValue(null);

    // Mock sporadic skip to trigger
    const behavioralJitter = await import("@/lib/behavioral-jitter");
    const spy = vi.spyOn(behavioralJitter, "evaluateSporadicSkip").mockReturnValue({
      shouldSkip: true,
      reason: "sporadic_skip",
      skipProbability: 0.18,
    });

    const { GET } = await import("@/app/api/cron/publish/route");
    const response = await GET({
      headers: new Headers(),
      nextUrl: new URL("http://localhost/api/cron/publish"),
    } as never);
    const body = await response.json();

    expect(body.skipped).toEqual([
      { brandId: "brand_sporadic", brandName: "CosmicPath", reason: "sporadic_skip" },
    ]);
    expect(mocks.updateBrand).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "brand_sporadic" },
        data: expect.objectContaining({
          brandConfig: expect.stringContaining('"lastTickSkipped":true'),
        }),
      })
    );

    spy.mockRestore();
  });

  it("prioritizes WARMUP post when brand is in SHADOWBAN_SUSPECTED mode", async () => {
    mocks.findBrands.mockResolvedValue([
      {
        id: "brand_shadowban",
        name: "ShadowBrand",
        brandConfig: JSON.stringify({
          shadowbanStatus: "SHADOWBAN_SUSPECTED",
          accountTrustTier: "established",
        }),
      },
    ]);

    mocks.publishPostWithCredentials.mockResolvedValue("threads_root_123");
    mocks.findPost.mockImplementation(async ({ where }) => {
      if (where?.status === "PARTIAL_FAILED" || where?.status === "PUBLISHED") {
        return null;
      }
      if (where?.postCategory === "WARMUP" || where?.id === "warmup_post_1") {
        return {
          id: "warmup_post_1",
          brandId: "brand_shadowban",
          status: "PENDING",
          postCategory: "WARMUP",
          qualityPass: true,
          content: "오늘 하루도 애쓰셨습니다. 따뜻한 저녁 되세요.",
          firstComment: null,
          imageUrls: "[]",
          threadPartsPosted: 0,
          threadTotalParts: 1,
        };
      }
      return null;
    });

    const { GET } = await import("@/app/api/cron/publish/route");
    const response = await GET({
      headers: new Headers(),
      nextUrl: new URL("http://localhost/api/cron/publish"),
    } as never);

    expect(response.status).toBe(200);
    expect(mocks.findPost).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          brandId: "brand_shadowban",
          postCategory: "WARMUP",
        }),
      })
    );
  });
});

