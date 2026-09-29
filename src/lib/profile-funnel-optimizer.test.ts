import { describe, expect, it } from "vitest";
import {
  generateOptimizedProfileBio,
  THREADS_BIO_MAX_LENGTH,
} from "./profile-funnel-optimizer";
import { parseBrandConfig } from "@/types/brand";

describe("Profile Funnel Optimizer", () => {
  const mockConfig = parseBrandConfig(JSON.stringify({
    systemPrompt: "CosmicPath bio generator",
    topics: ["사주", "이직타이밍"],
    targets: ["퇴사와 이직 사이에서 방황하는 직장인"],
    productProfile: {
      productName: "CosmicPath",
      offerPromise: "이직 골든타임 7일 판정 리포트",
      landingUrl: "https://cosmicpath.app/timing",
    },
    qualityProfile: "saju_viral",
  }));

  it("generates a bio within the strict 150-character Threads limit", () => {
    const result = generateOptimizedProfileBio(mockConfig);

    expect(result.charCount).toBeLessThanOrEqual(THREADS_BIO_MAX_LENGTH);
    expect(result.withinLimit).toBe(true);
    expect(result.bio).toContain("↓");
  });

  it("includes up to 10 curated discoverability topic tags", () => {
    const result = generateOptimizedProfileBio(mockConfig);

    expect(result.topicTags.length).toBeGreaterThan(0);
    expect(result.topicTags.length).toBeLessThanOrEqual(10);
    expect(result.topicTags).toContain("사주");
  });

  it("generates tracked Bio URL with ref=threads_bio", () => {
    const result = generateOptimizedProfileBio(mockConfig);

    expect(result.trackedBioUrl).toContain("ref=threads_bio");
    expect(result.trackedBioUrl).toContain("track=track_c");
  });

  it("handles custom options and compresses long text when necessary", () => {
    const longOptions = {
      targetAudience: "초기 스타트업에서 사수도 없이 매일 야근하며 갈려나가는 주니어 개발자",
      offerPromise: "이직할 때 연봉 30% 상승 가능한 포트폴리오 진단 및 타이밍 계산기",
      credibilityProof: "국내 유수 IT 기업 500명 합격자 데이터 분석",
      ctaText: "내 이직 타이밍 무료 진단표 확인하기 ↓",
    };

    const result = generateOptimizedProfileBio(mockConfig, null, longOptions);
    expect(result.charCount).toBeLessThanOrEqual(THREADS_BIO_MAX_LENGTH);
    expect(result.withinLimit).toBe(true);
  });
});
