import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    brand: { findUnique: vi.fn() },
    viralExample: { upsert: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
    viralExampleSnapshot: { findFirst: vi.fn(), create: vi.fn(), findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import type { ShortsCandidate } from "./shorts-harvester";
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

beforeEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
  db.viralExample.upsert.mockResolvedValue({ id: "ex1", rawMetrics: "{}" });
  db.viralExample.findMany.mockResolvedValue([]);
  db.viralExample.deleteMany.mockResolvedValue({ count: 0 });
  db.viralExampleSnapshot.findFirst.mockResolvedValue(null);
  db.viralExampleSnapshot.findMany.mockResolvedValue([]);
});

describe("saveShortsCandidate", () => {
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

describe("snapshotShorts", () => {
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
