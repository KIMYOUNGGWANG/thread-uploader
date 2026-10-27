import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  viralExample: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  post: { findMany: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { loadReferenceReplaySource, markReferenceAttempted, pickReferenceReplaySource, type ReferenceCandidate } from "@/lib/reference-replay";

const now = new Date("2026-10-27T00:00:00.000Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

function ex(id: string, score: number, eligible: boolean, publishedDaysAgo = 2): ReferenceCandidate {
  return {
    id,
    content: `post ${id}`,
    authorUsername: "other",
    publishedAt: new Date(daysAgo(publishedDaysAgo)),
    rawMetrics: JSON.stringify({ referenceScore: score, eligibleSource: eligible }),
  };
}

function attemptedAt(id: string, score: number, at: string): ReferenceCandidate {
  return { ...ex(id, score, true), rawMetrics: JSON.stringify({ referenceScore: score, eligibleSource: true, replayAttemptedAt: at }) };
}

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

  it("returns null when nothing is eligible or rawMetrics is malformed", () => {
    const broken: ReferenceCandidate = { ...ex("x", 1, true), rawMetrics: "{not json" };
    expect(pickReferenceReplaySource([ex("a", 99, false), broken], [], now)).toBeNull();
  });
});

describe("loadReferenceReplaySource", () => {
  beforeEach(() => vi.clearAllMocks());

  it("excludes shorts from the 7-day window and honors source tags of recent ref_replay posts", async () => {
    prismaMock.viralExample.findMany.mockResolvedValue([ex("a", 90, true), ex("b", 50, true)]);
    prismaMock.post.findMany.mockResolvedValue([{ qualityReasons: JSON.stringify(["ref_replay_source:a"]) }]);

    expect((await loadReferenceReplaySource("brand", now))?.id).toBe("b");
    const where = prismaMock.viralExample.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ brandId: "brand", source: { not: "youtube_shorts" } });
    expect(where.publishedAt.gte).toEqual(new Date(daysAgo(7)));
    expect(prismaMock.post.findMany.mock.calls[0][0].where).toMatchObject({ brandId: "brand", formulaId: "ref_replay" });
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
