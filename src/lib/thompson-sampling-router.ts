/**
 * Bayesian Thompson Sampling Multi-Arm Bandit (MAB) Router
 *
 * Replaces naive epsilon-greedy with Beta-Binomial Thompson Sampling
 * to handle high-variance social media metrics (impressions, replies, conversion clicks)
 * without getting trapped in local optima due to lucky/unlucky view streaks.
 *
 * Supports:
 * - Informative Bayesian Priors: Prevents cold-start noise collapse
 * - Blended Dual-Objective Reward: Viral Engagement Rate + Funnel Conversion Rate
 * - 4:4:2 Golden Quota Track Enforcement: Portfolio balance across A/B/C tracks
 * - Batch Updates & Sample Size Thresholds: Stabilizes noisy social feedback
 */

import { ContentTrack, determineNextTrack, QUOTA_TRACKS } from "./quota-bandit-router";
import { getDomainPreset } from "./domain-registry";

export interface BetaPrior {
  alpha: number; // Successes / positive signals
  beta: number;  // Failures / non-engaging impressions
}

export interface FormulaPerformanceObservation {
  formulaId: string;
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  linkClicks?: number;
  conversions?: number;
  paidConversions?: number;
}

export interface ThompsonSamplingState {
  formulaPriors: Record<string, BetaPrior>;
}

export interface ThompsonRouterOptions {
  domainProfile?: string;
  forceTrack?: ContentTrack;
  recentFormulaIds?: string[];
  customPriors?: Record<string, BetaPrior>;
  viralWeight?: number;     // Weight for engagement (default: 0.4)
  conversionWeight?: number; // Weight for click/conversion (default: 0.6)
  brandFormulas?: string[];
}

export interface ThompsonSelectionResult {
  track: ContentTrack;
  formulaId: string;
  sampledValue: number;
  scheduleTime: string;
  reason: string;
}

// Default Informative Priors for verified core formulas
// alpha / (alpha + beta) represents baseline success probability
export const DEFAULT_INFORMATIVE_PRIORS: Record<string, BetaPrior> = {
  // Top-of-Funnel Viral Reach (Track A)
  sal_hierarchy_ego: { alpha: 18, beta: 2 },            // 120k verified tier hierarchy (90% prior mean)
  concept_hierarchy: { alpha: 16, beta: 4 },            // 80% prior mean
  lotto_zero_friction: { alpha: 15, beta: 5 },          // 300k verified 3-choice dilemma (75% prior mean)
  career_mismatch: { alpha: 12, beta: 8 },              // 60% prior mean
  self_classification: { alpha: 12, beta: 8 },          // 60% prior mean
  imagination_dilemma: { alpha: 11, beta: 9 },          // 55% prior mean
  cost_loss_punch: { alpha: 10, beta: 10 },             // 50% prior mean

  // Mid-of-Funnel Authority & Fact Bombs (Track B)
  fact_bomb_incumbent_attack: { alpha: 15, beta: 5 },   // 30k verified data attack (75% prior mean)
  energy_reset_cycle: { alpha: 12, beta: 8 },           // 60% prior mean
  multi_engine_audit: { alpha: 11, beta: 9 },           // 55% prior mean
  talent_reality_check: { alpha: 12, beta: 8 },         // 60% prior mean
  wealth_vault_unlock: { alpha: 11, beta: 9 },          // 55% prior mean
  destiny_partner_sign: { alpha: 12, beta: 8 },         // 60% prior mean
  controversy_stunt: { alpha: 10, beta: 10 },
  warning: { alpha: 10, beta: 10 },
  contrarian: { alpha: 10, beta: 10 },
  reveal: { alpha: 10, beta: 10 },

  // Bottom-of-Funnel Conversion & Offer (Track C)
  consensus_matrix_offer: { alpha: 14, beta: 6 },       // High intent offer matrix (70% prior mean)
  save: { alpha: 12, beta: 8 },                         // Practical checklist (60% prior mean)
  saveable_tool: { alpha: 12, beta: 8 },
  pinned_anchor: { alpha: 11, beta: 9 },
  friend_share: { alpha: 10, beta: 10 },
};

/**
 * Standard Beta Distribution Sampling using Gamma variates
 * Generates sample from Beta(alpha, beta) using Marsaglia and Tsang method
 */
export function sampleBeta(alpha: number, beta: number): number {
  if (alpha <= 0 || beta <= 0) return 0.5;

  const sampleGamma = (shape: number): number => {
    if (shape < 1) {
      return sampleGamma(shape + 1) * Math.pow(Math.random(), 1 / shape);
    }
    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    while (true) {
      let v = 0;
      let x = 0;
      do {
        x = standardNormal();
        v = 1 + c * x;
      } while (v <= 0);
      v = v * v * v;
      const u = Math.random();
      if (u < 1 - 0.0331 * x * x * x * x) return d * v;
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
  };

  const gAlpha = sampleGamma(alpha);
  const gBeta = sampleGamma(beta);
  if (gAlpha + gBeta === 0) return 0.5;
  return gAlpha / (gAlpha + gBeta);
}

/**
 * Box-Muller transform for standard normal N(0, 1) sampling
 */
function standardNormal(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * Calculate Blended Observation Score from raw metrics
 * Engagement Rate = (replies * 3 + reposts * 2 + likes) / (views + 1)
 * Conversion Rate = (linkClicks + conversions * 10 + paidConversions * 50) / (views + 1)
 * Revenue-first: conversion outweighs engagement so the bandit optimizes money, not reach.
 */
export function calculateBlendedPerformance(
  obs: FormulaPerformanceObservation,
  viralWeight = 0.4,
  conversionWeight = 0.6
): { engagementRate: number; conversionRate: number; blendedScore: number } {
  const views = Math.max(1, obs.views);
  const weightedEngagements = obs.replies * 3.0 + obs.reposts * 2.0 + obs.likes * 1.0;
  const engagementRate = Math.min(1.0, weightedEngagements / (views * 0.15)); // Normalized to ~0-1 scale

  const clicks = (obs.linkClicks ?? 0) * 1.0 + (obs.conversions ?? 0) * 10.0 + (obs.paidConversions ?? 0) * 50.0;
  const conversionRate = Math.min(1.0, clicks / (views * 0.05)); // 5% click rate = 1.0

  const blendedScore = Math.min(1.0, Math.max(0.0, viralWeight * engagementRate + conversionWeight * conversionRate));

  return { engagementRate, conversionRate, blendedScore };
}

/**
 * Update Beta Priors with observed batch of posts (Bayesian Conjugate Update)
 */
export function updateThompsonPriors(
  currentPriors: Record<string, BetaPrior>,
  observations: FormulaPerformanceObservation[],
  options: {
    minViewsForUpdate?: number;
    decayFactor?: number; // Decay past evidence (0.9 ~ 0.98) to adapt to shifting trends
  } = {}
): Record<string, BetaPrior> {
  const minViews = options.minViewsForUpdate ?? 200; // Ignore tiny noisy samples (<200 views)
  const decay = options.decayFactor ?? 0.95;

  const updated: Record<string, BetaPrior> = {};

  // First apply decay to existing priors to prevent inertia
  for (const [formulaId, prior] of Object.entries(currentPriors)) {
    updated[formulaId] = {
      alpha: Math.max(2, prior.alpha * decay),
      beta: Math.max(2, prior.beta * decay),
    };
  }

  // Aggregate observations by formula
  const grouped: Record<string, FormulaPerformanceObservation[]> = {};
  for (const obs of observations) {
    if (obs.views < minViews) continue; // Filter out zero/insignificant traffic noise
    if (!grouped[obs.formulaId]) grouped[obs.formulaId] = [];
    grouped[obs.formulaId].push(obs);
  }

  // Perform conjugate update
  for (const [formulaId, obsList] of Object.entries(grouped)) {
    const existing = updated[formulaId] ?? DEFAULT_INFORMATIVE_PRIORS[formulaId] ?? { alpha: 5, beta: 5 };
    let successAddition = 0;
    let failureAddition = 0;

    for (const obs of obsList) {
      const { blendedScore } = calculateBlendedPerformance(obs);
      // Pseudo-count evidence update scaled by sample confidence (up to 5 pseudo-counts per qualified post)
      const evidenceScale = Math.min(5, Math.log10(obs.views));
      successAddition += blendedScore * evidenceScale;
      failureAddition += (1 - blendedScore) * evidenceScale;
    }

    updated[formulaId] = {
      alpha: existing.alpha + successAddition,
      beta: existing.beta + failureAddition,
    };
  }

  return updated;
}

/**
 * Draw one sample per arm from its Beta posterior and return the highest.
 */
export function sampleBestArm(
  armIds: string[],
  priors: Record<string, BetaPrior>
): { armId: string; sampledValue: number } {
  let armId = armIds[0];
  let sampledValue = -1;
  for (const id of armIds) {
    const prior = priors[id] ?? DEFAULT_INFORMATIVE_PRIORS[id] ?? { alpha: 5, beta: 5 };
    const sample = sampleBeta(prior.alpha, prior.beta);
    if (sample > sampledValue) {
      sampledValue = sample;
      armId = id;
    }
  }
  return { armId, sampledValue };
}

/**
 * Select the optimal formula using Bayesian Thompson Sampling within the 4:4:2 Golden Quota track
 */
export function selectFormulaWithThompsonSampling(
  batchIndex: number,
  options: ThompsonRouterOptions = {}
): ThompsonSelectionResult {
  const track = options.forceTrack ?? determineNextTrack(batchIndex);
  const trackConfig = QUOTA_TRACKS[track];
  const domainPreset = getDomainPreset(options.domainProfile);
  const domainTrackFormulas = domainPreset.trackFormulas[track].map((f) => f.id);

  const candidateFormulaIds = options.brandFormulas && options.brandFormulas.length > 0
    ? options.brandFormulas
    : domainTrackFormulas.length > 0
    ? domainTrackFormulas
    : trackConfig.defaultFormulas;

  const rawRecent = options.recentFormulaIds ?? [];
  const recentFormulas = new Set(rawRecent.slice(-2)); // Anti-monoculture cooldown
  const immediatelyPrevious = rawRecent[rawRecent.length - 1];

  // Candidates avoiding immediate duplicate repetition
  const eligibleCandidates = candidateFormulaIds.filter((id) => !recentFormulas.has(id));
  const candidatePool = eligibleCandidates.length > 0
    ? eligibleCandidates
    : (immediatelyPrevious && candidateFormulaIds.length > 1)
    ? candidateFormulaIds.filter((id) => id !== immediatelyPrevious)
    : candidateFormulaIds;

  const { armId: bestFormulaId, sampledValue: bestSampledValue } = sampleBestArm(
    candidatePool,
    options.customPriors ?? DEFAULT_INFORMATIVE_PRIORS
  );

  const roundedSample = Math.round(bestSampledValue * 100) / 100;
  const reason = `Thompson Sampling posterior score ${roundedSample} for ${domainPreset.name} (Track: ${trackConfig.name})`;

  return {
    track,
    formulaId: bestFormulaId,
    sampledValue: roundedSample,
    scheduleTime: trackConfig.scheduleTime,
    reason,
  };
}
