import { describe, expect, it } from "vitest";
import {
  buildViralModeBuckets,
  resolveSummaryViralIntentModeId,
} from "@/app/api/campaigns/summary/route";

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
});
