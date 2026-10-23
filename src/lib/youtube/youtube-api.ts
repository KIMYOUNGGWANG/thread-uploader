import { parseIsoDuration } from "./duration";

const BASE_URL = "https://www.googleapis.com/youtube/v3";
const ID_CHUNK = 50;
const SEARCH_COST = 100;

export interface YoutubeVideo {
  id: string;
  channelId: string;
  channelTitle: string;
  title: string;
  description: string;
  publishedAt: Date;
  durationSec: number | null;
  thumbnailUrl: string;
  views: number;
  likes: number | null;
  comments: number | null;
}

export interface YoutubeChannel {
  id: string;
  title: string;
  country: string;
  uploadsPlaylistId: string;
}

export interface YoutubeClient {
  searchShortIds(input: {
    query: string;
    region: "KR" | "GLOBAL";
    publishedAfter: Date;
    maxResults: number;
  }): Promise<Array<{ videoId: string; rank: number }>>;
  listVideos(ids: string[]): Promise<YoutubeVideo[]>;
  listChannels(ids: string[]): Promise<YoutubeChannel[]>;
  resolveHandle(handle: string): Promise<YoutubeChannel | null>;
  recentUploads(uploadsPlaylistId: string, maxResults: number): Promise<string[]>;
  readonly quotaUsed: number;
}

export class YoutubeQuotaError extends Error {
  constructor() {
    super("youtube quota exceeded");
    this.name = "YoutubeQuotaError";
  }
}

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rec(value: unknown): Json {
  return isRecord(value) ? value : {};
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function count(value: unknown): number | null {
  const n = typeof value === "string" || typeof value === "number" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

function itemsOf(json: Json): Json[] {
  return Array.isArray(json.items) ? json.items.filter(isRecord) : [];
}

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

function pickThumbnail(thumbnails: Json): string {
  for (const key of ["maxres", "high", "medium", "default"]) {
    const url = str(rec(thumbnails[key]).url);
    if (url) return url;
  }
  return "";
}

function parseVideo(item: Json): YoutubeVideo | null {
  const snippet = rec(item.snippet);
  const stats = rec(item.statistics);
  const duration = str(rec(item.contentDetails).duration);
  const id = str(item.id);
  const publishedAt = new Date(str(snippet.publishedAt));
  if (!id || Number.isNaN(publishedAt.getTime())) return null;
  return {
    id,
    channelId: str(snippet.channelId),
    channelTitle: str(snippet.channelTitle),
    title: str(snippet.title),
    description: str(snippet.description),
    publishedAt,
    durationSec: duration ? parseIsoDuration(duration) : null,
    thumbnailUrl: pickThumbnail(rec(snippet.thumbnails)),
    views: count(stats.viewCount) ?? 0,
    likes: count(stats.likeCount),
    comments: count(stats.commentCount),
  };
}

function parseChannel(item: Json): YoutubeChannel | null {
  const snippet = rec(item.snippet);
  const id = str(item.id);
  if (!id) return null;
  return {
    id,
    title: str(snippet.title),
    country: str(snippet.country),
    uploadsPlaylistId: str(rec(rec(item.contentDetails).relatedPlaylists).uploads),
  };
}

function notNull<T>(value: T | null): value is T {
  return value !== null;
}

export function createYoutubeClient(apiKey: string, fetchImpl: typeof fetch = fetch): YoutubeClient {
  let quotaUsed = 0;

  async function call(endpoint: string, params: Record<string, string>, cost = 1): Promise<Json> {
    quotaUsed += cost;
    const query = new URLSearchParams({ ...params, key: apiKey });
    const res = await fetchImpl(`${BASE_URL}/${endpoint}?${query}`);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 403 && body.includes("quotaExceeded")) throw new YoutubeQuotaError();
      throw new Error(`youtube ${endpoint} ${res.status}`);
    }
    const json: unknown = await res.json();
    return rec(json);
  }

  async function byIds<T>(endpoint: string, part: string, ids: string[], parse: (item: Json) => T | null) {
    const out: T[] = [];
    for (const group of chunk(ids, ID_CHUNK)) {
      const json = await call(endpoint, { part, id: group.join(","), maxResults: String(group.length) });
      out.push(...itemsOf(json).map(parse).filter(notNull));
    }
    return out;
  }

  return {
    async searchShortIds({ query, region, publishedAfter, maxResults }) {
      const params: Record<string, string> = {
        part: "id",
        type: "video",
        videoDuration: "short",
        order: "viewCount",
        q: query,
        publishedAfter: publishedAfter.toISOString(),
        maxResults: String(maxResults),
      };
      if (region === "KR") Object.assign(params, { regionCode: "KR", relevanceLanguage: "ko" });
      const json = await call("search", params, SEARCH_COST);
      return itemsOf(json)
        .map((item, index) => ({ videoId: str(rec(item.id).videoId), rank: index + 1 }))
        .filter((hit) => hit.videoId !== "");
    },
    listVideos: (ids) => byIds("videos", "snippet,contentDetails,statistics", ids, parseVideo),
    listChannels: (ids) => byIds("channels", "snippet,contentDetails", ids, parseChannel),
    async resolveHandle(handle) {
      const json = await call("channels", { part: "snippet,contentDetails", forHandle: handle });
      const first = itemsOf(json)[0];
      return first ? parseChannel(first) : null;
    },
    async recentUploads(uploadsPlaylistId, maxResults) {
      const json = await call("playlistItems", {
        part: "contentDetails",
        playlistId: uploadsPlaylistId,
        maxResults: String(maxResults),
      });
      return itemsOf(json)
        .map((item) => str(rec(item.contentDetails).videoId))
        .filter((id) => id !== "");
    },
    get quotaUsed() {
      return quotaUsed;
    },
  };
}
