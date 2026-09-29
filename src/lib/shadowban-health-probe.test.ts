import { describe, expect, it } from "vitest";
import {
  evaluateShadowbanHealth,
  getSelfHealingAction,
  type PostReachRecord,
} from "./shadowban-health-probe";

describe("shadowban-health-probe", () => {
  it("detects healthy reach when numbers fluctuate normally", () => {
    const history: PostReachRecord[] = [
      { postId: "1", views: 500, likes: 25, replies: 10, publishedAt: new Date("2026-09-09T10:00:00Z") },
      { postId: "2", views: 450, likes: 20, replies: 8, publishedAt: new Date("2026-09-08T10:00:00Z") },
      { postId: "3", views: 520, likes: 30, replies: 12, publishedAt: new Date("2026-09-07T10:00:00Z") },
      { postId: "4", views: 480, likes: 22, replies: 9, publishedAt: new Date("2026-09-06T10:00:00Z") },
      { postId: "5", views: 510, likes: 26, replies: 11, publishedAt: new Date("2026-09-05T10:00:00Z") },
    ];

    const report = evaluateShadowbanHealth(history, { minBaselineViews: 100 });
    expect(report.status).toBe("HEALTHY");
    expect(report.dropPercentage).toBeLessThan(20);

    const action = getSelfHealingAction(report);
    expect(action.mode).toBe("NORMAL");
    expect(action.freezePolarizingFormulas).toBe(false);
  });

  it("detects stealth shadowban when views crater by >85% across consecutive posts", () => {
    const history: PostReachRecord[] = [
      // Recent 3 posts: severely depressed (views < 40)
      { postId: "1", views: 15, likes: 0, replies: 0, publishedAt: new Date("2026-09-09T10:00:00Z") },
      { postId: "2", views: 20, likes: 1, replies: 0, publishedAt: new Date("2026-09-08T10:00:00Z") },
      { postId: "3", views: 18, likes: 0, replies: 0, publishedAt: new Date("2026-09-07T10:00:00Z") },
      // Baseline posts: average ~500 views
      { postId: "4", views: 500, likes: 30, replies: 12, publishedAt: new Date("2026-09-06T10:00:00Z") },
      { postId: "5", views: 480, likes: 25, replies: 9, publishedAt: new Date("2026-09-05T10:00:00Z") },
      { postId: "6", views: 520, likes: 35, replies: 15, publishedAt: new Date("2026-09-04T10:00:00Z") },
    ];

    const report = evaluateShadowbanHealth(history, { minBaselineViews: 100 });
    expect(report.status).toBe("SHADOWBAN_SUSPECTED");
    expect(report.dropPercentage).toBeGreaterThanOrEqual(85);
    expect(report.consecutiveDepressedCount).toBe(3);

    const action = getSelfHealingAction(report);
    expect(action.mode).toBe("WARMUP_ONLY");
    expect(action.freezePolarizingFormulas).toBe(true);
    expect(action.maxDailyPosts).toBe(1);
    expect(action.actionMessage).toContain("스텔스 섀도우밴 감지");
  });

  it("triggers warning when views drop moderately", () => {
    const history: PostReachRecord[] = [
      // Recent 3 posts: ~200 views (60% drop from 500)
      { postId: "1", views: 200, likes: 10, replies: 3, publishedAt: new Date("2026-09-09T10:00:00Z") },
      { postId: "2", views: 210, likes: 12, replies: 4, publishedAt: new Date("2026-09-08T10:00:00Z") },
      { postId: "3", views: 190, likes: 8, replies: 2, publishedAt: new Date("2026-09-07T10:00:00Z") },
      // Baseline posts
      { postId: "4", views: 500, likes: 30, replies: 12, publishedAt: new Date("2026-09-06T10:00:00Z") },
      { postId: "5", views: 510, likes: 28, replies: 11, publishedAt: new Date("2026-09-05T10:00:00Z") },
    ];

    const report = evaluateShadowbanHealth(history, { minBaselineViews: 100 });
    expect(report.status).toBe("WARNING");

    const action = getSelfHealingAction(report);
    expect(action.mode).toBe("MONITOR");
    expect(action.freezePolarizingFormulas).toBe(false);
  });

  it("filters out immature posts (< 6 hours old) to prevent API lag false positives", () => {
    const now = new Date("2026-09-09T12:00:00Z");
    const history: PostReachRecord[] = [
      // Published 1 hour ago with 0 views (API lag) - should be ignored!
      { postId: "fresh", views: 0, likes: 0, replies: 0, publishedAt: new Date("2026-09-09T11:00:00Z") },
      // 5 mature posts with healthy views
      { postId: "1", views: 480, likes: 20, replies: 8, publishedAt: new Date("2026-09-09T05:00:00Z") }, // 7h ago
      { postId: "2", views: 520, likes: 25, replies: 10, publishedAt: new Date("2026-09-08T10:00:00Z") },
      { postId: "3", views: 500, likes: 22, replies: 9, publishedAt: new Date("2026-09-07T10:00:00Z") },
      { postId: "4", views: 490, likes: 24, replies: 11, publishedAt: new Date("2026-09-06T10:00:00Z") },
      { postId: "5", views: 510, likes: 28, replies: 12, publishedAt: new Date("2026-09-05T10:00:00Z") },
    ];

    const report = evaluateShadowbanHealth(history, {
      referenceTime: now,
      minHoursSincePublished: 6,
      minBaselineViews: 100,
    });

    expect(report.status).toBe("HEALTHY");
    expect(report.analyzedPostCount).toBe(5); // fresh post was excluded
  });

  it("activates cold-start protection when mature post count is under 5", () => {
    const now = new Date("2026-09-09T12:00:00Z");
    const history: PostReachRecord[] = [
      { postId: "1", views: 10, likes: 0, replies: 0, publishedAt: new Date("2026-09-08T10:00:00Z") },
      { postId: "2", views: 15, likes: 0, replies: 0, publishedAt: new Date("2026-09-07T10:00:00Z") },
    ];

    const report = evaluateShadowbanHealth(history, {
      referenceTime: now,
      minHoursSincePublished: 6,
      minTotalPostsForColdStart: 5,
    });

    expect(report.status).toBe("HEALTHY");
    expect(report.reasons[0]).toContain("콜드 스타트 보호 모드");
  });
});
