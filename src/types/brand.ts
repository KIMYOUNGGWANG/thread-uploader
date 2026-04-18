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

export interface BrandConfig {
  systemPrompt: string;
  topics: string[];
  targets: string[];
  situations: string[];
  websiteUrl: string;
  formulas: BrandFormula[];
  qualityRules?: BrandQualityRules;
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
};

export function parseBrandConfig(raw: string): BrandConfig {
  try {
    const parsed = JSON.parse(raw) as Partial<BrandConfig>;
    return {
      systemPrompt: parsed.systemPrompt ?? DEFAULT_BRAND_CONFIG.systemPrompt,
      topics: parsed.topics ?? DEFAULT_BRAND_CONFIG.topics,
      targets: parsed.targets ?? DEFAULT_BRAND_CONFIG.targets,
      situations: parsed.situations ?? DEFAULT_BRAND_CONFIG.situations,
      websiteUrl: parsed.websiteUrl ?? DEFAULT_BRAND_CONFIG.websiteUrl,
      formulas: parsed.formulas ?? DEFAULT_BRAND_CONFIG.formulas,
      qualityRules: parsed.qualityRules,
    };
  } catch {
    return DEFAULT_BRAND_CONFIG;
  }
}
