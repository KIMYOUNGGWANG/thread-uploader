import type { ViralDiscoveryConfig } from "@/types/brand";
import type { ViralSourceError } from "@/types/viral";
import { YoutubeQuotaError, type YoutubeClient, type YoutubeVideo } from "./youtube-api";

const ADAPTER = "youtube_shorts" as const;
const MAX_SEARCHES = 8;
const WINDOW_MS = 48 * 60 * 60 * 1000;
const SEARCH_MAX_RESULTS = 25;
const HANDLE_UPLOADS = 10;
const MAX_FALLBACK_KEYWORDS = 3;

export interface ShortsCandidate {
  videoId: string;
  channelId: string;
  channelTitle: string;
  title: string;
  description: string;
  publishedAt: Date;
  durationSec: number;
  thumbnailUrl: string;
  country: string;
  views: number;
  likes: number | null;
  comments: number | null;
  searchKeyword: string | null;
  searchRank: number | null;
  keywordHits: number;
}

export interface ShortsHarvestResult {
  candidates: ShortsCandidate[];
  errors: ViralSourceError[];
  quotaUsed: number;
}

interface Hit {
  keywords: Set<string>;
  bestKeyword: string | null;
  bestRank: number | null;
}

interface RunState {
  hits: Map<string, Hit>;
  errors: ViralSourceError[];
  quotaHit: boolean;
}

function pushError(state: RunState, source: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  state.errors.push({ adapter: ADAPTER, source, message });
}

/** Records a quota error once; returns true when `error` was a quota error. */
function noteQuota(state: RunState, error: unknown): boolean {
  if (!(error instanceof YoutubeQuotaError)) return false;
  if (!state.quotaHit) pushError(state, "quota", error);
  state.quotaHit = true;
  return true;
}

function getHit(state: RunState, videoId: string): Hit {
  const existing = state.hits.get(videoId);
  if (existing) return existing;
  const created: Hit = { keywords: new Set(), bestKeyword: null, bestRank: null };
  state.hits.set(videoId, created);
  return created;
}

function addSearchHit(state: RunState, videoId: string, keyword: string, rank: number) {
  const hit = getHit(state, videoId);
  hit.keywords.add(keyword);
  if (hit.bestRank === null || rank < hit.bestRank) {
    hit.bestRank = rank;
    hit.bestKeyword = keyword;
  }
}

async function searchPhase(
  client: YoutubeClient,
  state: RunState,
  keywords: string[],
  regions: Array<"KR" | "GLOBAL">,
  publishedAfter: Date,
) {
  const combos = keywords.flatMap((query) => regions.map((region) => ({ query, region })));
  for (const { query, region } of combos.slice(0, MAX_SEARCHES)) {
    try {
      const found = await client.searchShortIds({ query, region, publishedAfter, maxResults: SEARCH_MAX_RESULTS });
      for (const { videoId, rank } of found) addSearchHit(state, videoId, query, rank);
    } catch (error) {
      if (noteQuota(state, error)) return;
      pushError(state, `search:${query}:${region}`, error);
    }
  }
}

async function handlePhase(client: YoutubeClient, state: RunState, handles: string[]) {
  for (const handle of new Set(handles.filter((h) => h !== ""))) {
    if (state.quotaHit) return;
    try {
      const channel = await client.resolveHandle(handle);
      if (!channel) throw new Error("channel not found");
      const ids = await client.recentUploads(channel.uploadsPlaylistId, HANDLE_UPLOADS);
      for (const id of ids) getHit(state, id);
    } catch (error) {
      if (noteQuota(state, error)) return;
      pushError(state, `channel:${handle}`, error);
    }
  }
}

async function hydrate(client: YoutubeClient, state: RunState, config: ViralDiscoveryConfig["youtube"], now: Date) {
  const ids = [...state.hits.keys()];
  if (ids.length === 0) return [];
  const cutoff = now.getTime() - WINDOW_MS;
  try {
    const videos = await client.listVideos(ids);
    const kept = videos.filter(
      (v) =>
        v.durationSec !== null &&
        v.durationSec > 0 &&
        v.durationSec <= config.maxDurationSec &&
        v.publishedAt.getTime() >= cutoff,
    );
    const channels = await client.listChannels([...new Set(kept.map((v) => v.channelId))]);
    const countries = new Map(channels.map((c) => [c.id, c.country]));
    return kept.map((v) => toCandidate(v, countries, state.hits.get(v.id)));
  } catch (error) {
    if (!noteQuota(state, error)) pushError(state, "videos", error);
    return [];
  }
}

function toCandidate(
  video: YoutubeVideo,
  countries: Map<string, string>,
  hit: Hit | undefined,
): ShortsCandidate {
  return {
    videoId: video.id,
    channelId: video.channelId,
    channelTitle: video.channelTitle,
    title: video.title,
    description: video.description,
    publishedAt: video.publishedAt,
    durationSec: video.durationSec ?? 0,
    thumbnailUrl: video.thumbnailUrl,
    country: countries.get(video.channelId) || "UNKNOWN",
    views: video.views,
    likes: video.likes,
    comments: video.comments,
    searchKeyword: hit?.bestKeyword ?? null,
    searchRank: hit?.bestRank ?? null,
    keywordHits: hit?.keywords.size ?? 0,
  };
}

export async function harvestShorts(input: {
  client: YoutubeClient | null;
  config: ViralDiscoveryConfig["youtube"];
  fallbackKeywords: string[];
  now: Date;
}): Promise<ShortsHarvestResult> {
  const { client, config, fallbackKeywords, now } = input;
  if (!client) {
    const error = { adapter: ADAPTER, source: "auth", message: "YOUTUBE_API_KEY is not set" };
    return { candidates: [], errors: [error], quotaUsed: 0 };
  }
  const keywords = config.keywords.length > 0 ? config.keywords : fallbackKeywords.slice(0, MAX_FALLBACK_KEYWORDS);
  if (keywords.length === 0) {
    const error = { adapter: ADAPTER, source: "config", message: "no keywords configured" };
    return { candidates: [], errors: [error], quotaUsed: client.quotaUsed };
  }
  const state: RunState = { hits: new Map(), errors: [], quotaHit: false };
  await searchPhase(client, state, keywords, config.regions, new Date(now.getTime() - WINDOW_MS));
  await handlePhase(client, state, config.channelHandles);
  const candidates = await hydrate(client, state, config, now);
  return { candidates, errors: state.errors, quotaUsed: client.quotaUsed };
}
