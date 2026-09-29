import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  requireBrandForCurrentUser: vi.fn(),
  updateBrand: vi.fn(async ({ data }) => ({ id: "brand_1", ...data })),
  evaluateShadowbanHealth: vi.fn(),
  findManyPosts: vi.fn(),
}));

vi.mock("@/lib/brand-access", () => ({
  accessErrorResponse: (err: unknown) => (err instanceof Error && err.message === "UNAUTHORIZED" ? new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }) : null),
  requireBrandForCurrentUser: mocks.requireBrandForCurrentUser,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    brand: {
      update: mocks.updateBrand,
    },
    post: {
      findMany: mocks.findManyPosts,
      count: vi.fn(async () => 0),
    },
  },
}));

vi.mock("@/lib/shadowban-health-probe", async () => {
  const actual = await vi.importActual<typeof import("@/lib/shadowban-health-probe")>("@/lib/shadowban-health-probe");
  return {
    ...actual,
    evaluateShadowbanHealth: mocks.evaluateShadowbanHealth,
  };
});

describe("/api/brands/[id]/health routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/brands/[id]/health", () => {
    it("returns default healthy state when brand has no custom accountHealth", async () => {
      mocks.requireBrandForCurrentUser.mockResolvedValue({
        brand: {
          id: "brand_1",
          slug: "test-brand",
          brandConfig: "{}",
        },
      });

      const { GET } = await import("@/app/api/brands/[id]/health/route");

      const response = await GET(
        new Request("http://localhost/api/brands/brand_1/health") as never,
        { params: Promise.resolve({ id: "brand_1" }) }
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.accountHealth.status).toBe("HEALTHY");
      expect(body.accountHealth.healingDirective.mode).toBe("NORMAL");
    });
  });

  describe("PATCH /api/brands/[id]/health", () => {
    it("forces shadowban status override with warmup-only directive and 1 post/day limit", async () => {
      mocks.requireBrandForCurrentUser.mockResolvedValue({
        brand: {
          id: "brand_1",
          slug: "test-brand",
          brandConfig: JSON.stringify({ accountHealth: { status: "HEALTHY" } }),
        },
      });

      const { PATCH } = await import("@/app/api/brands/[id]/health/route");

      const response = await PATCH(
        new Request("http://localhost/api/brands/brand_1/health", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "SHADOWBAN_SUSPECTED",
            reason: "수동 테스트",
          }),
        }) as never,
        { params: Promise.resolve({ id: "brand_1" }) }
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.accountHealth.status).toBe("SHADOWBAN_SUSPECTED");
      expect(body.accountHealth.healingDirective.mode).toBe("WARMUP_ONLY");
      expect(body.accountHealth.healingDirective.maxDailyPosts).toBe(1);
      expect(body.accountHealth.healingDirective.freezePolarizingFormulas).toBe(true);

      expect(mocks.updateBrand).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "brand_1" },
        })
      );
    });

    it("returns 400 when status is missing", async () => {
      mocks.requireBrandForCurrentUser.mockResolvedValue({
        brand: {
          id: "brand_1",
          slug: "test-brand",
          brandConfig: "{}",
        },
      });

      const { PATCH } = await import("@/app/api/brands/[id]/health/route");

      const response = await PATCH(
        new Request("http://localhost/api/brands/brand_1/health", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }) as never,
        { params: Promise.resolve({ id: "brand_1" }) }
      );

      expect(response.status).toBe(400);
    });
  });

  describe("POST /api/brands/[id]/health", () => {
    it("evaluates health probe on demand and updates brand config", async () => {
      mocks.requireBrandForCurrentUser.mockResolvedValue({
        brand: {
          id: "brand_1",
          slug: "test-brand",
          brandConfig: "{}",
        },
      });

      mocks.findManyPosts.mockResolvedValue([
        { id: "p1", publishedAt: new Date(), views: 10, replies: 0, reposts: 0, likes: 0 },
        { id: "p2", publishedAt: new Date(), views: 12, replies: 0, reposts: 0, likes: 0 },
      ]);

      mocks.evaluateShadowbanHealth.mockReturnValue({
        status: "SHADOWBAN_SUSPECTED",
        reasons: ["최근 3개 포스트 조회수가 기준 대비 70% 이상 급감"],
        metrics: {
          recentAverageViews: 11,
          baselineAverageViews: 200,
          dropPercentage: 94.5,
          consecutiveDepressedCount: 3,
        },
        healingDirective: {
          mode: "WARMUP_ONLY",
          freezePolarizingFormulas: true,
          maxDailyPosts: 1,
          forbiddenElements: ["link", "offer_cta"],
          actionMessage: "노출 급감 감지: 논링크 WARMUP 포스트로 알고리즘 신뢰 회복 필요",
        },
      });

      const { POST } = await import("@/app/api/brands/[id]/health/route");

      const response = await POST(
        new Request("http://localhost/api/brands/brand_1/health", { method: "POST" }) as never,
        { params: Promise.resolve({ id: "brand_1" }) }
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.accountHealth.status).toBe("SHADOWBAN_SUSPECTED");
      expect(body.accountHealth.healingDirective.mode).toBe("WARMUP_ONLY");

      expect(mocks.updateBrand).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "brand_1" },
        })
      );
    });

    it("returns cached health state if evaluated within 60 seconds unless force=true", async () => {
      const recentTimestamp = new Date(Date.now() - 20000).toISOString();
      mocks.requireBrandForCurrentUser.mockResolvedValue({
        brand: {
          id: "brand_1",
          slug: "test-brand",
          brandConfig: JSON.stringify({
            accountHealth: {
              status: "HEALTHY",
              lastEvaluatedAt: recentTimestamp,
            },
          }),
        },
      });

      const { POST } = await import("@/app/api/brands/[id]/health/route");

      // 1. Without force -> cached
      const resCached = await POST(
        new Request("http://localhost/api/brands/brand_1/health", { method: "POST" }) as never,
        { params: Promise.resolve({ id: "brand_1" }) }
      );
      expect(resCached.status).toBe(200);
      const bodyCached = await resCached.json();
      expect(bodyCached.cached).toBe(true);
      expect(bodyCached.accountHealth.status).toBe("HEALTHY");
      expect(mocks.findManyPosts).not.toHaveBeenCalled();

      // 2. With force=true -> bypasses cache
      mocks.findManyPosts.mockResolvedValue([]);
      mocks.evaluateShadowbanHealth.mockReturnValue({
        status: "HEALTHY",
        reasons: ["강제 재평가 완료"],
        metrics: {
          recentAverageViews: 100,
          baselineAverageViews: 100,
          dropPercentage: 0,
          consecutiveDepressedCount: 0,
        },
      });

      const resForce = await POST(
        new Request("http://localhost/api/brands/brand_1/health?force=true", { method: "POST" }) as never,
        { params: Promise.resolve({ id: "brand_1" }) }
      );
      expect(resForce.status).toBe(200);
      const bodyForce = await resForce.json();
      expect(bodyForce.cached).toBeUndefined();
      expect(mocks.findManyPosts).toHaveBeenCalled();
    });
  });
});
