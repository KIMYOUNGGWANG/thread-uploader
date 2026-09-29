import { describe, expect, it } from "vitest";
import {
  buildExperimentReadiness,
  buildLinkExposureComparison,
  buildViralModeComparisons,
  buildViralModeBuckets,
  resolveSummaryViralIntentModeId,
} from "@/lib/campaign-summary-metrics";

const HOUR = 60 * 60 * 1000;
const REFERENCE_TIME = new Date("2026-09-27T12:00:00.000Z");

function comparisonPost(overrides: Partial<{
  campaignFormulaId: string | null;
  publishedAt: Date | null;
  metricsAt: Date | null;
  linkUrl: string | null;
  views: number | null;
  replies: number | null;
  reposts: number | null;
}> = {}) {
  const publishedAt = overrides.publishedAt ?? new Date(REFERENCE_TIME.getTime() - 80 * HOUR);
  const metricsAt = Object.prototype.hasOwnProperty.call(overrides, "metricsAt")
    ? overrides.metricsAt ?? null
    : new Date(publishedAt.getTime() + 73 * HOUR);
  return {
    campaignFormulaId: "imagination_dilemma",
    publishedAt,
    metricsAt,
    linkUrl: null,
    views: 100,
    replies: 5,
    reposts: 2,
    ...overrides,
  };
}

describe("campaign summary viral mode reporting", () => {
  it("normalizes legacy and current formula ids into viral intent mode buckets", () => {
    const posts = [
      { campaignFormulaId: "comment_diagnosis" },
      { campaignFormulaId: "self_classification" },
      { campaignFormulaId: "saveable_tool" },
      { campaignFormulaId: "quiet_contrarian" },
      { campaignFormulaId: "friend_share" },
      { campaignFormulaId: "custom_format" },
      { campaignFormulaId: null },
    ];

    expect(resolveSummaryViralIntentModeId(posts[0])).toBe("self_classification");
    expect(resolveSummaryViralIntentModeId(posts[5])).toBeNull();
    expect(buildViralModeBuckets(posts)).toEqual({
      self_classification: 2,
      saveable_tool: 1,
      quiet_contrarian: 1,
      friend_share: 1,
    });
  });

  it("separates immature, missing, and measured zero-view posts at the 72-hour boundary", () => {
    const posts = [
      comparisonPost({ publishedAt: new Date(REFERENCE_TIME.getTime() - 71 * HOUR) }),
      comparisonPost({ metricsAt: null, views: null }),
      comparisonPost({ views: 0, replies: 0, reposts: 0 }),
      comparisonPost({ publishedAt: new Date(REFERENCE_TIME.getTime() - 72 * HOUR) }),
    ];

    expect(buildExperimentReadiness(posts, REFERENCE_TIME)).toEqual({
      status: "incomplete",
      totalPosts: 4,
      immaturePosts: 1,
      maturePosts: 3,
      measuredMaturePosts: 2,
      missingMetricsPosts: 1,
      zeroViewMaturePosts: 1,
    });
  });

  it("calculates mature-only medians and engagement rates for link and control groups", () => {
    const posts = [
      comparisonPost({ linkUrl: "https://example.com/a", views: 100, replies: 10, reposts: 5 }),
      comparisonPost({ linkUrl: "https://example.com/b", views: 300, replies: 15, reposts: 3 }),
      comparisonPost({ linkUrl: null, views: 0, replies: 0, reposts: 0 }),
      comparisonPost({ linkUrl: null, metricsAt: null, views: null, replies: null, reposts: null }),
    ];

    expect(buildLinkExposureComparison(posts, REFERENCE_TIME)).toEqual({
      linked: {
        totalPosts: 2,
        maturePosts: 2,
        measuredPosts: 2,
        missingMetricsPosts: 0,
        medianViews: 200,
        replyRate: 6.25,
        repostRate: 2,
      },
      control: {
        totalPosts: 2,
        maturePosts: 2,
        measuredPosts: 1,
        missingMetricsPosts: 1,
        medianViews: 0,
        replyRate: 0,
        repostRate: 0,
      },
    });
  });

  it("groups mature comparisons by normalized viral mode", () => {
    const posts = [
      comparisonPost({ campaignFormulaId: "lotto_zero_friction", views: 100 }),
      comparisonPost({ campaignFormulaId: "imagination_dilemma", views: 300 }),
      comparisonPost({ campaignFormulaId: "concept_hierarchy", views: 50 }),
    ];

    expect(buildViralModeComparisons(posts, REFERENCE_TIME)).toMatchObject([
      { viralIntentModeId: "imagination_dilemma", medianViews: 200, measuredPosts: 2 },
      { viralIntentModeId: "concept_hierarchy", medianViews: 50, measuredPosts: 1 },
    ]);
  });

  it("marks an empty experiment separately from a fully ready one", () => {
    expect(buildExperimentReadiness([], REFERENCE_TIME).status).toBe("empty");
    expect(buildExperimentReadiness([comparisonPost()], REFERENCE_TIME).status).toBe("ready");
  });
});
