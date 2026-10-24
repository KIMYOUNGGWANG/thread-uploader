import { sampleBestArm, type BetaPrior } from "@/lib/thompson-sampling-router";
import {
  resolveViralIntentMode,
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

export interface LeanSprintRunInput {
  brandSlug: string;
  domainProfile: string | undefined;
  campaignId: string | null | undefined;
  experimentId: string | null | undefined;
  productName: string | null | undefined;
  count: number;
}

// The lean allocation is tuned on Korean CosmicPath posts; the English D2C profile picks from its own domain formulas.
export function isLeanSprintRun(input: LeanSprintRunInput): boolean {
  if (input.domainProfile === "ecommerce_d2c") return false;
  const ids = [input.campaignId ?? "", input.experimentId ?? ""];
  return (
    input.brandSlug === "cosmicpath" ||
    ids.some((id) => id.includes("lean") || id.includes("cosmicpath")) ||
    (input.campaignId ?? "").includes("14day") ||
    Boolean(input.productName?.toLowerCase().includes("cosmic")) ||
    input.count === 10 ||
    input.count === 15
  );
}

const LEAN_ARM_IDS: readonly ViralIntentModeId[] = [
  "imagination_dilemma",
  "concept_hierarchy",
  "identity_profile",
  "relationship_tension",
  "beginner_qa",
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
