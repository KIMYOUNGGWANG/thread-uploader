import { clampNumber, isRecord, normalizeIdentifier, normalizeText } from "@/types/config-normalizers";

export type ProductPrimaryChannel = "threads" | "tiktok" | "manual";
export type ExperimentStage = "content" | "landing" | "conversion";
export type ExperimentStatus = "active" | "paused" | "completed";

export interface ProductProfile {
  productName: string;
  oneLineDescription: string;
  targetCustomer: string;
  offerPromise: string;
  landingUrl: string;
  primaryChannel: ProductPrimaryChannel;
  primaryMetric: string;
  conversionMetric: string;
  positioningNotes: string;
}

export interface ActiveExperiment {
  id: string;
  name: string;
  hypothesis: string;
  stage: ExperimentStage;
  startedAt: string;
  durationDays: number;
  primaryMetric: string;
  guardrailMetric: string;
  status: ExperimentStatus;
}

export const DEFAULT_PRODUCT_PROFILE: ProductProfile = {
  productName: "Untitled Product",
  oneLineDescription: "",
  targetCustomer: "",
  offerPromise: "",
  landingUrl: "",
  primaryChannel: "threads",
  primaryMetric: "views",
  conversionMetric: "conversions",
  positioningNotes: "",
};

export const DEFAULT_ACTIVE_EXPERIMENT: ActiveExperiment = {
  id: "baseline_growth_loop",
  name: "Baseline growth loop",
  hypothesis: "Generate owned-product content and learn which message earns qualified attention.",
  stage: "content",
  startedAt: "",
  durationDays: 7,
  primaryMetric: "views",
  guardrailMetric: "quality_pass_rate",
  status: "active",
};

export function normalizeProductProfile(input: unknown): ProductProfile {
  const raw = isRecord(input) ? input : {};
  return {
    productName: normalizeText(raw.productName, DEFAULT_PRODUCT_PROFILE.productName),
    oneLineDescription: normalizeText(raw.oneLineDescription, DEFAULT_PRODUCT_PROFILE.oneLineDescription),
    targetCustomer: normalizeText(raw.targetCustomer, DEFAULT_PRODUCT_PROFILE.targetCustomer),
    offerPromise: normalizeText(raw.offerPromise, DEFAULT_PRODUCT_PROFILE.offerPromise),
    landingUrl: normalizeText(raw.landingUrl, DEFAULT_PRODUCT_PROFILE.landingUrl),
    primaryChannel: normalizeProductPrimaryChannel(raw.primaryChannel),
    primaryMetric: normalizeText(raw.primaryMetric, DEFAULT_PRODUCT_PROFILE.primaryMetric),
    conversionMetric: normalizeText(raw.conversionMetric, DEFAULT_PRODUCT_PROFILE.conversionMetric),
    positioningNotes: normalizeText(raw.positioningNotes, DEFAULT_PRODUCT_PROFILE.positioningNotes),
  };
}

export function normalizeActiveExperiment(input: unknown): ActiveExperiment {
  const raw = isRecord(input) ? input : {};
  return {
    id: normalizeIdentifier(raw.id, DEFAULT_ACTIVE_EXPERIMENT.id),
    name: normalizeText(raw.name, DEFAULT_ACTIVE_EXPERIMENT.name),
    hypothesis: normalizeText(raw.hypothesis, DEFAULT_ACTIVE_EXPERIMENT.hypothesis),
    stage: normalizeExperimentStage(raw.stage),
    startedAt: normalizeText(raw.startedAt, DEFAULT_ACTIVE_EXPERIMENT.startedAt),
    durationDays: normalizeDurationDays(raw.durationDays),
    primaryMetric: normalizeText(raw.primaryMetric, DEFAULT_ACTIVE_EXPERIMENT.primaryMetric),
    guardrailMetric: normalizeText(raw.guardrailMetric, DEFAULT_ACTIVE_EXPERIMENT.guardrailMetric),
    status: normalizeExperimentStatus(raw.status),
  };
}

function normalizeProductPrimaryChannel(input: unknown): ProductPrimaryChannel {
  return input === "threads" || input === "tiktok" || input === "manual" ? input : DEFAULT_PRODUCT_PROFILE.primaryChannel;
}

function normalizeExperimentStage(input: unknown): ExperimentStage {
  return input === "content" || input === "landing" || input === "conversion" ? input : DEFAULT_ACTIVE_EXPERIMENT.stage;
}

function normalizeExperimentStatus(input: unknown): ExperimentStatus {
  return input === "active" || input === "paused" || input === "completed" ? input : DEFAULT_ACTIVE_EXPERIMENT.status;
}

function normalizeDurationDays(input: unknown): number {
  if (typeof input !== "number" || !Number.isFinite(input)) return DEFAULT_ACTIVE_EXPERIMENT.durationDays;
  if (input < 1 || input > 90) return DEFAULT_ACTIVE_EXPERIMENT.durationDays;
  return clampNumber(input, 1, 90, DEFAULT_ACTIVE_EXPERIMENT.durationDays);
}
