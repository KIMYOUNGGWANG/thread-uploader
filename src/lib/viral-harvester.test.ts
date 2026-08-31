import { describe, it, expect } from "vitest";
import {
  hashContent,
  isContentExcluded,
  deduplicateHarvestedCandidates,
  convertThreadsPostToCandidate,
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
