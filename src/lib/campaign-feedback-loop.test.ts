import { describe, it, expect } from "vitest";
import {
  evaluate72hFeedbackLoop,
  calculateMABWeights,
  harvestTopPerformers,
  type MaturePostMetric,
} from "./campaign-feedback-loop";

const HOUR = 60 * 60 * 1000;
const NOW = new Date("2026-10-06T12:00:00Z");

function mockPost(id: string, formulaId: string, hoursAgo: number, views: number, replies: number = 0): MaturePostMetric {
  return {
    id,
    content: `Post ${id} content: hook here\nDetail\n1. Choice A\n2. Choice B\n3. Choice C`,
    campaignFormulaId: formulaId,
    publishedAt: new Date(NOW.getTime() - hoursAgo * HOUR),
    metricsAt: new Date(NOW.getTime() - (hoursAgo - 2) * HOUR),
    views,
    replies,
    reposts: 0,
    conversions: 0,
  };
}

describe("campaign-feedback-loop", () => {
  it("filters only mature posts (>= 72 hours old) with measured metrics", () => {
    const posts: MaturePostMetric[] = [
      mockPost("p1", "imagination_dilemma", 80, 1500, 10), // mature
      mockPost("p2", "concept_hierarchy", 75, 800, 5),   // mature
      mockPost("p3", "identity_profile", 24, 2000, 20),   // immature (< 72h)
      mockPost("p4", "relationship_tension", 90, null as any, 0), // unmeasured
    ];

    const report = evaluate72hFeedbackLoop(posts, { now: NOW, brandId: "b1" });
    expect(report.maturePostCount).toBe(2);
    expect(report.modePerformance["imagination_dilemma"]).toBeDefined();
    expect(report.modePerformance["concept_hierarchy"]).toBeDefined();
  });

  it("calculates MAB / Thompson sampling recommended weights favoring higher median engagement", () => {
    const modeStats = {
      imagination_dilemma: { sampleCount: 5, medianScore: 2000 },
      concept_hierarchy: { sampleCount: 5, medianScore: 500 },
      identity_profile: { sampleCount: 5, medianScore: 1000 },
      relationship_tension: { sampleCount: 5, medianScore: 300 },
    };

    const weights = calculateMABWeights(modeStats);
    // Highest performing mode gets higher weight
    expect(weights["imagination_dilemma"]).toBeGreaterThan(weights["concept_hierarchy"]);
    expect(weights["imagination_dilemma"]).toBeGreaterThan(weights["relationship_tension"]);
    // Exploration floor is preserved (no mode drops to 0)
    expect(weights["relationship_tension"]).toBeGreaterThanOrEqual(1);
  });

  it("harvests top 10% high-performing posts as few-shot hook examples", () => {
    const posts: MaturePostMetric[] = Array.from({ length: 20 }, (_, i) =>
      mockPost(`p${i}`, "identity_profile", 80, (i + 1) * 100, i)
    );

    // Top 10% of 20 is 2 posts
    const topPerformers = harvestTopPerformers(posts, 0.1);
    expect(topPerformers.length).toBe(2);
    // Highest views first
    expect(topPerformers[0].id).toBe("p19");
    expect(topPerformers[1].id).toBe("p18");
    expect(topPerformers[0].hook).toContain("Post p19");
  });
});
