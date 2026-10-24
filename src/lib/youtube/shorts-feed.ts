import type { Prisma, ViralExample } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { readStoredBaseline } from "@/lib/youtube/shorts-baseline";
import { SHORTS_SOURCE } from "@/lib/youtube/shorts-service";

export type ShortsWindow = "24" | "48";
export type ShortsRegion = "kr" | "global" | "all";
export type ShortsSort = "velocity" | "outlier";

export const OUTLIER_HIGHLIGHT_RATIO = 2; // at or above this multiple of the channel's usual views, the card is highlighted

type MinViews = { kr: number; global: number };

export interface ShortsFeedItem {
  id: string;
  videoId: string;
  title: string;
  channelTitle: string;
  permalink: string;
  thumbnailUrl: string;
  publishedAt: Date;
  views: number;
  likes: number | null;
  comments: number | null;
  velocity: number;
  velocityWindowHours: number;
  country: string;
  outlierRatio: number | null;
  channelMedianViews: number | null;
  baselineSampleSize: number;
}

const FEED_LIMIT = 60;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseShortsFilters(
  searchParams: Record<string, string | string[] | undefined>
): { window: ShortsWindow; region: ShortsRegion; sort: ShortsSort } {
  const window = firstValue(searchParams.window) === "48" ? "48" : "24";
  const region = firstValue(searchParams.region);
  const sort = firstValue(searchParams.sort) === "outlier" ? "outlier" : "velocity";
  return { window, region: region === "global" || region === "all" ? region : "kr", sort };
}

export function buildShortsOrderBy(sort: ShortsSort): Prisma.ViralExampleOrderByWithRelationInput[] {
  return sort === "outlier"
    ? [{ viralScore: "desc" }, { velocityScore: "desc" }]
    : [{ velocityScore: "desc" }, { views: "desc" }];
}

export function buildShortsWhere(input: {
  brandId: string;
  window: ShortsWindow;
  region: ShortsRegion;
  minViews: MinViews;
  now: Date;
}): Prisma.ViralExampleWhereInput {
  const { brandId, window, region, minViews, now } = input;
  const base = {
    brandId,
    source: SHORTS_SOURCE,
    publishedAt: { gte: new Date(now.getTime() - Number(window) * 3_600_000) },
  };
  const kr = { country: "KR", views: { gte: minViews.kr } };
  const global = { country: { not: "KR" }, views: { gte: minViews.global } };
  if (region === "kr") return { ...base, ...kr };
  if (region === "global") return { ...base, ...global };
  return { ...base, OR: [kr, global] };
}

interface ParsedRawMetrics {
  thumbnailUrl: string;
  velocityWindowHours: number;
  outlierRatio: number | null;
  channelMedianViews: number | null;
  baselineSampleSize: number;
}

function parseRawMetrics(raw: string): ParsedRawMetrics {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  const record = typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  const hours = record.velocityWindowHours;
  const baseline = readStoredBaseline(record);
  return {
    thumbnailUrl: typeof record.thumbnailUrl === "string" ? record.thumbnailUrl : "",
    velocityWindowHours: typeof hours === "number" && hours > 0 ? hours : 1,
    outlierRatio: typeof record.outlierRatio === "number" ? record.outlierRatio : null,
    channelMedianViews: baseline?.channelMedianViews ?? null,
    baselineSampleSize: baseline?.baselineSampleSize ?? 0,
  };
}

function toFeedItem(row: ViralExample): ShortsFeedItem {
  const { thumbnailUrl, velocityWindowHours, outlierRatio, channelMedianViews, baselineSampleSize } =
    parseRawMetrics(row.rawMetrics);
  return {
    id: row.id,
    videoId: row.sourceKey,
    title: row.content.split("\n")[0] ?? "",
    channelTitle: row.authorUsername ?? "",
    permalink: row.permalink ?? `https://www.youtube.com/shorts/${row.sourceKey}`,
    thumbnailUrl,
    publishedAt: row.publishedAt ?? row.discoveredAt,
    views: row.views ?? 0,
    likes: row.likes,
    comments: row.replies,
    velocity: row.velocityScore ?? 0,
    velocityWindowHours,
    country: row.country ?? "UNKNOWN",
    outlierRatio,
    channelMedianViews,
    baselineSampleSize,
  };
}

export async function loadShortsFeed(input: {
  brandId: string;
  window: ShortsWindow;
  region: ShortsRegion;
  sort: ShortsSort;
  minViews: MinViews;
  now?: Date;
}): Promise<{ items: ShortsFeedItem[]; lastCapturedAt: Date | null }> {
  const where = buildShortsWhere({ ...input, now: input.now ?? new Date() });
  const [rows, snapshot] = await Promise.all([
    prisma.viralExample.findMany({
      where,
      orderBy: buildShortsOrderBy(input.sort),
      take: FEED_LIMIT,
    }),
    prisma.viralExampleSnapshot.findFirst({
      where: { example: { brandId: input.brandId, source: SHORTS_SOURCE } },
      orderBy: { capturedAt: "desc" },
      select: { capturedAt: true },
    }),
  ]);
  return { items: rows.map(toFeedItem), lastCapturedAt: snapshot?.capturedAt ?? null };
}
