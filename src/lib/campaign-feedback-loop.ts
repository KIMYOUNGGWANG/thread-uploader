import {
  identifyBottomPerformingPosts,
  extractNegativeCliches,
} from "./trend-radar/negative-pattern-learner";

export interface MaturePostMetric {
  id: string;
  content: string;
  campaignFormulaId: string | null;
  publishedAt: Date | null;
  metricsAt: Date | null;
  views: number | null;
  replies: number | null;
  reposts: number | null;
  conversions: number | null;
}

export interface ModePerformance {
  sampleCount: number;
  medianViews: number;
  medianScore: number;
  avgReplyRate: number;
}

export interface FeedbackOptimizationReport {
  brandId: string;
  evaluatedAt: string;
  maturePostCount: number;
  modePerformance: Record<string, ModePerformance>;
  recommendedWeights: Record<string, number>;
  topPerformers: Array<{
    id: string;
    hook: string;
    formulaId: string | null;
    score: number;
    views: number;
  }>;
  negativeClichesLearned: string[];
}

const MATURITY_MS = 72 * 60 * 60 * 1000;

function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function calculateEngagementScore(post: MaturePostMetric): number {
  const views = post.views || 0;
  const replies = post.replies || 0;
  const reposts = post.reposts || 0;
  const conversions = post.conversions || 0;
  return views + replies * 5 + reposts * 10 + conversions * 25;
}

export function harvestTopPerformers(
  posts: MaturePostMetric[],
  topFraction: number = 0.1
): Array<{ id: string; hook: string; formulaId: string | null; score: number; views: number }> {
  if (posts.length === 0) return [];

  const scored = posts.map((post) => {
    const firstLine = post.content.split("\n").find((l) => l.trim().length > 0) || "";
    return {
      id: post.id,
      hook: firstLine.trim(),
      formulaId: post.campaignFormulaId,
      score: calculateEngagementScore(post),
      views: post.views || 0,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  const targetCount = Math.max(1, Math.ceil(posts.length * topFraction));
  return scored.slice(0, targetCount);
}

export function calculateMABWeights(
  modeStats: Record<string, { sampleCount: number; medianScore: number }>,
  totalBudget: number = 20
): Record<string, number> {
  const modes = Object.keys(modeStats);
  if (modes.length === 0) return {};

  const minFloor = 1;
  const remainingBudget = Math.max(0, totalBudget - modes.length * minFloor);

  const totalScore = modes.reduce((acc, m) => acc + Math.max(0, modeStats[m].medianScore), 0);

  const weights: Record<string, number> = {};

  for (const m of modes) {
    if (totalScore === 0) {
      weights[m] = Math.round(totalBudget / modes.length);
    } else {
      const share = modeStats[m].medianScore / totalScore;
      weights[m] = minFloor + Math.round(share * remainingBudget);
    }
  }

  return weights;
}

export function evaluate72hFeedbackLoop(
  posts: MaturePostMetric[],
  options: { now?: Date; brandId?: string } = {}
): FeedbackOptimizationReport {
  const now = options.now || new Date();
  const brandId = options.brandId || "unknown";

  // Filter mature posts
  const matureMeasuredPosts = posts.filter((p) => {
    if (!p.publishedAt || typeof p.views !== "number") return false;
    const ageMs = now.getTime() - p.publishedAt.getTime();
    return ageMs >= MATURITY_MS;
  });

  // Group by mode
  const modeGroups: Record<string, MaturePostMetric[]> = {};
  for (const post of matureMeasuredPosts) {
    const mode = post.campaignFormulaId || "unassigned";
    if (!modeGroups[mode]) modeGroups[mode] = [];
    modeGroups[mode].push(post);
  }

  const modePerformance: Record<string, ModePerformance> = {};
  const modeStatsForMAB: Record<string, { sampleCount: number; medianScore: number }> = {};

  for (const [mode, group] of Object.entries(modeGroups)) {
    const viewsList = group.map((p) => p.views || 0);
    const scoreList = group.map((p) => calculateEngagementScore(p));
    const medianViews = computeMedian(viewsList);
    const medianScore = computeMedian(scoreList);

    const totalViews = viewsList.reduce((a, b) => a + b, 0);
    const totalReplies = group.reduce((a, b) => a + (b.replies || 0), 0);
    const avgReplyRate = totalViews > 0 ? totalReplies / totalViews : 0;

    modePerformance[mode] = {
      sampleCount: group.length,
      medianViews,
      medianScore,
      avgReplyRate,
    };

    modeStatsForMAB[mode] = {
      sampleCount: group.length,
      medianScore,
    };
  }

  const recommendedWeights = calculateMABWeights(modeStatsForMAB);
  const topPerformers = harvestTopPerformers(matureMeasuredPosts, 0.1);

  const bottomPosts = identifyBottomPerformingPosts(
    matureMeasuredPosts.map((p) => ({
      id: p.id,
      content: p.content,
      views: p.views || 0,
      replies: p.replies || 0,
      reposts: p.reposts || 0,
    })),
    0.1
  );
  const negativeClichesLearned = extractNegativeCliches(bottomPosts);

  return {
    brandId,
    evaluatedAt: now.toISOString(),
    maturePostCount: matureMeasuredPosts.length,
    modePerformance,
    recommendedWeights,
    topPerformers,
    negativeClichesLearned,
  };
}
