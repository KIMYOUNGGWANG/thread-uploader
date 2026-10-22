import { describe, it, expect, vi } from "vitest";
import channelsFixture from "./__fixtures__/channels.json";
import playlistFixture from "./__fixtures__/playlist-items.json";
import searchFixture from "./__fixtures__/search.json";
import videosFixture from "./__fixtures__/videos.json";
import { createYoutubeClient, YoutubeQuotaError, type YoutubeClient } from "./youtube-api";
import { harvestShorts } from "./shorts-harvester";
import type { ViralDiscoveryConfig } from "@/types/brand";

const now = new Date("2026-10-22T12:00:00Z");
const defaults: ViralDiscoveryConfig["youtube"] = {
  keywords: ["사주"],
  channelHandles: [],
  regions: ["KR"],
  maxDurationSec: 180,
  minViews: { kr: 10000, global: 50000 },
};

type Item = { id?: unknown };

function pick(fixture: { items: Item[] }, ids: string[]) {
  return { ...fixture, items: fixture.items.filter((item) => ids.includes(String(item.id))) };
}

function fixtureFetch(): typeof fetch {
  return async (input) => {
    const url = new URL(String(input));
    const endpoint = url.pathname.split("/").pop();
    const ids = (url.searchParams.get("id") ?? "").split(",");
    const bodies: Record<string, unknown> = {
      search: searchFixture,
      videos: pick(videosFixture, ids),
      channels: url.searchParams.has("forHandle")
        ? { ...channelsFixture, items: channelsFixture.items.slice(0, 1) }
        : pick(channelsFixture, ids),
      playlistItems: playlistFixture,
    };
    return new Response(JSON.stringify(bodies[endpoint ?? ""]), { status: 200 });
  };
}

function fakeClient(overrides: Partial<YoutubeClient> = {}): YoutubeClient {
  const real = createYoutubeClient("test-key", fixtureFetch());
  return {
    searchShortIds: vi.fn(real.searchShortIds),
    listVideos: vi.fn(real.listVideos),
    listChannels: vi.fn(real.listChannels),
    resolveHandle: vi.fn(real.resolveHandle),
    recentUploads: vi.fn(real.recentUploads),
    get quotaUsed() {
      return real.quotaUsed;
    },
    ...overrides,
  };
}

describe("harvestShorts", () => {
  it("returns one auth error and no calls when the client is null", async () => {
    const result = await harvestShorts({ client: null, config: defaults, fallbackKeywords: ["사주"], now });
    expect(result.errors).toEqual([{ adapter: "youtube_shorts", source: "auth", message: "YOUTUBE_API_KEY is not set" }]);
    expect(result.candidates).toEqual([]);
    expect(result.quotaUsed).toBe(0);
  });

  it("returns a config error when there are no keywords at all", async () => {
    const client = fakeClient();
    const result = await harvestShorts({ client, config: { ...defaults, keywords: [] }, fallbackKeywords: [], now });
    expect(result.errors).toEqual([{ adapter: "youtube_shorts", source: "config", message: "no keywords configured" }]);
    expect(client.searchShortIds).not.toHaveBeenCalled();
  });

  it("falls back to brand topics (max 3) when keywords are empty", async () => {
    const client = fakeClient();
    await harvestShorts({ client, config: { ...defaults, keywords: [] }, fallbackKeywords: ["a", "b", "c", "d"], now });
    const queries = vi.mocked(client.searchShortIds).mock.calls.map(([input]) => input.query);
    expect(queries).toEqual(["a", "b", "c"]);
  });

  it("drops videos longer than maxDurationSec", async () => {
    const client = fakeClient();
    const result = await harvestShorts({ client, config: defaults, fallbackKeywords: [], now });
    expect(result.candidates.map((c) => c.videoId)).toEqual(["short45sec01"]);
    expect(result.candidates[0]).toMatchObject({
      durationSec: 45,
      views: 120000,
      likes: 5400,
      comments: 210,
      country: "KR",
      searchKeyword: "사주",
      searchRank: 1,
      keywordHits: 1,
      thumbnailUrl: "https://i.ytimg.com/vi/short45sec01/maxresdefault.jpg",
    });
    expect(result.quotaUsed).toBe(102);
  });

  it("drops ids missing from videos.list", async () => {
    const result = await harvestShorts({
      client: fakeClient(),
      config: { ...defaults, maxDurationSec: 300 },
      fallbackKeywords: [],
      now,
    });
    expect(result.candidates.map((c) => c.videoId)).not.toContain("ghostvideo01");
    expect(result.errors).toEqual([]);
  });

  it("defaults country to UNKNOWN when the channel has none", async () => {
    const result = await harvestShorts({
      client: fakeClient(),
      config: { ...defaults, maxDurationSec: 300 },
      fallbackKeywords: [],
      now,
    });
    const long = result.candidates.find((c) => c.videoId === "long200sec01");
    expect(long?.country).toBe("UNKNOWN");
    expect(long?.likes).toBeNull();
    expect(long?.comments).toBeNull();
  });

  it("merges keywordHits and best searchRank when two keywords surface the same video", async () => {
    const searchShortIds = vi.fn(async ({ query }: { query: string }) => [
      { videoId: "short45sec01", rank: query === "a" ? 3 : 1 },
    ]);
    const client = fakeClient({ searchShortIds });
    const result = await harvestShorts({ client, config: { ...defaults, keywords: ["a", "b"] }, fallbackKeywords: [], now });
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({ keywordHits: 2, searchRank: 1, searchKeyword: "b" });
  });

  it("caps search calls at 8 per run", async () => {
    const client = fakeClient();
    const config: ViralDiscoveryConfig["youtube"] = { ...defaults, keywords: ["1", "2", "3", "4", "5"], regions: ["KR", "GLOBAL"] };
    await harvestShorts({ client, config, fallbackKeywords: [], now });
    expect(client.searchShortIds).toHaveBeenCalledTimes(8);
  });

  it("resolves channel handles once and reads their recent uploads", async () => {
    const client = fakeClient();
    const config = { ...defaults, keywords: [], channelHandles: ["krchannel", "krchannel", ""] };
    const result = await harvestShorts({ client, config, fallbackKeywords: ["사주"], now });
    expect(client.resolveHandle).toHaveBeenCalledTimes(1);
    expect(client.resolveHandle).toHaveBeenCalledWith("krchannel");
    expect(client.recentUploads).toHaveBeenCalledWith("UU_kr_channel", 10);
    expect(result.candidates.map((c) => c.videoId)).toContain("short45sec01");
  });
});

describe("createYoutubeClient", () => {
  it("builds the KR search query and counts 100 quota per search", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request) => new Response(JSON.stringify(searchFixture), { status: 200 }));
    const client = createYoutubeClient("secret", fetchImpl);
    const publishedAfter = new Date("2026-10-20T12:00:00Z");
    const ids = await client.searchShortIds({ query: "사주", region: "KR", publishedAfter, maxResults: 25 });
    const params = new URL(String(fetchImpl.mock.calls[0]?.[0])).searchParams;
    expect(Object.fromEntries(params)).toEqual({
      part: "id",
      type: "video",
      videoDuration: "short",
      order: "viewCount",
      q: "사주",
      publishedAfter: "2026-10-20T12:00:00.000Z",
      maxResults: "25",
      regionCode: "KR",
      relevanceLanguage: "ko",
      key: "secret",
    });
    expect(ids.map((i) => i.rank)).toEqual([1, 2, 3]);
    expect(client.quotaUsed).toBe(100);
    await client.searchShortIds({ query: "x", region: "GLOBAL", publishedAfter, maxResults: 5 });
    expect(new URL(String(fetchImpl.mock.calls[1]?.[0])).searchParams.has("regionCode")).toBe(false);
    expect(client.quotaUsed).toBe(200);
  });

  it("throws YoutubeQuotaError on 403 quotaExceeded and a plain Error otherwise", async () => {
    const quota = createYoutubeClient("k", async () => new Response('{"error":{"errors":[{"reason":"quotaExceeded"}]}}', { status: 403 }));
    await expect(quota.listVideos(["a"])).rejects.toBeInstanceOf(YoutubeQuotaError);
    const broken = createYoutubeClient("k", async () => new Response("nope", { status: 500 }));
    await expect(broken.listVideos(["a"])).rejects.toThrow("youtube videos 500");
  });
});
