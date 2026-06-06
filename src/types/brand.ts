import type { ViralAdapterId } from "@/types/viral";
import {
  ADVANCED_CREATOR_CTA_TYPES,
  ADVANCED_CREATOR_HOOK_TYPES,
} from "@/lib/creator-prompt-patterns";
import {
  isRecord,
  normalizeStringList,
} from "@/types/config-normalizers";
import {
  CAREER_TIMING_WEDGE_399,
  normalizeActiveCampaignId,
  normalizeCampaigns,
} from "@/types/campaign";
import {
  normalizeActiveExperiment,
  normalizeProductProfile,
} from "@/types/product-profile";
import { normalizeTikTokVideoConfig, TIKTOK_VIDEO_EXPERIMENT_DEFAULT } from "@/types/tiktok-config";
import type {
  ActiveExperiment,
  ProductProfile,
} from "@/types/product-profile";
import type {
  CampaignConfig,
  QualityProfileId,
} from "@/types/campaign";
import type { TikTokVideoConfig } from "@/types/tiktok-config";

export type {
  ActiveExperiment,
  ExperimentStage,
  ExperimentStatus,
  ProductPrimaryChannel,
  ProductProfile,
} from "@/types/product-profile";
export type {
  CampaignConfig,
  CampaignFormula,
  CampaignFormulaId,
  CareerDecisionType,
  QualityProfileId,
  ReplyPlaybook,
} from "@/types/campaign";
export type {
  GrowthMemory,
  GrowthPattern,
} from "@/types/growth-memory";
export type {
  TikTokVideoConfig,
  TikTokVideoFormatConfig,
  TikTokVideoFormatId,
} from "@/types/tiktok-config";
export {
  CAREER_TIMING_WEDGE_399,
  PRODUCT_GROWTH_BASELINE,
} from "@/types/campaign";
export {
  EMPTY_GROWTH_MEMORY,
  parseGrowthMemory,
} from "@/types/growth-memory";
export {
  TIKTOK_VIDEO_EXPERIMENT_DEFAULT,
} from "@/types/tiktok-config";

export interface BrandFormula {
  id: string;
  name: string;
  weight: number;
  instruction: string;
}

export interface BrandQualityRules {
  minLength?: number;
  requiredTerms?: string[];
}

export interface ViralDiscoveryConfig {
  keywords: string[];
  competitorHandles: string[];
  excludedTerms: string[];
  maxExamplesPerRun: number;
  minViralScore: number;
  adapters: Array<{
    id: ViralAdapterId;
    enabled: boolean;
  }>;
}

export interface BrandConfig {
  systemPrompt: string;
  topics: string[];
  targets: string[];
  situations: string[];
  websiteUrl: string;
  formulas: BrandFormula[];
  qualityRules?: BrandQualityRules;
  trendingTopics?: string[];
  hookTypes?: string[];
  ctaTypes?: string[];
  viralDiscovery: ViralDiscoveryConfig;
  campaigns: CampaignConfig[];
  activeCampaignId?: string;
  qualityProfile: QualityProfileId;
  tiktokVideo: TikTokVideoConfig;
  productProfile: ProductProfile;
  activeExperiment: ActiveExperiment;
}

export interface BrandResponse {
  id: string;
  name: string;
  slug: string;
  threadsUserId: string;
  tokenExpiry: string;
  brandConfig: BrandConfig;
  formulaWeights: Record<string, number>;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_BRAND_CONFIG: BrandConfig = {
  systemPrompt: "",
  topics: [],
  targets: [],
  situations: [],
  websiteUrl: "",
  formulas: [],
  trendingTopics: [],
  hookTypes: [
    "공감형 훅",
    "반전형 훅",
    "논쟁형 훅",
    "체크리스트형 훅",
    "실패담형 훅",
    ...ADVANCED_CREATOR_HOOK_TYPES,
  ],
  ctaTypes: [
    "링크 확인",
    "셀프체크",
    "저장 유도",
    "공유 유도",
    "프로필 확인",
    ...ADVANCED_CREATOR_CTA_TYPES,
  ],
  viralDiscovery: {
    keywords: [],
    competitorHandles: [],
    excludedTerms: [],
    maxExamplesPerRun: 15,
    minViralScore: 0,
    adapters: [
      { id: "owned_posts", enabled: true },
      { id: "threads_keyword", enabled: true },
      { id: "threads_profile", enabled: true },
      { id: "manual", enabled: true },
    ],
  },
  campaigns: [CAREER_TIMING_WEDGE_399],
  activeCampaignId: CAREER_TIMING_WEDGE_399.id,
  qualityProfile: "career_decision",
  tiktokVideo: TIKTOK_VIDEO_EXPERIMENT_DEFAULT,
  productProfile: normalizeProductProfile({}),
  activeExperiment: normalizeActiveExperiment({}),
};

export function parseBrandConfig(raw: string): BrandConfig {
  try {
    const parsedJson: unknown = JSON.parse(raw);
    const parsed = isRecord(parsedJson) ? parsedJson : {};
    const campaigns = normalizeCampaigns(parsed.campaigns);
    const activeCampaignId = normalizeActiveCampaignId(parsed.activeCampaignId, campaigns);
    const activeCampaign = campaigns.find((campaign) => campaign.id === activeCampaignId) ?? campaigns[0];
    const qualityProfile = normalizeQualityProfileWithFallback(
      parsed.qualityProfile,
      activeCampaign?.qualityProfile ?? DEFAULT_BRAND_CONFIG.qualityProfile
    );
    return {
      systemPrompt: typeof parsed.systemPrompt === "string" ? parsed.systemPrompt : DEFAULT_BRAND_CONFIG.systemPrompt,
      topics: normalizeStringListWithFallback(parsed.topics, DEFAULT_BRAND_CONFIG.topics),
      targets: normalizeStringListWithFallback(parsed.targets, DEFAULT_BRAND_CONFIG.targets),
      situations: normalizeStringListWithFallback(parsed.situations, DEFAULT_BRAND_CONFIG.situations),
      websiteUrl: typeof parsed.websiteUrl === "string" ? parsed.websiteUrl : DEFAULT_BRAND_CONFIG.websiteUrl,
      formulas: normalizeBrandFormulas(parsed.formulas),
      qualityRules: normalizeQualityRules(parsed.qualityRules),
      trendingTopics: normalizeOptionalStringList(parsed.trendingTopics, DEFAULT_BRAND_CONFIG.trendingTopics),
      hookTypes: normalizeOptionalStringList(parsed.hookTypes, DEFAULT_BRAND_CONFIG.hookTypes),
      ctaTypes: normalizeOptionalStringList(parsed.ctaTypes, DEFAULT_BRAND_CONFIG.ctaTypes),
      viralDiscovery: normalizeViralDiscovery(parsed.viralDiscovery),
      campaigns,
      activeCampaignId,
      qualityProfile,
      tiktokVideo: normalizeTikTokVideoConfig(parsed.tiktokVideo, activeCampaignId),
      productProfile: normalizeProductProfile(parsed.productProfile),
      activeExperiment: normalizeActiveExperiment(parsed.activeExperiment),
    };
  } catch {
    return DEFAULT_BRAND_CONFIG;
  }
}

export function getActiveCampaign(config: BrandConfig, campaignId?: string | null): CampaignConfig | null {
  if (campaignId) return config.campaigns.find((campaign) => campaign.id === campaignId) ?? null;
  return config.campaigns.find((campaign) => campaign.id === config.activeCampaignId) ?? config.campaigns[0] ?? null;
}

function normalizeViralDiscovery(input: unknown): ViralDiscoveryConfig {
  const raw = isRecord(input) ? input : {};
  const defaults = DEFAULT_BRAND_CONFIG.viralDiscovery;

  return {
    keywords: normalizeStringList(raw.keywords),
    competitorHandles: normalizeStringList(raw.competitorHandles).map((handle) => handle.replace(/^@/, "")),
    excludedTerms: normalizeStringList(raw.excludedTerms),
    maxExamplesPerRun: normalizeBoundedNumber(raw.maxExamplesPerRun, 1, 50, defaults.maxExamplesPerRun),
    minViralScore: normalizeBoundedNumber(raw.minViralScore, 0, 1000000, defaults.minViralScore),
    adapters: defaults.adapters.map((adapter) => {
      const rawAdapters = Array.isArray(raw.adapters) ? raw.adapters.filter(isRecord) : [];
      const matched = rawAdapters.find((item) => item.id === adapter.id);
      return {
        id: adapter.id,
        enabled: typeof matched?.enabled === "boolean" ? matched.enabled : adapter.enabled,
      };
    }),
  };
}

function normalizeBrandFormulas(input: unknown): BrandFormula[] {
  if (!Array.isArray(input)) return DEFAULT_BRAND_CONFIG.formulas;
  return input.filter(isRecord).flatMap((formula) => {
    if (typeof formula.id !== "string" || typeof formula.name !== "string" || typeof formula.instruction !== "string") {
      return [];
    }
    return [{
      id: formula.id,
      name: formula.name,
      weight: normalizeBoundedNumber(formula.weight, 1, 10, 1),
      instruction: formula.instruction,
    }];
  });
}

function normalizeQualityRules(input: unknown): BrandQualityRules | undefined {
  if (!isRecord(input)) return undefined;
  return {
    minLength: typeof input.minLength === "number" ? input.minLength : undefined,
    requiredTerms: normalizeStringList(input.requiredTerms),
  };
}

function normalizeQualityProfileWithFallback(input: unknown, fallback: QualityProfileId): QualityProfileId {
  return input === "saju_viral" || input === "career_decision" || input === "product_growth" ? input : fallback;
}

function normalizeStringListWithFallback(input: unknown, fallback: string[]): string[] {
  return Array.isArray(input) ? normalizeStringList(input) : fallback;
}

function normalizeOptionalStringList(input: unknown, fallback: string[] | undefined): string[] | undefined {
  if (!Array.isArray(input)) return fallback;
  return normalizeStringList(input);
}

function normalizeBoundedNumber(input: unknown, min: number, max: number, fallback: number): number {
  return typeof input === "number" && Number.isFinite(input)
    ? Math.min(max, Math.max(min, Math.round(input)))
    : fallback;
}
