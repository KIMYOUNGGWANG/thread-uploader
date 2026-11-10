import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  draftFindMany: vi.fn(),
  postFindMany: vi.fn(),
  uploadCount: vi.fn(),
  createMany: vi.fn(async ({ data }: { data: Array<Record<string, unknown>>; skipDuplicates?: boolean }) => ({ count: data.length })),
  accounts: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    videoDraft: { findMany: db.draftFindMany },
    post: { findMany: db.postFindMany },
    channelUpload: { count: db.uploadCount, createMany: db.createMany },
  },
}));
vi.mock("./accounts", () => ({ getUploadAccounts: db.accounts }));

import { cardSlideUrls, kstDayStart, scheduleCardNews, scheduleVideoUploads, scheduleXPosts } from "./scheduler";

const now = new Date("2026-11-09T03:00:00Z");
const brand = (config: object = {}) => ({
  id: "b1", slug: "cosmicpath", brandConfig: JSON.stringify(config), instagramAccessToken: "x", instagramTokenExpiry: new Date("2027-01-01"),
});
const account = (id: string) => ({ id, enabled: true });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("APP_URL", "https://app.example");
});

describe("kstDayStart", () => {
  it("is midnight KST", () => {
    expect(kstDayStart(new Date("2026-11-09T16:00:00Z")).toISOString()).toBe("2026-11-09T15:00:00.000Z");
  });
});

describe("scheduleVideoUploads", () => {
  it("queues one upload per connected video channel, TikTok private", async () => {
    db.draftFindMany.mockResolvedValueOnce([{
      id: "d1", brandId: "b1", videoUrl: "https://blob/v.mp4",
      captions: JSON.stringify({ youtube: "유튜브", instagram: "인스타", tiktok: "틱톡" }), hashtags: '["사주"]',
      brand: brand({ instagram: { captionSuffix: "링크는 프로필" } }),
    }]);
    db.accounts.mockResolvedValueOnce(new Map([["youtube", account("ay")], ["tiktok", account("at")], ["instagram", account("ai")], ["x", account("ax")]]));
    expect(await scheduleVideoUploads(now)).toBe(3);
    const rows = db.createMany.mock.calls[0][0].data as Array<Record<string, unknown>>;
    expect(rows.map((r) => [r.channelAccountId, r.privacy])).toEqual([["ay", "public"], ["ai", "public"], ["at", "private"]]);
    expect(rows[1].caption).toBe("인스타\n\n#사주\n\n링크는 프로필");
    expect(rows.every((r) => r.sourceKey === "video:d1")).toBe(true);
    expect(db.createMany.mock.calls[0][0].skipDuplicates).toBe(true);
  });

  it("respects the brand's video channel choice", async () => {
    db.draftFindMany.mockResolvedValueOnce([{ id: "d1", brandId: "b1", videoUrl: "v", captions: "{}", hashtags: "[]", brand: brand({ distribution: { video: { channels: ["youtube"] } } }) }]);
    db.accounts.mockResolvedValueOnce(new Map([["youtube", account("ay")], ["tiktok", account("at")]]));
    expect(await scheduleVideoUploads(now)).toBe(1);
  });
});

describe("scheduleCardNews", () => {
  const listPost = { id: "p1", content: "제목\n설명\nA. 하나\nB. 둘\nC. 셋" };

  it("queues the best post as a carousel after the cancel window", async () => {
    db.accounts.mockResolvedValueOnce(new Map([["instagram", account("ai")]]));
    db.uploadCount.mockResolvedValueOnce(0);
    db.postFindMany.mockResolvedValueOnce([{ id: "p0", content: "목록 없는 한 줄" }, listPost]);
    expect(await scheduleCardNews(now, [brand()])).toBe(1);
    const row = db.createMany.mock.calls[0][0].data[0];
    expect(row).toMatchObject({ kind: "carousel", sourceKey: "cards:p1", postId: "p1", scheduledAt: new Date(now.getTime() + 3 * 3600_000) });
    expect(JSON.parse(row.mediaUrls as string)[0]).toBe("https://app.example/api/cards/p1?slide=0&format=jpg");
  });

  it("stops at the daily cap and without Instagram", async () => {
    db.accounts.mockResolvedValueOnce(new Map([["instagram", account("ai")]]));
    db.uploadCount.mockResolvedValueOnce(1);
    expect(await scheduleCardNews(now, [brand()])).toBe(0);
    db.accounts.mockResolvedValueOnce(new Map());
    expect(await scheduleCardNews(now, [brand()])).toBe(0);
    expect(db.postFindMany).not.toHaveBeenCalled();
  });

  it("builds one slide URL per card, capped at 10", () => {
    expect(cardSlideUrls("p1", listPost.content, "https://a")).toHaveLength(4);
  });
});

describe("scheduleXPosts", () => {
  it("cross-posts recent Threads posts up to the daily cap", async () => {
    db.accounts.mockResolvedValueOnce(new Map([["x", account("ax")]]));
    db.uploadCount.mockResolvedValueOnce(1);
    db.postFindMany.mockResolvedValueOnce([{ id: "p1", content: "첫 글" }, { id: "p2", content: "둘째 글" }]);
    expect(await scheduleXPosts(now, [brand()])).toBe(2);
    expect(db.postFindMany.mock.calls[0][0].take).toBe(2);
    expect(db.createMany.mock.calls[0][0].data[0]).toMatchObject({ kind: "text", caption: "첫 글", sourceKey: "post:p1", channelAccountId: "ax" });
  });

  it("does nothing when X is turned off", async () => {
    expect(await scheduleXPosts(now, [brand({ distribution: { x: { enabled: false } } })])).toBe(0);
    expect(db.accounts).not.toHaveBeenCalled();
  });
});
