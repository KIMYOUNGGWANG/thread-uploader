import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  hashContent,
  isContentExcluded,
  deduplicateHarvestedCandidates,
  convertThreadsPostToCandidate,
  annotateSearchSignals,
  allExternalSourcesFailed,
  harvestFromThreadsSources,
  convertScrapeCreatorsPostToCandidate,
  type HarvestedCandidate,
} from "./viral-harvester";
import { fetchPublicProfilePosts, searchThreadsByKeyword } from "@/lib/threads-api";
import type { ScrapeCreatorsThreadsClient, ScrapeCreatorsThreadsPost } from "@/lib/scrapecreators/threads-client";

vi.mock("@/lib/threads-api", () => ({
  searchThreadsByKeyword: vi.fn(async () => []),
  fetchPublicProfilePosts: vi.fn(async () => []),
}));

describe("Viral Harvester", () => {
  beforeEach(() => vi.clearAllMocks());

  it("generates deterministic hashes for normalized content", () => {
    const hash1 = hashContent("  안녕하세요   반갑습니다! \n ");
    const hash2 = hashContent("안녕하세요 반갑습니다!");
    expect(hash1).toBe(hash2);
  });

  it("filters excluded terms accurately", () => {
    expect(isContentExcluded("이것은 광고성 글입니다", ["광고", "협찬"])).toBe(true);
    expect(isContentExcluded("정상적인 커리어 조언 글입니다", ["광고", "협찬"])).toBe(false);
  });

  it("deduplicates candidates based on content hash and source key", () => {
    const candidateA: HarvestedCandidate = {
      adapter: "threads_keyword",
      source: "keyword:커리어",
      sourceKey: "123",
      contentHash: hashContent("중복 텍스트입니다"),
      authorUsername: "user1",
      permalink: null,
      content: "중복 텍스트입니다",
      publishedAt: null,
      views: null,
      likes: null,
      replies: null,
      reposts: null,
      quotes: null,
      shares: null,
      rawMetrics: {},
    };

    const candidateB: HarvestedCandidate = {
      ...candidateA,
      sourceKey: "456", // different id but same text
    };

    const candidateC: HarvestedCandidate = {
      ...candidateA,
      sourceKey: "789",
      contentHash: hashContent("완전히 다른 고유한 텍스트입니다"),
      content: "완전히 다른 고유한 텍스트입니다",
    };

    const deduped = deduplicateHarvestedCandidates([candidateA, candidateB, candidateC]);
    expect(deduped.length).toBe(2);
    expect(deduped[0].content).toBe("중복 텍스트입니다");
    expect(deduped[1].content).toBe("완전히 다른 고유한 텍스트입니다");
  });

  it("converts threads post to valid candidate", () => {
    const post = {
      id: "post_001",
      text: "이직할 때 가장 중요한 3가지",
      username: "career_coach",
      timestamp: "2026-08-30T10:00:00Z",
    };
    const candidate = convertThreadsPostToCandidate(post, "threads_profile", "profile:@career_coach");
    expect(candidate).not.toBeNull();
    expect(candidate?.sourceKey).toBe("post_001");
    expect(candidate?.authorUsername).toBe("career_coach");
    expect(candidate?.content).toBe("이직할 때 가장 중요한 3가지");
  });
});

describe("annotateSearchSignals", () => {
  const fromSearch = (id: string, keyword: string, rank: number): HarvestedCandidate => {
    const candidate = convertThreadsPostToCandidate({ id, text: `post ${id}` }, "threads_keyword", `keyword:${keyword}`, { keyword });
    if (!candidate) throw new Error("fixture must convert");
    candidate.rawMetrics.searchRank = rank;
    return candidate;
  };

  it("counts keyword overlap and keeps the best rank per post", () => {
    const annotated = annotateSearchSignals([fromSearch("a", "이직", 4), fromSearch("a", "퇴사", 1), fromSearch("b", "이직", 2)]);

    expect(annotated[0].rawMetrics).toMatchObject({ searchRank: 1, keywordHits: 2 });
    expect(annotated[2].rawMetrics).toMatchObject({ searchRank: 2, keywordHits: 1 });
  });

  it("leaves profile posts without a search rank untouched", () => {
    const profilePost = convertThreadsPostToCandidate({ id: "p", text: "profile" }, "threads_profile", "profile:@x");
    if (!profilePost) throw new Error("fixture must convert");
    expect(annotateSearchSignals([profilePost])[0].rawMetrics.keywordHits).toBeUndefined();
  });

  it("flags a harvest only when every attempted external source failed", () => {
    const error = { adapter: "threads_keyword" as const, source: "saju", message: "no permission" };
    expect(allExternalSourcesFailed({ attemptedSources: 2, errors: [error, error] })).toBe(true);
    expect(allExternalSourcesFailed({ attemptedSources: 2, errors: [error] })).toBe(false);
    // A brand with no keywords/handles never tried an external source, so there is nothing to fail.
    expect(allExternalSourcesFailed({ attemptedSources: 0, errors: [] })).toBe(false);
  });

  it("queries up to 10 keywords", async () => {
    const keywords = Array.from({ length: 12 }, (_, index) => `kw${index}`);
    const result = await harvestFromThreadsSources({ accessToken: "t", keywords, requestDelayMs: 0 });

    expect(result.attemptedSources).toBe(10);
    expect(searchThreadsByKeyword).toHaveBeenCalledTimes(10);
  });
});

describe("ScrapeCreators source", () => {
  beforeEach(() => vi.clearAllMocks());

  const scPost = (code: string, overrides: Partial<ScrapeCreatorsThreadsPost> = {}): ScrapeCreatorsThreadsPost => ({
    code,
    pk: `pk_${code}`,
    text: `글 ${code}`,
    username: "the.saju",
    url: `https://www.threads.com/@the.saju/post/${code}`,
    takenAt: new Date("2026-11-04T00:00:00Z"),
    likeCount: 120,
    replyCount: null,
    repostCount: null,
    quoteCount: null,
    ...overrides,
  });

  function fakeClient(overrides: Partial<ScrapeCreatorsThreadsClient> = {}): ScrapeCreatorsThreadsClient {
    return {
      search: vi.fn(async () => ({ posts: [scPost("A1"), scPost("B2")], creditsRemaining: 900 })),
      userPosts: vi.fn(async () => ({ posts: [scPost("P1")], creditsRemaining: 880 })),
      ...overrides,
    };
  }

  it("keys a post by its shortcode and keeps likes as a count, never views", () => {
    const candidate = convertScrapeCreatorsPostToCandidate(scPost("A1", { replyCount: 3 }), "keyword:사주", { keyword: "사주" });

    expect(candidate).toMatchObject({
      adapter: "threads_scrapecreators",
      source: "keyword:사주",
      sourceKey: "A1",
      likes: 120,
      replies: 3,
      views: null,
      rawMetrics: { keyword: "사주", provider: "scrapecreators", scPk: "pk_A1", likeCount: 120, hasReplies: true },
    });
    expect(convertScrapeCreatorsPostToCandidate(scPost("A1"), "keyword:사주")?.rawMetrics.hasReplies).toBeNull();
    expect(convertScrapeCreatorsPostToCandidate(scPost("A1", { text: "   " }), "keyword:사주")).toBeNull();
  });

  it("replaces the official calls, ranks search hits and reports the lowest credit balance", async () => {
    const client = fakeClient();
    const now = new Date("2026-11-05T00:00:00Z");
    const result = await harvestFromThreadsSources({
      accessToken: "t",
      scrapeCreators: client,
      keywords: ["사주"],
      handles: ["the.saju"],
      requestDelayMs: 0,
      now,
    });

    expect(searchThreadsByKeyword).not.toHaveBeenCalled();
    expect(fetchPublicProfilePosts).not.toHaveBeenCalled();
    expect(client.search).toHaveBeenCalledWith("사주", { startDate: new Date("2026-10-29T00:00:00Z") });
    expect(result.candidates.map((c) => [c.source, c.sourceKey, c.rawMetrics.searchRank])).toEqual([
      ["keyword:사주", "A1", 1],
      ["keyword:사주", "B2", 2],
      ["profile:@the.saju", "P1", undefined],
    ]);
    expect(result).toMatchObject({ attemptedSources: 2, errors: [], creditsRemaining: 880 });
  });

  it("runs without a Threads token", async () => {
    const result = await harvestFromThreadsSources({ accessToken: null, scrapeCreators: fakeClient(), keywords: ["사주"], requestDelayMs: 0 });

    expect(result.candidates).toHaveLength(2);
    expect(result.errors).toEqual([]);
  });

  it("falls back to the official search in the same run when every paid call fails", async () => {
    const failing = fakeClient({ search: vi.fn(async () => { throw new Error("scrapecreators /v1/threads/search 402"); }) });
    vi.mocked(searchThreadsByKeyword).mockResolvedValueOnce([{ id: "official1", text: "공식 결과" }]);

    const result = await harvestFromThreadsSources({ accessToken: "t", scrapeCreators: failing, keywords: ["사주"], requestDelayMs: 0 });

    expect(searchThreadsByKeyword).toHaveBeenCalledTimes(1);
    expect(result.candidates.map((c) => c.sourceKey)).toEqual(["official1"]);
    expect(result.errors).toEqual([{ adapter: "threads_scrapecreators", source: "사주", message: "scrapecreators /v1/threads/search 402" }]);
    expect(allExternalSourcesFailed(result)).toBe(false);
  });

  it("does not fall back while at least one paid call succeeds", async () => {
    const search = vi.fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce({ posts: [scPost("C3")], creditsRemaining: 10 });
    const result = await harvestFromThreadsSources({
      accessToken: "t",
      scrapeCreators: fakeClient({ search }),
      keywords: ["a", "b"],
      requestDelayMs: 0,
    });

    expect(searchThreadsByKeyword).not.toHaveBeenCalled();
    expect(result.candidates.map((c) => c.sourceKey)).toEqual(["C3"]);
    expect(result.errors).toHaveLength(1);
  });

  it("reports all sources failed when the paid calls fail and there is no token to fall back to", async () => {
    const failing = fakeClient({ search: vi.fn(async () => { throw new Error("401"); }) });
    const result = await harvestFromThreadsSources({ accessToken: null, scrapeCreators: failing, keywords: ["사주"], requestDelayMs: 0 });

    expect(allExternalSourcesFailed(result)).toBe(true);
  });
});
