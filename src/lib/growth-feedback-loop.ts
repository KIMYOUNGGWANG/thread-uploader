/**
 * Growth Feedback Loop & Adaptive Weight Engine
 *
 * 최근 게시된 포스트의 Threads 성과(조회수, 답글, 리포스트, 클릭/전환)를 분석하여
 * 상위 20% 및 하위 20% 공식(GenerationFormula)을 판별하고,
 * Brand의 formulaWeights(공식 가중치)를 점진적·적응형(Adaptive)으로 조정한다.
 * 조회수는 롱테일이라 대박 글 하나가 평균을 끌어올리므로, 순위는 중앙값으로 매긴다.
 */

import { median, MIN_PATTERN_POSTS } from "@/lib/growth-learning";

export interface PostPerformanceRecord {
  id: string;
  formulaId: string | null;
  topic?: string | null;
  targetAudience?: string | null;
  situation?: string | null;
  performanceScore: number | null;
  views: number | null;
  replies: number | null;
  reposts: number | null;
}

export interface WeightAdjustmentResult {
  updatedWeights: Record<string, number>;
  promotedFormulas: string[];
  demotedFormulas: string[];
  formulaScores: Record<string, { count: number; avgScore: number; medianScore: number }>;
}

export interface GrowthFeedbackLoopOptions {
  minSamplesPerFormula?: number;
  promotionStep?: number;
  demotionStep?: number;
  minWeight?: number;
  maxWeight?: number;
}

const DEFAULT_OPTIONS: Required<GrowthFeedbackLoopOptions> = {
  minSamplesPerFormula: MIN_PATTERN_POSTS,
  promotionStep: 1,
  demotionStep: 1,
  minWeight: 1,
  maxWeight: 10,
};

/**
 * Ranks formulas by median performance and updates formula weights.
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
  const formulaStats: Record<string, number[]> = {};
  for (const post of posts) {
    if (!post.formulaId || post.performanceScore === null || post.performanceScore === undefined) {
      continue;
    }
    (formulaStats[post.formulaId] ??= []).push(post.performanceScore);
  }

  const formulaScores: WeightAdjustmentResult["formulaScores"] = {};
  const qualifiedFormulas: Array<{ formulaId: string; medianScore: number; count: number }> = [];

  for (const [fId, scores] of Object.entries(formulaStats)) {
    const avgScore = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
    const medianScore = median(scores);
    formulaScores[fId] = { count: scores.length, avgScore, medianScore };

    if (scores.length >= opts.minSamplesPerFormula) {
      qualifiedFormulas.push({ formulaId: fId, medianScore, count: scores.length });
    }
  }

  qualifiedFormulas.sort((a, b) => b.medianScore - a.medianScore);

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

export interface ContextWeightAdjustmentResult {
  personaWeights: Record<string, number>;
  frictionWeights: Record<string, number>;
  promotedPersonas: string[];
  demotedPersonas: string[];
  promotedFrictions: string[];
  demotedFrictions: string[];
}

/**
 * Computes factorized marginal weights for personas and frictions.
 * Decomposes 3D context into 1D marginal distributions to avoid sparse data overfitting.
 */
export function computeAdaptiveContextWeights(
  currentPersonaWeights: Record<string, number> = {},
  currentFrictionWeights: Record<string, number> = {},
  posts: PostPerformanceRecord[],
  knownPersonas: string[],
  knownFrictions: string[],
  options: GrowthFeedbackLoopOptions = {}
): ContextWeightAdjustmentResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const updatedPersonaWeights = { ...currentPersonaWeights };
  const updatedFrictionWeights = { ...currentFrictionWeights };

  for (const p of knownPersonas) {
    if (updatedPersonaWeights[p] === undefined) updatedPersonaWeights[p] = 3;
  }
  for (const f of knownFrictions) {
    if (updatedFrictionWeights[f] === undefined) updatedFrictionWeights[f] = 3;
  }

  const personaStats: Record<string, number[]> = {};
  const frictionStats: Record<string, number[]> = {};

  for (const post of posts) {
    if (post.performanceScore === null || post.performanceScore === undefined) continue;
    const postAudience = post.targetAudience ?? "";
    const postSituation = post.situation ?? "";
    const postTopic = post.topic ?? "";

    for (const p of knownPersonas) {
      if (postAudience.includes(p) || postTopic.includes(p)) {
        (personaStats[p] ??= []).push(post.performanceScore);
      }
    }

    for (const f of knownFrictions) {
      if (postSituation.includes(f) || postTopic.includes(f)) {
        (frictionStats[f] ??= []).push(post.performanceScore);
      }
    }
  }

  // Adjust persona weights
  const qualifiedPersonas = rankQualifiedByMedian(personaStats, opts.minSamplesPerFormula);

  const promotedPersonas: string[] = [];
  const demotedPersonas: string[] = [];
  if (qualifiedPersonas.length >= 2) {
    const cutoff = Math.max(1, Math.floor(qualifiedPersonas.length * 0.2));
    const topTier = qualifiedPersonas.slice(0, cutoff);
    const bottomTier = qualifiedPersonas.slice(-cutoff);

    for (const top of topTier) {
      promotedPersonas.push(top.key);
      const current = updatedPersonaWeights[top.key] ?? 3;
      updatedPersonaWeights[top.key] = Math.min(opts.maxWeight, current + opts.promotionStep);
    }
    for (const bottom of bottomTier) {
      if (promotedPersonas.includes(bottom.key)) continue;
      demotedPersonas.push(bottom.key);
      const current = updatedPersonaWeights[bottom.key] ?? 3;
      updatedPersonaWeights[bottom.key] = Math.max(opts.minWeight, current - opts.demotionStep);
    }
  }

  // Adjust friction weights
  const qualifiedFrictions = rankQualifiedByMedian(frictionStats, opts.minSamplesPerFormula);

  const promotedFrictions: string[] = [];
  const demotedFrictions: string[] = [];
  if (qualifiedFrictions.length >= 2) {
    const cutoff = Math.max(1, Math.floor(qualifiedFrictions.length * 0.2));
    const topTier = qualifiedFrictions.slice(0, cutoff);
    const bottomTier = qualifiedFrictions.slice(-cutoff);

    for (const top of topTier) {
      promotedFrictions.push(top.key);
      const current = updatedFrictionWeights[top.key] ?? 3;
      updatedFrictionWeights[top.key] = Math.min(opts.maxWeight, current + opts.promotionStep);
    }
    for (const bottom of bottomTier) {
      if (promotedFrictions.includes(bottom.key)) continue;
      demotedFrictions.push(bottom.key);
      const current = updatedFrictionWeights[bottom.key] ?? 3;
      updatedFrictionWeights[bottom.key] = Math.max(opts.minWeight, current - opts.demotionStep);
    }
  }

  return {
    personaWeights: updatedPersonaWeights,
    frictionWeights: updatedFrictionWeights,
    promotedPersonas,
    demotedPersonas,
    promotedFrictions,
    demotedFrictions,
  };
}

function rankQualifiedByMedian(scoresByKey: Record<string, number[]>, minSamples: number) {
  return Object.entries(scoresByKey)
    .filter(([, scores]) => scores.length >= minSamples)
    .map(([key, scores]) => ({ key, medianScore: median(scores), count: scores.length }))
    .sort((a, b) => b.medianScore - a.medianScore);
}
