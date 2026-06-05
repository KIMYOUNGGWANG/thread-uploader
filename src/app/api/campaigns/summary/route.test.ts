import { describe, expect, it } from "vitest";
import {
  buildCampaignNextAction,
  sumMetricValue,
} from "@/app/api/campaigns/summary/route";

describe("campaign summary metric helpers", () => {
  it("maps configured metric names to existing post fields", () => {
    const posts = [
      { views: 10, replies: 2, reposts: 1, clicks: 3, conversions: 1, manualPaidConversions: 0, qualityPass: true },
      { views: 20, replies: 1, reposts: 0, clicks: 4, conversions: 0, manualPaidConversions: 2, qualityPass: false },
    ];

    expect(sumMetricValue(posts, "views")).toBe(30);
    expect(sumMetricValue(posts, "replies")).toBe(3);
    expect(sumMetricValue(posts, "clicks")).toBe(7);
    expect(sumMetricValue(posts, "conversions")).toBe(1);
    expect(sumMetricValue(posts, "manualPaidConversions")).toBe(2);
  });

  it("returns a learning next action when no posts exist", () => {
    const nextAction = buildCampaignNextAction([], "views", "conversions");

    expect(nextAction).toContain("첫 배치");
  });
});
