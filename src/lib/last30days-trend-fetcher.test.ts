import { describe, expect, it } from "vitest";
import { fetchLast30DaysTrends, formatTrendSummaryForPrompt } from "./last30days-trend-fetcher";

describe("last30daysfire Trend Fetcher", () => {
  it("fetches last 30 days trends based on keywords", async () => {
    const trends = await fetchLast30DaysTrends(["SaaS", "AI"], 4);
    expect(trends).toHaveLength(4);
    expect(trends[0].platform).toBe("reddit");
    expect(trends[0].engagementScore).toBeGreaterThan(50);
  });

  it("formats trend summary for AI prompts", async () => {
    const trends = await fetchLast30DaysTrends(["Threads"], 2);
    const summary = formatTrendSummaryForPrompt(trends);

    expect(summary).toContain("[최근 30일 외부 트렌드 인사이트 (last30daysfire)]");
    expect(summary).toContain("[REDDIT]");
    expect(summary).toContain("[HACKERNEWS]");
  });
});
