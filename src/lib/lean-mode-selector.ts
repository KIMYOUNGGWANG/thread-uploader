import { NEUTRAL_PRIOR, sampleBestArm, type BetaPrior } from "@/lib/thompson-sampling-router";
import {
  resolveViralIntentMode,
  SAJU_HIT_MODES,
  selectViralIntentMode,
  type ViralIntentMode,
  type ViralIntentModeId,
  WINNER_REPLAY_MODE,
} from "@/lib/viral-intent-modes";

export interface GenerationFormula {
  id: string;
  name: string;
  weight: number;
  instruction: string;
}

export function selectCampaignFormulaForViralMode(
  formulas: GenerationFormula[],
  viralIntentMode: ViralIntentMode
): GenerationFormula {
  const matchingFormula = formulas.find((formula) => (
    resolveViralIntentMode(formula.id, 0).id === viralIntentMode.id
  ));
  if (matchingFormula) return matchingFormula;

  return {
    id: viralIntentMode.id,
    name: viralIntentMode.label,
    weight: 1,
    instruction: viralIntentMode.instruction,
  };
}

// The lean allocation is tuned on Korean saju posts, so it follows the domain profile, not the brand name or
// batch size: a 15-post run on another product used to get the saju modes.
export function isLeanSprintRun(domainProfile: string | undefined): boolean {
  return domainProfile === "saju_viral";
}

const LEAN_ARM_IDS: readonly ViralIntentModeId[] = [
  "imagination_dilemma",
  "concept_hierarchy",
  "identity_profile",
  "relationship_tension",
  "beginner_qa",
  // 2026-10-30: the breakouts (시주 42k, 복채 9.4k, 진술축미 5.5k) came from shapes the five arms above
  // could not produce, so recent drafts converged on situation-advice posts. New arms start at the neutral prior.
  ...SAJU_HIT_MODES.map((mode) => mode.id),
];

// 2026-10-31: at the neutral prior the hit arms won ~44% of lean picks against the learned arms (~0.68 mean),
// so the queue still leaned on situation-advice posts that sat at 40-60 views. The learn cron rebuilds every
// arm from NEUTRAL_PRIOR, so the hit arms start from this prior instead and their own posts add on top (~2/3 of picks
// before evidence). ponytail: fixed head start, drop it once each hit arm has its own posts in the learn window.
const SAJU_HIT_SEED_PRIOR: BetaPrior = { alpha: 6, beta: 3 };
const SAJU_HIT_IDS = new Set<string>(SAJU_HIT_MODES.map((mode) => mode.id));

function seedHitArm(prior: BetaPrior | undefined): BetaPrior {
  if (!prior) return SAJU_HIT_SEED_PRIOR;
  return {
    alpha: prior.alpha + SAJU_HIT_SEED_PRIOR.alpha - NEUTRAL_PRIOR.alpha,
    beta: prior.beta + SAJU_HIT_SEED_PRIOR.beta - NEUTRAL_PRIOR.beta,
  };
}

// Lean sprint picks its viral mode by Thompson sampling over learned priors, so the
// learn cron actually steers CosmicPath output. Without priors it keeps the fixed allocation.
// winner_replay joins the pool only when the caller found a high-view source post to replay.
export function selectLeanViralMode(
  batchIndex: number,
  formulas: GenerationFormula[],
  priors: Record<string, BetaPrior> | undefined,
  recentFormulaIds: string[],
  winnerReplayAvailable = false,
  excludedModeIds: readonly string[] = []
): ViralIntentMode {
  const fixedMode = selectViralIntentMode(batchIndex, { sprintType: "lean_15post" });
  if (!priors && !excludedModeIds.includes(fixedMode.id)) return fixedMode;

  const allModes = [
    ...LEAN_ARM_IDS.map((id) => resolveViralIntentMode(id, 0)),
    ...(winnerReplayAvailable ? [WINNER_REPLAY_MODE] : []),
  ];
  // Excluded modes (template cap reached) leave the pool; an emptied pool falls back to everything.
  const allowed = allModes.filter((mode) => !excludedModeIds.includes(mode.id));
  const modes = allowed.length > 0 ? allowed : allModes;
  const armFormulaId = (mode: ViralIntentMode) => selectCampaignFormulaForViralMode(formulas, mode).id;
  const previous = recentFormulaIds[recentFormulaIds.length - 1];
  const candidates = modes.filter((mode) => armFormulaId(mode) !== previous);
  const pool = candidates.length > 0 ? candidates : modes;
  const armPriors: Record<string, BetaPrior> = { ...priors };
  for (const mode of pool) {
    if (SAJU_HIT_IDS.has(mode.id)) armPriors[armFormulaId(mode)] = seedHitArm(priors?.[armFormulaId(mode)]);
  }
  const { armId } = sampleBestArm(pool.map(armFormulaId), armPriors);
  return pool.find((mode) => armFormulaId(mode) === armId) ?? fixedMode;
}
