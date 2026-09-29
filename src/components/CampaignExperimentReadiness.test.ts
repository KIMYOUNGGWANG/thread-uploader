import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CampaignExperimentReadiness } from "@/components/CampaignExperimentReadiness";

describe("CampaignExperimentReadiness", () => {
  it("renders mature progress and link versus control medians", () => {
    const markup = renderToStaticMarkup(React.createElement(CampaignExperimentReadiness, {
      readiness: {
        status: "incomplete",
        totalPosts: 15,
        immaturePosts: 9,
        maturePosts: 6,
        measuredMaturePosts: 5,
        missingMetricsPosts: 1,
        zeroViewMaturePosts: 1,
      },
      linkExposureComparison: {
        linked: {
          totalPosts: 5,
          maturePosts: 2,
          measuredPosts: 2,
          missingMetricsPosts: 0,
          medianViews: 420,
          replyRate: 4.5,
          repostRate: 1.2,
        },
        control: {
          totalPosts: 10,
          maturePosts: 4,
          measuredPosts: 3,
          missingMetricsPosts: 1,
          medianViews: 880,
          replyRate: 6.2,
          repostRate: 2.1,
        },
      },
      viralModeComparisons: [],
    }));

    expect(markup).toContain("5/15");
    expect(markup).toContain("링크 노출");
    expect(markup).toContain("420");
    expect(markup).toContain("무링크 대조군");
    expect(markup).toContain("880");
    expect(markup).toContain("0뷰 1개");
  });

  it("renders distinct empty and ready states", () => {
    const emptyMarkup = renderToStaticMarkup(React.createElement(CampaignExperimentReadiness, {
      readiness: {
        status: "empty",
        totalPosts: 0,
        immaturePosts: 0,
        maturePosts: 0,
        measuredMaturePosts: 0,
        missingMetricsPosts: 0,
        zeroViewMaturePosts: 0,
      },
      linkExposureComparison: null,
      viralModeComparisons: [],
    }));
    const readyMarkup = renderToStaticMarkup(React.createElement(CampaignExperimentReadiness, {
      readiness: {
        status: "ready",
        totalPosts: 15,
        immaturePosts: 0,
        maturePosts: 15,
        measuredMaturePosts: 15,
        missingMetricsPosts: 0,
        zeroViewMaturePosts: 0,
      },
      linkExposureComparison: null,
      viralModeComparisons: [],
    }));

    expect(emptyMarkup).toContain("실험 데이터 없음");
    expect(readyMarkup).toContain("비교 준비 완료");
  });
});
