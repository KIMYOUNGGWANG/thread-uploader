import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findBrands: vi.fn(),
  updateBrand: vi.fn(),
  findPost: vi.fn(),
  updatePost: vi.fn(async ({ data }) => ({ id: "post_1", ...data })),
  publishPostWithCredentials: vi.fn(),
  sendSystemAlert: vi.fn(async () => false),
}));

vi.mock("@/lib/alert-service", () => ({ sendSystemAlert: mocks.sendSystemAlert }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    brand: {
      findMany: mocks.findBrands,
      update: mocks.updateBrand,
    },
    post: {
      findFirst: mocks.findPost,
      findUnique: mocks.findPost,
      findMany: vi.fn(async () => []),
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
  it("skips without touching the post when the daily tier quota is already reached", async () => {
    mocks.findBrands.mockResolvedValue([
      { id: "brand_quota", name: "QuotaBrand", brandConfig: JSON.stringify({ accountTrustTier: "newbie" }) },
    ]);
    mocks.findPost.mockImplementation(async ({ where }) => {
      if (where?.status === "PARTIAL_FAILED" || where?.status === "PUBLISHED") return null;
      return {
        id: "post_quota",
        brandId: "brand_quota",
        status: "PENDING",
        qualityPass: true,
        content: "이직할지 버틸지 고민될 때 3가지 기준부터 나눠봐.",
        firstComment: null,
        imageUrls: "[]",
      };
    });
    const { prisma } = await import("@/lib/prisma");
    // Newbie quota is 1: the 24h safety counter and the day counter both see 1 published post
    vi.mocked(prisma.post.count).mockResolvedValue(1);
    mocks.updatePost.mockClear();

    try {
      const { GET } = await import("@/app/api/cron/publish/route");
      const response = await GET({
        headers: new Headers(),
        nextUrl: new URL("http://localhost/api/cron/publish"),
      } as never);
      const body = await response.json();

      expect(body.skipped).toEqual([{ brandId: "brand_quota", brandName: "QuotaBrand", reason: "daily_quota_reached" }]);
      expect(mocks.updatePost).not.toHaveBeenCalled();
      expect(mocks.publishPostWithCredentials).not.toHaveBeenCalled();
    } finally {
      vi.mocked(prisma.post.count).mockResolvedValue(0);
    }
  });

  it("caps the day at the active campaign's dailyPostTarget when it is below the tier quota", async () => {
    // Established tier allows 5/day, but the campaign asks for 3: the 4th post must wait for tomorrow.
    mocks.findBrands.mockResolvedValue([
      {
        id: "brand_campaign_cap",
        name: "CampaignCapBrand",
        brandConfig: JSON.stringify({ accountTrustTier: "established", campaigns: [{ id: "camp_3", dailyPostTarget: 3 }] }),
      },
    ]);
    mocks.findPost.mockImplementation(async ({ where }) => {
      if (where?.status === "PARTIAL_FAILED" || where?.status === "PUBLISHED") return null;
      return {
        id: "post_campaign_cap",
        brandId: "brand_campaign_cap",
        status: "PENDING",
        qualityPass: true,
        content: "이직할지 버틸지 고민될 때 3가지 기준부터 나눠봐.",
        firstComment: null,
        imageUrls: "[]",
      };
    });
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.post.count).mockResolvedValue(3);
    mocks.updatePost.mockClear();
    mocks.publishPostWithCredentials.mockClear();

    try {
      const { GET } = await import("@/app/api/cron/publish/route");
      const response = await GET({
        headers: new Headers(),
        nextUrl: new URL("http://localhost/api/cron/publish"),
      } as never);
      const body = await response.json();

      expect(body.skipped).toEqual([{ brandId: "brand_campaign_cap", brandName: "CampaignCapBrand", reason: "daily_quota_reached" }]);
      expect(mocks.publishPostWithCredentials).not.toHaveBeenCalled();
    } finally {
      vi.mocked(prisma.post.count).mockResolvedValue(0);
    }
  });

  describe("empty publish queue", () => {
    const runWithQueue = async (counts: { needsReview?: number; scheduledLater?: number }) => {
      mocks.findBrands.mockResolvedValue([{ id: "brand_global", name: "CosmicPath Global" }]);
      mocks.findPost.mockResolvedValue(null);
      mocks.sendSystemAlert.mockClear();
      const { prisma } = await import("@/lib/prisma");
      vi.mocked(prisma.post.count).mockImplementation((async ({ where }: { where: Record<string, unknown> }) => {
        if (where.status === "NEEDS_REVIEW") return counts.needsReview ?? 0;
        if (where.status === "PENDING" && where.scheduledAt) return counts.scheduledLater ?? 0;
        return 0;
      }) as never);
      try {
        const { GET } = await import("@/app/api/cron/publish/route");
        const response = await GET({ headers: new Headers(), nextUrl: new URL("http://localhost/api/cron/publish") } as never);
        return (await response.json()).skipped;
      } finally {
        vi.mocked(prisma.post.count).mockReset().mockResolvedValue(0);
      }
    };

    it("names drafts stuck in review and alerts, since refill counts them as a full backlog", async () => {
      const skipped = await runWithQueue({ needsReview: 5 });

      expect(skipped).toEqual([{ brandId: "brand_global", brandName: "CosmicPath Global", reason: "awaiting_review" }]);
      expect(mocks.sendSystemAlert).toHaveBeenCalledWith(expect.objectContaining({
        title: "Publish queue waiting on review",
        brandName: "CosmicPath Global",
        message: expect.stringContaining("5 draft(s)"),
      }));
    });

    it("names future-scheduled drafts without alerting", async () => {
      const skipped = await runWithQueue({ scheduledLater: 2 });

      expect(skipped).toEqual([{ brandId: "brand_global", brandName: "CosmicPath Global", reason: "scheduled_later" }]);
      expect(mocks.sendSystemAlert).not.toHaveBeenCalled();
    });

    it("keeps no_pending for a truly empty queue", async () => {
      expect(await runWithQueue({})).toEqual([{ brandId: "brand_global", brandName: "CosmicPath Global", reason: "no_pending" }]);
      expect(mocks.sendSystemAlert).not.toHaveBeenCalled();
    });
  });

  describe("?slots= publish windows", () => {
    const callWithSlots = async (slots: string) => {
      const { GET } = await import("@/app/api/cron/publish/route");
      return GET({
        headers: new Headers(),
        nextUrl: new URL(`http://localhost/api/cron/publish?slots=${slots}`),
      } as never);
    };

    it("skips a late run when its slot already published", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-10-12T13:40:00Z"));
      mocks.findBrands.mockResolvedValue([{ id: "brand_slot", name: "CosmicPath" }]);
      mocks.findPost
        .mockResolvedValueOnce(null) // no PARTIAL_FAILED resume
        .mockResolvedValueOnce({ status: "PUBLISHED", publishedAt: new Date("2026-10-12T12:20:00Z") });

      const body = await (await callWithSlots("0,12")).json();

      expect(body.skipped).toEqual([{ brandId: "brand_slot", brandName: "CosmicPath", reason: "slot_already_served" }]);
      vi.useRealTimers();
    });

    // Regression 2026-10-23: a PUBLISHED row with publishedAt null sorted first on DESC and reopened every slot.
    it("looks up the last published post only among rows that have a publish date", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-10-12T13:40:00Z"));
      mocks.findBrands.mockResolvedValue([{ id: "brand_slot", name: "CosmicPath" }]);
      mocks.findPost.mockReset();
      mocks.findPost
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ status: "PUBLISHED", publishedAt: new Date("2026-10-12T12:20:00Z") });

      await callWithSlots("0,12");

      expect(mocks.findPost).toHaveBeenNthCalledWith(2, expect.objectContaining({
        where: expect.objectContaining({ status: "PUBLISHED", publishedAt: { not: null } }),
        orderBy: { publishedAt: "desc" },
      }));
      vi.useRealTimers();
    });

    it("skips runs that land outside every slot window", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-10-12T18:30:00Z"));
      mocks.findBrands.mockResolvedValue([{ id: "brand_slot", name: "CosmicPath" }]);
      mocks.findPost.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

      const body = await (await callWithSlots("0,12")).json();

      expect(body.skipped).toEqual([{ brandId: "brand_slot", brandName: "CosmicPath", reason: "outside_publish_slot" }]);
      vi.useRealTimers();
    });

    it("rejects malformed slots", async () => {
      mocks.findBrands.mockResolvedValue([{ id: "brand_slot", name: "CosmicPath" }]);
      const response = await callWithSlots("25");
      expect(response.status).toBe(400);
    });
  });
});

