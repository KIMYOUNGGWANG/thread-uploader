import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseBrandConfig } from "@/types/brand";
import type { ViralSourceError } from "@/types/viral";
import { mergeStoredRawMetrics } from "@/lib/viral-analysis";
import { harvestShorts, type ShortsCandidate } from "./shorts-harvester";
import { calculateShortsVelocity } from "./shorts-velocity";
import { createYoutubeClient, YoutubeQuotaError, type YoutubeClient, type YoutubeVideo } from "./youtube-api";

export const SHORTS_SOURCE = "youtube_shorts";

const HOUR_MS = 60 * 60 * 1000;
const VELOCITY_WINDOW_MS = 6 * HOUR_MS;
const SNAPSHOT_WINDOW_MS = 72 * HOUR_MS;
const CLEANUP_AGE_MS = 7 * 24 * HOUR_MS;
const ID_CHUNK = 50;
const AUTH_ERROR: ViralSourceError = { adapter: SHORTS_SOURCE, source: "auth", message: "YOUTUBE_API_KEY is not set" };

type Stats = { views: number; likes: number | null; comments: number | null };

function getClient(): YoutubeClient | null {
  const key = process.env.YOUTUBE_API_KEY;
  return key ? createYoutubeClient(key) : null;
}

function parseRecord(raw: string | null | undefined): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw || "{}");
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

async function hasSnapshotThisHour(exampleId: string, now: Date): Promise<boolean> {
  const hourStart = new Date(Math.floor(now.getTime() / HOUR_MS) * HOUR_MS);
  const existing = await prisma.viralExampleSnapshot.findFirst({
    where: { exampleId, capturedAt: { gte: hourStart } },
  });
  return Boolean(existing);
}

async function refreshVelocity(exampleId: string, publishedAt: Date, now: Date): Promise<void> {
  const snapshots = await prisma.viralExampleSnapshot.findMany({
    where: { exampleId, capturedAt: { gte: new Date(now.getTime() - VELOCITY_WINDOW_MS) } },
    orderBy: { capturedAt: "asc" },
  });
  const { velocity, windowHours } = calculateShortsVelocity({ snapshots, publishedAt, now });
  const row = await prisma.viralExample.findUnique({ where: { id: exampleId }, select: { rawMetrics: true } });
  const rawMetrics = JSON.stringify({ ...parseRecord(row?.rawMetrics), velocityWindowHours: windowHours });
  await prisma.viralExample.update({ where: { id: exampleId }, data: { velocityScore: velocity, rawMetrics } });
}

export async function recordSnapshot(exampleId: string, stats: Stats, publishedAt: Date, now: Date): Promise<void> {
  if (!(await hasSnapshotThisHour(exampleId, now))) {
    const { views, likes, comments } = stats;
    await prisma.viralExampleSnapshot.create({ data: { exampleId, capturedAt: now, views, likes, comments } });
  }
  await refreshVelocity(exampleId, publishedAt, now);
}

async function buildRawMetrics(where: Prisma.ViralExampleWhereUniqueInput, c: ShortsCandidate, now: Date): Promise<string> {
  const existing = await prisma.viralExample.findUnique({ where, select: { rawMetrics: true } });
  const firstSeenAt = parseRecord(existing?.rawMetrics).firstSeenAt ?? now.toISOString();
  const incoming = {
    channelId: c.channelId,
    durationSec: c.durationSec,
    thumbnailUrl: c.thumbnailUrl,
    firstSeenAt,
    searchKeyword: c.searchKeyword,
    searchRank: c.searchRank,
    keywordHits: c.keywordHits,
  };
  return JSON.stringify(mergeStoredRawMetrics(existing?.rawMetrics ?? null, incoming).merged);
}

function createData(brandId: string, c: ShortsCandidate, now: Date) {
  return {
    brandId,
    source: SHORTS_SOURCE,
    sourceKey: c.videoId,
    authorUsername: c.channelTitle,
    permalink: `https://www.youtube.com/shorts/${c.videoId}`,
    publishedAt: c.publishedAt,
    viralScore: 0,
    velocityScore: 0,
    discoveredAt: now,
  };
}

export async function saveShortsCandidate(brandId: string, c: ShortsCandidate, now: Date): Promise<void> {
  const where = { brandId_source_sourceKey: { brandId, source: SHORTS_SOURCE, sourceKey: c.videoId } };
  const rawMetrics = await buildRawMetrics(where, c, now);
  // Slice by code point: a UTF-16 slice can split an emoji, and a lone surrogate makes the upsert fail.
  const content = `${c.title}\n${Array.from(c.description).slice(0, 300).join("")}`;
  const shared = { views: c.views, likes: c.likes, replies: c.comments, content, country: c.country, rawMetrics };
  const example = await prisma.viralExample.upsert({
    where,
    create: { ...shared, ...createData(brandId, c, now) },
    update: shared,
  });
  await recordSnapshot(example.id, { views: c.views, likes: c.likes, comments: c.comments }, c.publishedAt, now);
}

export async function discoverShorts(brandId: string, now: Date = new Date()) {
  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!brand) throw new Error(`brand not found: ${brandId}`);
  const config = parseBrandConfig(brand.brandConfig);
  const { candidates, errors, quotaUsed } = await harvestShorts({
    client: getClient(),
    config: config.viralDiscovery.youtube,
    fallbackKeywords: config.topics,
    now,
  });
  const { saved, errors: saveErrors } = await saveCandidates(brandId, candidates, now);
  return { discovered: candidates.length, saved, quotaUsed, errors: [...errors, ...saveErrors] };
}

async function saveCandidates(brandId: string, candidates: ShortsCandidate[], now: Date) {
  const errors: ViralSourceError[] = [];
  let saved = 0;
  for (const candidate of candidates) {
    try {
      await saveShortsCandidate(brandId, candidate, now);
      saved++;
    } catch (error) {
      errors.push(toSourceError(`save:${candidate.videoId}`, error));
    }
  }
  return { saved, errors };
}

type SnapshotExample = { id: string; sourceKey: string; publishedAt: Date };

function toSourceError(source: string, error: unknown): ViralSourceError {
  return { adapter: SHORTS_SOURCE, source, message: error instanceof Error ? error.message : "unknown error" };
}

// The same video can exist once per brand, so one sourceKey maps to several rows.
function groupByKey(examples: SnapshotExample[]): Map<string, SnapshotExample[]> {
  const groups = new Map<string, SnapshotExample[]>();
  for (const example of examples) groups.set(example.sourceKey, [...(groups.get(example.sourceKey) ?? []), example]);
  return groups;
}

async function snapshotRows(rows: SnapshotExample[], video: YoutubeVideo, now: Date, errors: ViralSourceError[]): Promise<number> {
  let count = 0;
  for (const example of rows) {
    try {
      await recordSnapshot(example.id, video, example.publishedAt, now);
      count++;
    } catch (error) {
      errors.push(toSourceError("snapshot", error));
    }
  }
  return count;
}

async function snapshotChunk(
  client: YoutubeClient,
  keys: string[],
  groups: Map<string, SnapshotExample[]>,
  now: Date,
  errors: ViralSourceError[]
): Promise<number> {
  let videos: YoutubeVideo[];
  try {
    videos = await client.listVideos(keys);
  } catch (error) {
    if (error instanceof YoutubeQuotaError) throw error;
    errors.push(toSourceError("snapshot", error));
    return 0;
  }
  let count = 0;
  for (const video of videos) count += await snapshotRows(groups.get(video.id) ?? [], video, now, errors);
  return count;
}

export async function snapshotShorts(now: Date = new Date()) {
  const client = getClient();
  if (!client) return { snapshots: 0, quotaUsed: 0, errors: [AUTH_ERROR] };
  const rows = await prisma.viralExample.findMany({
    where: { source: SHORTS_SOURCE, publishedAt: { gte: new Date(now.getTime() - SNAPSHOT_WINDOW_MS) } },
    select: { id: true, sourceKey: true, publishedAt: true },
  });
  const examples = rows.flatMap((r) => (r.publishedAt ? [{ ...r, publishedAt: r.publishedAt }] : []));
  const errors: ViralSourceError[] = [];
  const groups = groupByKey(examples);
  const keys = [...groups.keys()];
  let snapshots = 0;
  try {
    for (let i = 0; i < keys.length; i += ID_CHUNK) {
      snapshots += await snapshotChunk(client, keys.slice(i, i + ID_CHUNK), groups, now, errors);
    }
  } catch (error) {
    if (!(error instanceof YoutubeQuotaError)) throw error;
    errors.push({ adapter: SHORTS_SOURCE, source: "quota", message: error.message });
  }
  return { snapshots, quotaUsed: client.quotaUsed, errors };
}

export async function cleanupShorts(now: Date = new Date()): Promise<{ deleted: number }> {
  const { count } = await prisma.viralExample.deleteMany({
    where: { source: SHORTS_SOURCE, publishedAt: { lt: new Date(now.getTime() - CLEANUP_AGE_MS) } },
  });
  return { deleted: count };
}
