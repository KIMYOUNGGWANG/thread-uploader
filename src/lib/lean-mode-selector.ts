import { sampleBestArm, type BetaPrior } from "@/lib/thompson-sampling-router";
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
  const { armId } = sampleBestArm(pool.map(armFormulaId), priors ?? {});
  return pool.find((mode) => armFormulaId(mode) === armId) ?? fixedMode;
}
