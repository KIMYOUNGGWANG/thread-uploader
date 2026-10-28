import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  viralExample: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  post: { findMany: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { loadReferenceReplaySource, markReferenceAttempted, pickReferenceReplaySource, type ReferenceCandidate } from "@/lib/reference-replay";

const now = new Date("2026-10-27T00:00:00.000Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

function ex(id: string, score: number, eligible: boolean, publishedDaysAgo = 2, sourceKey = `key-${id}`, timesSeen = 2): ReferenceCandidate {
  return {
    id,
    sourceKey,
    content: `post ${id}`,
    authorUsername: "other",
    publishedAt: new Date(daysAgo(publishedDaysAgo)),
    rawMetrics: JSON.stringify({ referenceScore: score, eligibleSource: eligible, timesSeen }),
  };
}

function attemptedAt(id: string, score: number, at: string): ReferenceCandidate {
  return { ...ex(id, score, true), rawMetrics: JSON.stringify({ referenceScore: score, eligibleSource: true, timesSeen: 2, replayAttemptedAt: at }) };
}

function exWithHistory(id: string, score: number, sourceKey: string, rankHistory: Array<{ at: string; rank: number; hits: number }>): ReferenceCandidate {
  return { ...ex(id, score, true, 2, sourceKey), rawMetrics: JSON.stringify({ referenceScore: score, eligibleSource: true, timesSeen: 2, rankHistory }) };
}
const h = (rank: number, hour: number) => ({ at: new Date(now.getTime() - hour * 60 * 60 * 1000).toISOString(), rank, hits: 1 });

describe("pickReferenceReplaySource", () => {
  it("picks the highest referenceScore among eligible posts", () => {
    expect(pickReferenceReplaySource([ex("a", 50, true), ex("b", 80, true), ex("c", 99, false)], [], now)?.id).toBe("b");
  });

  it("skips sources already used and sources attempted in the last 7 days", () => {
    const attempted = attemptedAt("a", 90, daysAgo(2));
    expect(pickReferenceReplaySource([attempted, ex("b", 50, true)], ["ref_replay_source:b"], now)).toBeNull();
  });

  it("lets a source attempted 8 days ago back in", () => {
    expect(pickReferenceReplaySource([attemptedAt("a", 90, daysAgo(8)), ex("b", 50, true)], [], now)?.id).toBe("a");
  });

  it("breaks ties by the newer publishedAt", () => {
    expect(pickReferenceReplaySource([ex("old", 70, true, 5), ex("new", 70, true, 1)], [], now)?.id).toBe("new");
  });

  it("excludes every row of a post once any row of it was used, since the same post is stored once per keyword", () => {
    const used = ex("a1", 90, true, 2, "post-x");
    const sibling = ex("a2", 95, true, 2, "post-x");
    expect(pickReferenceReplaySource([used, sibling], ["ref_replay_source:a1"], now)).toBeNull();
    expect(pickReferenceReplaySource([used, sibling, ex("b", 10, true)], ["ref_replay_source:a1"], now)?.id).toBe("b");
  });

  it("excludes a post whose used row is outside the window, via the extra sourceKeys", () => {
    expect(pickReferenceReplaySource([ex("a2", 95, true, 2, "post-x")], [], now, ["post-x"])).toBeNull();
  });

  it("excludes every row of a post when one row was attempted within the cooldown", () => {
    const attempted = { ...attemptedAt("a1", 90, daysAgo(2)), sourceKey: "post-x" };
    expect(pickReferenceReplaySource([attempted, ex("a2", 95, true, 2, "post-x")], [], now)).toBeNull();
  });

  it("merges rows of one post by max, not sum: two rows each seen once stay at one sighting", () => {
    expect(pickReferenceReplaySource([ex("a1", 90, true, 2, "post-x", 1), ex("a2", 80, true, 2, "post-x", 1)], [], now)).toBeNull();
    // Max reaches the bar through one row, and that row's higher score represents the post.
    expect(pickReferenceReplaySource([ex("a1", 90, true, 2, "post-x", 1), ex("a2", 80, true, 2, "post-x", 2)], [], now)?.id).toBe("a1");
  });

  it("returns a post once even when several rows qualify", () => {
    expect(pickReferenceReplaySource([ex("a1", 60, true, 2, "post-x"), ex("a2", 70, true, 2, "post-x"), ex("b", 65, true)], [], now)?.id).toBe("a2");
  });

  it("returns null when nothing is eligible or rawMetrics is malformed", () => {
    const broken: ReferenceCandidate = { ...ex("x", 1, true), rawMetrics: "{not json" };
    expect(pickReferenceReplaySource([ex("a", 99, false), broken], [], now)).toBeNull();
  });

  it("prefers a rising post over a higher referenceScore that is flat", () => {
    // a: 50, rank 8 -> 2 (gain 6 x 3 = 18) -> 68. b: 60, flat -> 60. Same age, so freshness cancels out.
    const a = exWithHistory("a", 50, "post-a", [h(8, 8), h(2, 0)]);
    const b = exWithHistory("b", 60, "post-b", [h(3, 8), h(3, 0)]);
    expect(pickReferenceReplaySource([a, b], [], now)?.id).toBe("a");
  });

  it("merges rankHistory across rows of the same post, so a row without history does not zero the gain", () => {
    const withHistory = exWithHistory("x1", 50, "post-x", [h(9, 8), h(1, 0)]);
    const noHistory = { ...ex("x2", 55, true, 2, "post-x"), rawMetrics: JSON.stringify({ referenceScore: 55, eligibleSource: true, timesSeen: 2 }) };
    const flat = exWithHistory("y", 70, "post-y", [h(2, 8), h(2, 0)]);
    // x group: max ref 55 + gain 8 x 3 = 79 > y 70
    expect(pickReferenceReplaySource([withHistory, noHistory, flat], [], now)?.id).toBe("x2");
  });
});

describe("loadReferenceReplaySource", () => {
  beforeEach(() => vi.clearAllMocks());

  it("excludes shorts from the 7-day window and honors source tags of recent ref_replay posts", async () => {
    prismaMock.viralExample.findMany.mockResolvedValueOnce([ex("a", 90, true), ex("b", 50, true)]).mockResolvedValueOnce([{ sourceKey: "key-a" }]);
    prismaMock.post.findMany.mockResolvedValue([{ qualityReasons: JSON.stringify(["ref_replay_source:a"]) }]);

    expect((await loadReferenceReplaySource("brand", now))?.id).toBe("b");
    const where = prismaMock.viralExample.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ brandId: "brand", source: { not: "youtube_shorts" } });
    expect(where.publishedAt.gte).toEqual(new Date(daysAgo(7)));
    expect(prismaMock.post.findMany.mock.calls[0][0].where).toMatchObject({ brandId: "brand", formulaId: "ref_replay" });
  });

  it("also blocks another keyword's row of a used post, even when the used row fell out of the 7-day window", async () => {
    // Tagged row "old" is no longer in the window; its sourceKey is looked up by id.
    prismaMock.viralExample.findMany
      .mockResolvedValueOnce([ex("sibling", 90, true, 2, "post-x"), ex("b", 50, true)])
      .mockResolvedValueOnce([{ sourceKey: "post-x" }]);
    prismaMock.post.findMany.mockResolvedValue([{ qualityReasons: JSON.stringify(["ref_replay_source:old"]) }]);

    expect((await loadReferenceReplaySource("brand", now))?.id).toBe("b");
    expect(prismaMock.viralExample.findMany.mock.calls[1][0]).toEqual({ where: { id: { in: ["old"] } }, select: { sourceKey: true } });
  });

  it("skips the tagged-row lookup when nothing was used recently", async () => {
    prismaMock.viralExample.findMany.mockResolvedValueOnce([ex("a", 90, true)]);
    prismaMock.post.findMany.mockResolvedValue([]);
    expect((await loadReferenceReplaySource("brand", now))?.id).toBe("a");
    expect(prismaMock.viralExample.findMany).toHaveBeenCalledTimes(1);
  });
});

describe("markReferenceAttempted", () => {
  beforeEach(() => vi.clearAllMocks());

  it("adds replayAttemptedAt and keeps the other rawMetrics keys", async () => {
    prismaMock.viralExample.findUnique.mockResolvedValue({ rawMetrics: JSON.stringify({ referenceScore: 7, timesSeen: 3 }) });
    await markReferenceAttempted("x", now);
    expect(prismaMock.viralExample.update).toHaveBeenCalledWith({
      where: { id: "x" },
      data: { rawMetrics: JSON.stringify({ referenceScore: 7, timesSeen: 3, replayAttemptedAt: now.toISOString() }) },
    });
  });

  it("starts from an empty object when rawMetrics is malformed", async () => {
    prismaMock.viralExample.findUnique.mockResolvedValue({ rawMetrics: "{oops" });
    await markReferenceAttempted("x", now);
    expect(prismaMock.viralExample.update.mock.calls[0][0].data.rawMetrics).toBe(JSON.stringify({ replayAttemptedAt: now.toISOString() }));
  });
});
