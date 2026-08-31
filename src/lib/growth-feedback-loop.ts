/**
 * Growth Feedback Loop & Adaptive Weight Engine
 *
 * 최근 게시된 포스트의 Threads 성과(조회수, 답글, 리포스트, 클릭/전환)를 분석하여
 * 상위 20% 및 하위 20% 공식(GenerationFormula)을 판별하고,
 * Brand의 formulaWeights(공식 가중치)를 점진적·적응형(Adaptive)으로 조정한다.
 */

export interface PostPerformanceRecord {
  id: string;
  formulaId: string | null;
  performanceScore: number | null;
  views: number | null;
  replies: number | null;
  reposts: number | null;
}

export interface WeightAdjustmentResult {
  updatedWeights: Record<string, number>;
  promotedFormulas: string[];
  demotedFormulas: string[];
  formulaScores: Record<string, { count: number; avgScore: number }>;
}

export interface GrowthFeedbackLoopOptions {
  minSamplesPerFormula?: number;
  promotionStep?: number;
  demotionStep?: number;
  minWeight?: number;
  maxWeight?: number;
}

const DEFAULT_OPTIONS: Required<GrowthFeedbackLoopOptions> = {
  minSamplesPerFormula: 2,
  promotionStep: 1,
  demotionStep: 1,
  minWeight: 1,
  maxWeight: 10,
};

/**
 * Calculates formula performance averages and updates formula weights.
 * - Formulas in the top 20% get weight incremented (capped at maxWeight)
 * - Formulas in the bottom 20% get weight decremented (floored at minWeight)
 */
export function computeAdaptiveFormulaWeights(
  currentWeights: Record<string, number>,
  posts: PostPerformanceRecord[],
  knownFormulaIds: string[],
  options: GrowthFeedbackLoopOptions = {}
): WeightAdjustmentResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const updatedWeights = { ...currentWeights };

  // Ensure all known formulas have a base weight (default: 3)
  for (const fId of knownFormulaIds) {
    if (updatedWeights[fId] === undefined) {
      updatedWeights[fId] = 3;
    }
  }

  // Group performance by formulaId
  const formulaStats: Record<string, { totalScore: number; count: number }> = {};
  for (const post of posts) {
    if (!post.formulaId || post.performanceScore === null || post.performanceScore === undefined) {
      continue;
    }
    if (!formulaStats[post.formulaId]) {
      formulaStats[post.formulaId] = { totalScore: 0, count: 0 };
    }
    formulaStats[post.formulaId].totalScore += post.performanceScore;
    formulaStats[post.formulaId].count += 1;
  }

  const formulaScores: Record<string, { count: number; avgScore: number }> = {};
  const qualifiedFormulas: Array<{ formulaId: string; avgScore: number; count: number }> = [];

  for (const [fId, stat] of Object.entries(formulaStats)) {
    const avgScore = stat.count > 0 ? Math.round(stat.totalScore / stat.count) : 0;
    formulaScores[fId] = { count: stat.count, avgScore };

    if (stat.count >= opts.minSamplesPerFormula) {
      qualifiedFormulas.push({ formulaId: fId, avgScore, count: stat.count });
    }
  }

  // Sort qualified formulas by avgScore descending
  qualifiedFormulas.sort((a, b) => b.avgScore - a.avgScore);

  const promotedFormulas: string[] = [];
  const demotedFormulas: string[] = [];

  if (qualifiedFormulas.length >= 2) {
    // 20% cutoff (at least 1 formula if qualified length >= 2)
    const cutoffCount = Math.max(1, Math.floor(qualifiedFormulas.length * 0.2));

    const topTier = qualifiedFormulas.slice(0, cutoffCount);
    const bottomTier = qualifiedFormulas.slice(-cutoffCount);

    for (const top of topTier) {
      promotedFormulas.push(top.formulaId);
      const current = updatedWeights[top.formulaId] ?? 3;
      updatedWeights[top.formulaId] = Math.min(opts.maxWeight, current + opts.promotionStep);
    }

    for (const bottom of bottomTier) {
      // Don't demote if it's somehow in both top and bottom (e.g. 1 formula overlap)
      if (promotedFormulas.includes(bottom.formulaId)) continue;
      demotedFormulas.push(bottom.formulaId);
      const current = updatedWeights[bottom.formulaId] ?? 3;
      updatedWeights[bottom.formulaId] = Math.max(opts.minWeight, current - opts.demotionStep);
    }
  }

  return {
    updatedWeights,
    promotedFormulas,
    demotedFormulas,
    formulaScores,
  };
}
