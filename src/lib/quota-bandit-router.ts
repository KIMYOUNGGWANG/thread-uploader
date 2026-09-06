/**
 * 4:4:2 Golden Quota & Multi-Arm Bandit (MAB) Formula Router
 *
 * Enforces portfolio balance:
 * - Track A (40%): Top of funnel / Reach & Dopamine
 * - Track B (40%): Mid of funnel / Authority & Fact Bombs
 * - Track C (20%): Bottom of funnel / Direct Offer & VIP Dossier
 *
 * Injects epsilon-Greedy exploration (20% novelty test) + anti-monoculture cooldown.
 */

export type ContentTrack = "track_a" | "track_b" | "track_c";

export interface QuotaTrackConfig {
  track: ContentTrack;
  name: string;
  targetRatio: number; // e.g. 0.4, 0.4, 0.2
  defaultFormulas: string[];
  scheduleTime: string; // e.g. "08:30", "12:30", "22:30"
}

export const QUOTA_TRACKS: Record<ContentTrack, QuotaTrackConfig> = {
  track_a: {
    track: "track_a",
    name: "Track A: Top-of-Funnel Viral Reach",
    targetRatio: 0.4,
    defaultFormulas: ["lotto_zero_friction", "sal_hierarchy_ego", "self_classification"],
    scheduleTime: "08:30",
  },
  track_b: {
    track: "track_b",
    name: "Track B: Mid-of-Funnel Authority & Facts",
    targetRatio: 0.4,
    defaultFormulas: ["fact_bomb_incumbent_attack", "controversy_stunt", "reveal", "warning", "contrarian"],
    scheduleTime: "12:30",
  },
  track_c: {
    track: "track_c",
    name: "Track C: Bottom-of-Funnel Conversion & Offer",
    targetRatio: 0.2,
    defaultFormulas: ["consensus_matrix_offer", "save", "pinned_anchor"],
    scheduleTime: "22:30",
  },
};

import { getDomainPreset } from "./domain-registry";

export interface RouterOptions {
  epsilon?: number; // Exploration probability (default 0.2)
  recentFormulaIds?: string[]; // Last N posts to prevent repetition
  forceTrack?: ContentTrack;
  customWeights?: Record<string, number>;
  explorationPool?: string[];
  domainProfile?: string;
  brandFormulas?: string[];
}

export interface QuotaSelectionResult {
  track: ContentTrack;
  formulaId: string;
  isExploration: boolean;
  scheduleTime: string;
  reason: string;
}

/**
 * Determine which track is next based on current batch index or distribution.
 * Sequence pattern for 10 posts: A, B, A, B, C, A, B, A, B, C (4:4:2 ratio).
 */
export function determineNextTrack(batchIndex: number): ContentTrack {
  const normalizedIndex = batchIndex % 10;
  if (normalizedIndex === 4 || normalizedIndex === 9) return "track_c"; // 20%
  if (normalizedIndex % 2 === 0) return "track_a"; // 40%
  return "track_b"; // 40%
}

export const MAX_SINGLE_FORMULA_WEIGHT_RATIO = 0.35;

/**
 * Normalizes and clamps weights so no single formula exceeds maxRatio of the pool.
 */
export function applyHardWeightCap(
  formulas: string[],
  weights: Record<string, number>,
  maxRatio = MAX_SINGLE_FORMULA_WEIGHT_RATIO
): Record<string, number> {
  if (formulas.length <= 1) return { ...weights };
  const rawWeights: Record<string, number> = {};
  for (const f of formulas) {
    rawWeights[f] = Math.max(1, weights[f] ?? 1);
  }
  const total = Object.values(rawWeights).reduce((a, b) => a + b, 0);
  const maxAllowed = Math.max(1, total * maxRatio);

  const capped: Record<string, number> = {};
  for (const f of formulas) {
    capped[f] = Math.min(rawWeights[f], maxAllowed);
  }
  return capped;
}

/**
 * Select the optimal formula for a post with 4:4:2 Quota and MAB exploration
 */
export function selectFormulaWithQuota(
  batchIndex: number,
  options: RouterOptions = {}
): QuotaSelectionResult {
  const epsilon = options.epsilon ?? 0.2;
  const rawRecent = options.recentFormulaIds ?? [];
  // Use last 2-3 formulas for cooldown window
  const recentFormulas = new Set(rawRecent.slice(-3));
  const immediatelyPrevious = rawRecent[rawRecent.length - 1];

  const track = options.forceTrack ?? determineNextTrack(batchIndex);
  const trackConfig = QUOTA_TRACKS[track];
  const domainPreset = getDomainPreset(options.domainProfile);
  const domainTrackFormulas = domainPreset.trackFormulas[track].map((f) => f.id);

  const defaultFormulas = options.brandFormulas && options.brandFormulas.length > 0
    ? options.brandFormulas
    : domainTrackFormulas.length > 0
    ? domainTrackFormulas
    : trackConfig.defaultFormulas;

  const isExploration = Math.random() < epsilon;
  let formulaId: string;
  let reason: string;

  if (isExploration && options.explorationPool && options.explorationPool.length > 0) {
    // 20% MAB Exploration: Pick an untested pattern from exploration pool
    const candidates = options.explorationPool.filter((id) => !recentFormulas.has(id));
    formulaId = candidates.length > 0
      ? candidates[Math.floor(Math.random() * candidates.length)]
      : options.explorationPool[Math.floor(Math.random() * options.explorationPool.length)];
    reason = `MAB Exploration (ε=${epsilon}) for ${domainPreset.name}: Selected novelty pattern (${formulaId})`;
  } else {
    // 80% Exploitation: Pick top-weighted formula with 30% hard cap & anti-monoculture
    const rawWeights = options.customWeights ?? {};
    const cappedWeights = applyHardWeightCap(defaultFormulas, rawWeights);

    // Filter out recently used formulas
    const availableFormulas = defaultFormulas.filter(
      (id) => !recentFormulas.has(id)
    );

    // If all formulas are in recent window, at minimum exclude the immediately previous one
    const candidates = availableFormulas.length > 0
      ? availableFormulas
      : (immediatelyPrevious && defaultFormulas.length > 1)
      ? defaultFormulas.filter((id) => id !== immediatelyPrevious)
      : defaultFormulas;

    // Sort by capped adaptive weight descending
    const sorted = [...candidates].sort((a, b) => (cappedWeights[b] ?? 1) - (cappedWeights[a] ?? 1));
    formulaId = sorted[0] ?? defaultFormulas[0];
    reason = `80% Exploitation for ${domainPreset.name}: Selected top-performing formula (${formulaId}) for ${trackConfig.name} with anti-monoculture cap`;
  }

  return {
    track,
    formulaId,
    isExploration,
    scheduleTime: trackConfig.scheduleTime,
    reason,
  };
}
