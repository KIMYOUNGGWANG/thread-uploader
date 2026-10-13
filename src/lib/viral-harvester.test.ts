import { describe, it, expect } from "vitest";
import {
  hashContent,
  isContentExcluded,
  deduplicateHarvestedCandidates,
  convertThreadsPostToCandidate,
  annotateSearchSignals,
  type HarvestedCandidate,
} from "./viral-harvester";

describe("Viral Harvester", () => {
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
});
