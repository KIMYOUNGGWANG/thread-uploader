import type { BrandConfig, OptimizationGoal } from "@/types/brand";
import { calculatePerformanceScore } from "@/lib/growth-learning";
import { calculateBlendedPerformance, type FormulaPerformanceObservation } from "@/lib/thompson-sampling-router";

export type { OptimizationGoal } from "@/types/brand";

// What the learning loop optimizes for. Display scores (performanceScore/tier) stay revenue-based;
// this only decides which formulas get promoted, auto-queued and sampled next.
export const DEFAULT_OPTIMIZATION_GOAL: OptimizationGoal = "reach";

// Reach reward is relative to the brand's own median: a median post is a coin flip, double the median is a full win.
// Absolute targets (e.g. 10k views) would make every arm look like a failure on a small account.
const REACH_FULL_REWARD_MULTIPLE = 2;

interface LearningMetrics {
  views: number | null;
  likes?: number | null;
  replies: number | null;
  reposts: number | null;
  clicks?: number | null;
  conversions?: number | null;
  manualPaidConversions?: number | null;
}

export function resolveOptimizationGoal(config: Pick<BrandConfig, "optimizationGoal">): OptimizationGoal {
  return config.optimizationGoal ?? DEFAULT_OPTIMIZATION_GOAL;
}

/** Score used to rank posts/formulas inside the learning loop. */
export function calculateLearningScore(goal: OptimizationGoal, metrics: LearningMetrics): number {
  if (goal === "reach") return metrics.views ?? 0;
  return calculatePerformanceScore({ ...metrics, likes: metrics.likes ?? null });
}

/** 0..1 success reward for the Thompson prior update. */
export function calculateGoalReward(
  goal: OptimizationGoal,
  observation: FormulaPerformanceObservation,
  context: { medianViews: number }
): number {
  if (goal === "reach") {
    const fullRewardViews = Math.max(1, context.medianViews) * REACH_FULL_REWARD_MULTIPLE;
    return Math.min(1, Math.max(0, observation.views / fullRewardViews));
  }
  return calculateBlendedPerformance(observation).blendedScore;
}

export function medianViews(values: Array<number | null | undefined>): number {
  const sorted = values.filter((value): value is number => typeof value === "number" && value > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}
