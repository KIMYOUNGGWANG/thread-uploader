import { sampleBestArm, type BetaPrior } from "@/lib/thompson-sampling-router";
import {
  resolveViralIntentMode,
  selectViralIntentMode,
  type ViralIntentMode,
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

const LEAN_MODE_COUNT = 4;

// Lean sprint picks its viral mode by Thompson sampling over learned priors, so the
// learn cron actually steers CosmicPath output. Without priors it keeps the fixed allocation.
export function selectLeanViralMode(
  batchIndex: number,
  formulas: GenerationFormula[],
  priors: Record<string, BetaPrior> | undefined,
  recentFormulaIds: string[]
): ViralIntentMode {
  const fixedMode = selectViralIntentMode(batchIndex, { sprintType: "lean_15post" });
  if (!priors) return fixedMode;

  const modes = Array.from({ length: LEAN_MODE_COUNT }, (_, index) => (
    selectViralIntentMode(index, { sprintType: "lean_15post" })
  ));
  const armFormulaId = (mode: ViralIntentMode) => selectCampaignFormulaForViralMode(formulas, mode).id;
  const previous = recentFormulaIds[recentFormulaIds.length - 1];
  const candidates = modes.filter((mode) => armFormulaId(mode) !== previous);
  const pool = candidates.length > 0 ? candidates : modes;
  const { armId } = sampleBestArm(pool.map(armFormulaId), priors);
  return pool.find((mode) => armFormulaId(mode) === armId) ?? fixedMode;
}
