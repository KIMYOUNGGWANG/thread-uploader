import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  post: { findMany: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { loadWinnerReplaySource, pickWinnerReplaySource, WINNER_REPLAY_SOURCE_PREFIX } from "@/lib/winner-replay";

const posts = [
  { id: "a", content: "A", views: 9482 },
  { id: "b", content: "B", views: 140 },
  { id: "c", content: "C", views: 120 },
  { id: "d", content: "D", views: 900 },
];

describe("pickWinnerReplaySource", () => {
  it("picks the top post at 5x the median or more", () => {
    expect(pickWinnerReplaySource(posts, [])?.id).toBe("a");
  });

  it("skips a source used in the last 14 days", () => {
    expect(pickWinnerReplaySource(posts, [`${WINNER_REPLAY_SOURCE_PREFIX}a`])?.id).toBe("d");
  });

  it("returns null when nothing qualifies", () => {
    expect(pickWinnerReplaySource([{ id: "x", content: "X", views: 0 }], [])).toBeNull();
    expect(pickWinnerReplaySource([], [])).toBeNull();
  });
});

describe("loadWinnerReplaySource", () => {
  beforeEach(() => vi.clearAllMocks());

  it("excludes sources named in recent winner_replay drafts' qualityReasons", async () => {
    prismaMock.post.findMany
      .mockResolvedValueOnce(posts)
      .mockResolvedValueOnce([{ qualityReasons: JSON.stringify([`${WINNER_REPLAY_SOURCE_PREFIX}a`]) }, { qualityReasons: "not json" }]);

    const now = new Date("2026-10-24T00:00:00Z");
    const source = await loadWinnerReplaySource("b1", now);

    expect(source?.id).toBe("d");
    expect(prismaMock.post.findMany.mock.calls[0]?.[0].where).toMatchObject({
      brandId: "b1",
      status: "PUBLISHED",
      views: { not: null },
      publishedAt: { gte: new Date("2026-08-25T00:00:00Z") },
      // No replay-of-replay or New Year posts; null formulaId must stay in (a bare `not` would drop NULL rows in SQL).
      OR: [{ formulaId: null }, { formulaId: { notIn: ["winner_replay", "ref_replay", "ny_ranking", "ny_ipchun", "ny_monthly", "ny_pick", "ny_zodiac"] } }],
    });
    expect(prismaMock.post.findMany.mock.calls[1]?.[0].where).toMatchObject({
      brandId: "b1",
      formulaId: "winner_replay",
      createdAt: { gte: new Date("2026-10-10T00:00:00Z") },
    });
  });
});
