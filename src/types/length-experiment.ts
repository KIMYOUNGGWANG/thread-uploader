import { isRecord } from "@/types/config-normalizers";

export type LengthArm = "S" | "L";

// Pre-registered in docs/experiments/2026-10-16-post-length.md; written by scripts/start-length-experiment.mjs.
export interface LengthExperimentConfig {
  startAt: string;
  sequence: string;
  shortMax: number;
  longMin: number;
}

/** Anything malformed turns the experiment off rather than guessing at a half-valid config. */
export function parseLengthExperiment(input: unknown): LengthExperimentConfig | undefined {
  if (!isRecord(input)) return undefined;
  const { startAt, sequence } = input;
  const shortMax = input.shortMax ?? 260;
  const longMin = input.longMin ?? 390;
  if (typeof startAt !== "string" || Number.isNaN(Date.parse(startAt))) return undefined;
  if (typeof sequence !== "string" || !/^[SL]+$/.test(sequence)) return undefined;
  if (typeof shortMax !== "number" || typeof longMin !== "number" || shortMax >= longMin) return undefined;
  return { startAt, sequence, shortMax, longMin };
}
