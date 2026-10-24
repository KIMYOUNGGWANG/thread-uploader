import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    brand: { findUnique: vi.fn() },
    viralExample: { upsert: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
    viralExampleSnapshot: { findFirst: vi.fn(), create: vi.fn(), findMany: vi.fn() },
  },
}));

vi.mock("./youtube-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./youtube-api")>()),
  createYoutubeClient: vi.fn(),
}));
vi.mock("./shorts-harvester", () => ({ harvestShorts: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { harvestShorts, type ShortsCandidate } from "./shorts-harvester";
import { createYoutubeClient, type YoutubeVideo } from "./youtube-api";
import {
  SHORTS_SOURCE,
  cleanupShorts,
  discoverShorts,
  saveShortsCandidate,
  snapshotShorts,
} from "./shorts-service";

const HOUR = 60 * 60 * 1000;
const NOW = new Date("2026-10-22T10:30:00.000Z");

const candidate: ShortsCandidate = {
  videoId: "vid1",
  channelId: "ch1",
  channelTitle: "채널",
  title: "제목",
  description: "d".repeat(400),
  publishedAt: new Date(NOW.getTime() - 5 * HOUR),
  durationSec: 30,
  thumbnailUrl: "https://img/1.jpg",
  country: "KR",
  views: 1000,
  likes: 10,
  comments: 2,
  searchKeyword: "ai",
  searchRank: 3,
  keywordHits: 2,
};

type Fn = ReturnType<typeof vi.fn>;
const db = prisma as unknown as {
  brand: { findUnique: Fn };
  viralExample: Record<"upsert" | "findUnique" | "findMany" | "update" | "deleteMany", Fn>;
  viralExampleSnapshot: Record<"findFirst" | "create" | "findMany", Fn>;
};

function upsertArgs(): { where: unknown; create: Record<string, unknown>; update: Record<string, unknown> } {
  return db.viralExample.upsert.mock.calls[0][0];
}

beforeEach(async () => {
  vi.resetAllMocks();
  const actual = await vi.importActual<typeof import("./shorts-harvester")>("./shorts-harvester");
  vi.mocked(harvestShorts).mockImplementation(actual.harvestShorts);
  vi.mocked(createYoutubeClient).mockReturnValue({ listVideos: vi.fn().mockResolvedValue([]), quotaUsed: 0 } as never);
  vi.unstubAllEnvs();
  db.viralExample.upsert.mockResolvedValue({ id: "ex1", rawMetrics: "{}" });
  db.viralExample.findMany.mockResolvedValue([]);
  db.viralExample.deleteMany.mockResolvedValue({ count: 0 });
  db.viralExampleSnapshot.findFirst.mockResolvedValue(null);
  db.viralExampleSnapshot.findMany.mockResolvedValue([]);
});

describe("saveShortsCandidate", () => {
  const baseline = { baselineStatus: "measured", channelMedianViews: 250, baselineSampleSize: 12, baselineComputedAt: "2026-10-21T00:00:00.000Z" };

  it("carries the stored baseline through a re-save (regression: merge used to drop it)", async () => {
    db.viralExample.findUnique.mockResolvedValue({ rawMetrics: JSON.stringify({ firstSeenAt: "old", ...baseline }) });
    await saveShortsCandidate("b1", candidate, NOW);
    expect(JSON.parse(upsertArgs().update.rawMetrics as string)).toMatchObject(baseline);
  });

  it("rewrites outlierRatio and viralScore from the snapshot views", async () => {
    db.viralExample.findUnique.mockResolvedValue({ rawMetrics: JSON.stringify(baseline) });
    await saveShortsCandidate("b1", candidate, NOW);
    const call = db.viralExample.update.mock.calls[0][0];
    expect(call.data.viralScore).toBe(400);
    expect(JSON.parse(call.data.rawMetrics).outlierRatio).toBe(4);
  });

  it("writes viralScore 0 and outlierRatio null when there is no baseline", async () => {
    db.viralExample.findUnique.mockResolvedValue({ rawMetrics: "not json" });
    await saveShortsCandidate("b1", candidate, NOW);
    const call = db.viralExample.update.mock.calls[0][0];
    expect(call.data.viralScore).toBe(0);
    expect(JSON.parse(call.data.rawMetrics).outlierRatio).toBeNull();
  });

  it("creates the example with firstSeenAt and one snapshot on first save", async () => {
    await saveShortsCandidate("b1", candidate, NOW);
    const { where, create } = upsertArgs();
    expect(where).toEqual({ brandId_source_sourceKey: { brandId: "b1", source: SHORTS_SOURCE, sourceKey: "vid1" } });
    expect(create).toMatchObject({
      brandId: "b1",
      source: "youtube_shorts",
      sourceKey: "vid1",
      authorUsername: "채널",
      permalink: "https://www.youtube.com/shorts/vid1",
      content: `제목\n${"d".repeat(300)}`,
      country: "KR",
      viralScore: 0,
      velocityScore: 0,
      discoveredAt: NOW,
      views: 1000,
      replies: 2,
    });
    expect(JSON.parse(create.rawMetrics as string)).toMatchObject({
      channelId: "ch1",
      firstSeenAt: NOW.toISOString(),
      searchKeyword: "ai",
      searchRank: 3,
      keywordHits: 2,
    });
    expect(db.viralExampleSnapshot.create).toHaveBeenCalledWith({
      data: { exampleId: "ex1", capturedAt: NOW, views: 1000, likes: 10, comments: 2 },
    });
  });

  it("never splits an emoji when truncating the description to 300 characters", async () => {
    const description = `${"d".repeat(299)}🔮${"x".repeat(10)}`;
    await saveShortsCandidate("b1", { ...candidate, description }, NOW);
    const content = upsertArgs().create.content as string;
    expect(content).toBe(`제목\n${"d".repeat(299)}🔮`);
    expect(content.isWellFormed()).toBe(true);
  });

  it("keeps firstSeenAt and discoveredAt on the second save", async () => {
    db.viralExample.findUnique.mockResolvedValue({ rawMetrics: JSON.stringify({ firstSeenAt: "old", timesSeen: 1 }) });
    await saveShortsCandidate("b1", candidate, NOW);
    const { update } = upsertArgs();
    expect(update).not.toHaveProperty("discoveredAt");
    expect(JSON.parse(update.rawMetrics as string)).toMatchObject({ firstSeenAt: "old", timesSeen: 2 });
    expect(Object.keys(update).sort()).toEqual(["content", "country", "likes", "rawMetrics", "replies", "views"]);
  });

  it("skips snapshot already captured this hour", async () => {
    db.viralExampleSnapshot.findFirst.mockResolvedValue({ id: "s1" });
    await expect(saveShortsCandidate("b1", candidate, NOW)).resolves.toBeUndefined();
    expect(db.viralExampleSnapshot.findFirst).toHaveBeenCalledWith({
      where: { exampleId: "ex1", capturedAt: { gte: new Date("2026-10-22T10:00:00.000Z") } },
    });
    expect(db.viralExampleSnapshot.create).not.toHaveBeenCalled();
  });

  it("writes velocityScore and rawMetrics.velocityWindowHours after snapshot", async () => {
    db.viralExample.findUnique.mockResolvedValue({ rawMetrics: JSON.stringify({ firstSeenAt: "x", llmAnalyzedAt: "y" }) });
    db.viralExampleSnapshot.findMany.mockResolvedValue([
      { capturedAt: new Date(NOW.getTime() - 2 * HOUR), views: 400 },
      { capturedAt: NOW, views: 1000 },
    ]);
    await saveShortsCandidate("b1", candidate, NOW);
    expect(db.viralExampleSnapshot.findMany).toHaveBeenCalledWith({
      where: { exampleId: "ex1", capturedAt: { gte: new Date(NOW.getTime() - 6 * HOUR) } },
      orderBy: { capturedAt: "asc" },
    });
    const call = db.viralExample.update.mock.calls[0][0];
    expect(call.where).toEqual({ id: "ex1" });
    expect(call.data.velocityScore).toBe(300);
    expect(JSON.parse(call.data.rawMetrics)).toMatchObject({
      velocityWindowHours: 2,
      firstSeenAt: "x",
      llmAnalyzedAt: "y",
    });
  });
});

describe("discoverShorts", () => {
  it("returns the auth error without touching prisma when YOUTUBE_API_KEY is unset", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "");
    db.brand.findUnique.mockResolvedValue({ id: "b1", brandConfig: "{}" });
    const result = await discoverShorts("b1", NOW);
    expect(result).toMatchObject({ discovered: 0, saved: 0, quotaUsed: 0 });
    expect(result.errors[0]).toMatchObject({ adapter: "youtube_shorts", source: "auth" });
    expect(db.viralExample.upsert).not.toHaveBeenCalled();
    expect(db.viralExampleSnapshot.create).not.toHaveBeenCalled();
  });
});

function row(id: string, sourceKey: string) {
  return { id, sourceKey, publishedAt: new Date(NOW.getTime() - HOUR) };
}

function video(id: string): YoutubeVideo {
  return { id, views: 10, likes: 1, comments: 0 } as YoutubeVideo;
}

function stubClient(listVideos: Fn) {
  vi.stubEnv("YOUTUBE_API_KEY", "key");
  vi.mocked(createYoutubeClient).mockReturnValue({ listVideos, quotaUsed: 5 } as never);
}

describe("snapshotShorts error isolation and grouping", () => {
  it("records a chunk error and still snapshots the next chunk", async () => {
    db.viralExample.findMany.mockResolvedValue(Array.from({ length: 51 }, (_, i) => row(`e${i}`, `v${i}`)));
    db.viralExample.findUnique.mockResolvedValue({ rawMetrics: "{}" });
    const listVideos = vi.fn().mockRejectedValueOnce(new Error("503")).mockResolvedValueOnce([video("v50")]);
    stubClient(listVideos);
    const result = await snapshotShorts(NOW);
    expect(result.errors).toEqual([{ adapter: "youtube_shorts", source: "snapshot", message: "503" }]);
    expect(result.snapshots).toBe(1);
    expect(db.viralExampleSnapshot.create).toHaveBeenCalledTimes(1);
    expect(db.viralExampleSnapshot.create.mock.calls[0][0].data.exampleId).toBe("e50");
  });

  it("records a row error and continues with the next row", async () => {
    db.viralExample.findMany.mockResolvedValue([row("e1", "v1"), row("e2", "v2")]);
    db.viralExample.findUnique.mockResolvedValue({ rawMetrics: "{}" });
    db.viralExampleSnapshot.create.mockRejectedValueOnce(new Error("db down"));
    stubClient(vi.fn().mockResolvedValue([video("v1"), video("v2")]));
    const result = await snapshotShorts(NOW);
    expect(result.snapshots).toBe(1);
    expect(result.errors).toEqual([{ adapter: "youtube_shorts", source: "snapshot", message: "db down" }]);
  });

  it("snapshots every row sharing a sourceKey and requests the id once", async () => {
    db.viralExample.findMany.mockResolvedValue([row("e1", "same"), row("e2", "same")]);
    db.viralExample.findUnique.mockResolvedValue({ rawMetrics: "{}" });
    const listVideos = vi.fn().mockResolvedValue([video("same")]);
    stubClient(listVideos);
    const result = await snapshotShorts(NOW);
    expect(listVideos).toHaveBeenCalledWith(["same"]);
    const ids = db.viralExampleSnapshot.create.mock.calls.map((c) => c[0].data.exampleId);
    expect(ids).toEqual(["e1", "e2"]);
    expect(result.snapshots).toBe(2);
  });

  it("chunks 51 rows into two listVideos calls (50 + 1)", async () => {
    db.viralExample.findMany.mockResolvedValue(Array.from({ length: 51 }, (_, i) => row(`e${i}`, `v${i}`)));
    const listVideos = vi.fn().mockResolvedValue([]);
    stubClient(listVideos);
    await snapshotShorts(NOW);
    expect(listVideos).toHaveBeenCalledTimes(2);
    expect(listVideos.mock.calls[0][0]).toHaveLength(50);
    expect(listVideos.mock.calls[1][0]).toHaveLength(1);
  });

  it("silently skips videos missing from the response", async () => {
    db.viralExample.findMany.mockResolvedValue([row("e1", "gone")]);
    stubClient(vi.fn().mockResolvedValue([]));
    const result = await snapshotShorts(NOW);
    expect(result).toMatchObject({ snapshots: 0, errors: [] });
  });
});

describe("discoverShorts save isolation", () => {
  it("keeps saving after one candidate fails and reports it", async () => {
    db.brand.findUnique.mockResolvedValue({ id: "b1", brandConfig: "{}" });
    vi.mocked(harvestShorts).mockResolvedValue({
      candidates: [candidate, { ...candidate, videoId: "vid2" }],
      errors: [],
      quotaUsed: 100,
    });
    db.viralExample.upsert.mockRejectedValueOnce(new Error("save failed"));
    db.viralExample.upsert.mockResolvedValue({ id: "ex2", rawMetrics: "{}" });
    const result = await discoverShorts("b1", NOW);
    expect(result).toMatchObject({ discovered: 2, saved: 1, quotaUsed: 100 });
    expect(result.errors).toEqual([{ adapter: "youtube_shorts", source: "save:vid1", message: "save failed" }]);
  });
});

describe("snapshotShorts", () => {
  it("refreshes the ratio on hourly snapshots without extra API calls", async () => {
    db.viralExample.findMany.mockResolvedValue([row("e1", "v1")]);
    db.viralExample.findUnique.mockResolvedValue({ rawMetrics: JSON.stringify({ baselineStatus: "measured", channelMedianViews: 5, baselineSampleSize: 6, baselineComputedAt: "x" }) });
    const listVideos = vi.fn().mockResolvedValue([video("v1")]);
    stubClient(listVideos);
    await snapshotShorts(NOW);
    expect(listVideos).toHaveBeenCalledTimes(1);
    expect(db.viralExample.update.mock.calls[0][0].data.viralScore).toBe(200);
  });

  it("only reads youtube_shorts examples published within 72h", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "key");
    await snapshotShorts(NOW);
    expect(db.viralExample.findMany).toHaveBeenCalledWith({
      where: { source: "youtube_shorts", publishedAt: { gte: new Date(NOW.getTime() - 72 * HOUR) } },
      select: { id: true, sourceKey: true, publishedAt: true },
    });
  });

  it("returns the auth error when YOUTUBE_API_KEY is unset", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "");
    const result = await snapshotShorts(NOW);
    expect(result).toMatchObject({ snapshots: 0, quotaUsed: 0 });
    expect(result.errors[0].source).toBe("auth");
    expect(db.viralExample.findMany).not.toHaveBeenCalled();
  });
});

describe("cleanupShorts", () => {
  it("deletes youtube_shorts examples older than 7 days only", async () => {
    db.viralExample.deleteMany.mockResolvedValue({ count: 4 });
    const result = await cleanupShorts(NOW);
    expect(db.viralExample.deleteMany).toHaveBeenCalledWith({
      where: { source: "youtube_shorts", publishedAt: { lt: new Date(NOW.getTime() - 7 * 24 * HOUR) } },
    });
    expect(result).toEqual({ deleted: 4 });
  });
});
