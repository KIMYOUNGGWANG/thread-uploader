import {
  DEFAULT_BRAND_CONFIG,
  PRODUCT_GROWTH_BASELINE,
  type BrandConfig,
  type BrandFormula,
  type CampaignConfig,
  type ProductPrimaryChannel,
  type ProductProfile,
  type ActiveExperiment,
} from "@/types/brand";

export type ProductSetupStatus = "ready" | "needs_input";
export type ProductSetupGapField =
  | "productName"
  | "oneLineDescription"
  | "targetCustomer"
  | "offerPromise"
  | "landingUrl";

export interface ProductAutoSetupInput {
  productName?: string;
  name?: string;
  slug?: string;
  oneLineDescription?: string;
  description?: string;
  targetCustomer?: string;
  offerPromise?: string;
  landingUrl?: string;
  primaryChannel?: ProductPrimaryChannel;
  positioningNotes?: string;
}

export interface ProductSetupGap {
  field: ProductSetupGapField;
  message: string;
}

export interface ProductSetupReadiness {
  score: number;
  status: ProductSetupStatus;
  canStartCampaign: boolean;
  gaps: ProductSetupGap[];
  nextActions: string[];
}

export interface ProductAutoSetupDraft {
  config: BrandConfig;
  readiness: ProductSetupReadiness;
}

interface BuildOptions { now?: string; }

export function buildProductAutoSetupDraft(
  input: ProductAutoSetupInput,
  options: BuildOptions = {}
): ProductAutoSetupDraft {
  const normalized = normalizeProductAutoSetupInput(input);
  const readiness = buildReadiness(normalized);
  const campaign = buildProductCampaign(normalized);

  return {
    config: {
      ...DEFAULT_BRAND_CONFIG,
      systemPrompt: buildSystemPrompt(normalized),
      websiteUrl: "",
      topics: buildTopics(normalized),
      targets: normalized.targetCustomer ? [normalized.targetCustomer] : [],
      situations: buildSituations(normalized),
      formulas: buildBrandFormulas(normalized),
      campaigns: [campaign],
      activeCampaignId: campaign.id,
      qualityProfile: "product_growth",
      tiktokVideo: {
        ...DEFAULT_BRAND_CONFIG.tiktokVideo,
        enabled: false,
        parentCampaignId: campaign.id,
        landingUrl: normalized.landingUrl,
        formats: [],
      },
      productProfile: buildProductProfile(normalized),
      activeExperiment: buildActiveExperiment(normalized, options.now),
    },
    readiness,
  };
}

export function parseProductAutoSetupInput(input: unknown): ProductAutoSetupInput {
  const raw = isRecord(input) ? input : {};
  return {
    productName: readText(raw.productName),
    name: readText(raw.name),
    slug: readText(raw.slug),
    oneLineDescription: readText(raw.oneLineDescription),
    description: readText(raw.description),
    targetCustomer: readText(raw.targetCustomer),
    offerPromise: readText(raw.offerPromise),
    landingUrl: readText(raw.landingUrl),
    primaryChannel: readPrimaryChannel(raw.primaryChannel),
    positioningNotes: readText(raw.positioningNotes),
  };
}

function normalizeProductAutoSetupInput(input: ProductAutoSetupInput): Required<ProductAutoSetupInput> {
  const productName = cleanText(input.productName) || cleanText(input.name);
  return {
    productName,
    name: cleanText(input.name),
    slug: cleanText(input.slug) || slugify(productName),
    oneLineDescription: cleanText(input.oneLineDescription) || cleanText(input.description),
    description: cleanText(input.description),
    targetCustomer: cleanText(input.targetCustomer),
    offerPromise: cleanText(input.offerPromise),
    landingUrl: cleanText(input.landingUrl),
    primaryChannel: input.primaryChannel ?? "threads",
    positioningNotes: cleanText(input.positioningNotes),
  };
}

function buildReadiness(input: Required<ProductAutoSetupInput>): ProductSetupReadiness {
  const gaps = [
    textGap("productName", input.productName, "제품 이름을 입력하세요."),
    textGap("oneLineDescription", input.oneLineDescription, "제품이 무엇을 해결하는지 한 줄로 적어주세요."),
    textGap("targetCustomer", input.targetCustomer, "콘텐츠가 향할 타깃 고객을 정해주세요."),
    textGap("offerPromise", input.offerPromise, "고객이 얻는 구체적 결과를 적어주세요."),
    landingUrlGap(input.landingUrl),
  ].filter((gap): gap is ProductSetupGap => gap !== null);
  const score = gaps.length === 0 ? 100 : Math.max(0, 100 - gaps.length * 25);
  const canStartCampaign = gaps.length === 0;
  return {
    score,
    status: canStartCampaign ? "ready" : "needs_input",
    canStartCampaign,
    gaps,
    nextActions: gaps.map((gap) => gap.message),
  };
}

function buildProductProfile(input: Required<ProductAutoSetupInput>): ProductProfile {
  return {
    ...DEFAULT_BRAND_CONFIG.productProfile,
    productName: input.productName || DEFAULT_BRAND_CONFIG.productProfile.productName,
    oneLineDescription: input.oneLineDescription,
    targetCustomer: input.targetCustomer,
    offerPromise: input.offerPromise,
    landingUrl: input.landingUrl,
    primaryChannel: input.primaryChannel,
    primaryMetric: "views",
    conversionMetric: "signups",
    positioningNotes: input.positioningNotes,
  };
}

function buildActiveExperiment(input: Required<ProductAutoSetupInput>, now?: string): ActiveExperiment {
  const productName = input.productName || "Product";
  const targetCustomer = input.targetCustomer || "타깃 고객";
  const offerPromise = input.offerPromise || "제품 가치를 확인";
  return {
    ...DEFAULT_BRAND_CONFIG.activeExperiment,
    id: input.slug || slugify(productName),
    name: `${productName} 7-day evidence sprint`,
    hypothesis: `${targetCustomer}은 ${productName}의 "${offerPromise}" 메시지에 반응한다.`,
    stage: "content",
    startedAt: now ?? new Date().toISOString(),
    durationDays: 7,
    primaryMetric: "views",
    guardrailMetric: "quality_pass_rate",
    status: "active",
  };
}

function buildProductCampaign(input: Required<ProductAutoSetupInput>): CampaignConfig {
  return {
    ...PRODUCT_GROWTH_BASELINE,
    landingUrl: input.landingUrl,
    utmCampaign: snakeIdentifier(input.slug || input.productName || PRODUCT_GROWTH_BASELINE.utmCampaign),
  };
}

function buildSystemPrompt(input: Required<ProductAutoSetupInput>): string {
  const productName = input.productName || "이 제품";
  return [
    `${productName}의 제품 성장 콘텐츠를 작성한다.`,
    input.oneLineDescription ? `제품 설명: ${input.oneLineDescription}` : "",
    input.targetCustomer ? `타깃 고객: ${input.targetCustomer}` : "",
    input.offerPromise ? `오퍼 약속: ${input.offerPromise}` : "",
    "각 포스트는 고객 문제, 제품 가치, 다음 행동을 자연스럽게 연결한다.",
  ].filter(Boolean).join("\n");
}

function buildTopics(input: Required<ProductAutoSetupInput>): string[] {
  if (!input.oneLineDescription) return [];
  return uniqueText([
    input.oneLineDescription,
    input.offerPromise,
    input.targetCustomer ? `${input.targetCustomer} 문제` : "",
  ]);
}

function buildSituations(input: Required<ProductAutoSetupInput>): string[] {
  if (!input.targetCustomer || !input.offerPromise) return [];
  return [
    `${input.targetCustomer}이 ${input.offerPromise}가 필요한 순간`,
    `${input.targetCustomer}이 기존 방식의 비효율을 느끼는 상황`,
  ];
}

function buildBrandFormulas(input: Required<ProductAutoSetupInput>): BrandFormula[] {
  if (!input.oneLineDescription) return [];
  return [
    {
      id: "product_problem_diagnosis",
      name: "고객 문제 진단형",
      weight: 3,
      instruction: "타깃 고객이 지금 겪는 문제를 묻고 제품 오퍼로 해결 가능한 지점을 연결한다.",
    },
    {
      id: "product_before_after",
      name: "제품 전후 비교형",
      weight: 2,
      instruction: "제품을 쓰기 전의 반복 문제와 사용 후의 구체적 변화를 대비한다.",
    },
    {
      id: "operator_observation",
      name: "운영자 관찰형",
      weight: 2,
      instruction: `제품을 만들며 관찰한 ${input.targetCustomer || "고객"}의 문제에서 시작한다.`,
    },
  ];
}

function textGap(field: ProductSetupGapField, value: string, message: string): ProductSetupGap | null {
  return value ? null : { field, message };
}

function landingUrlGap(value: string): ProductSetupGap | null {
  if (!value) return { field: "landingUrl", message: "캠페인 링크로 쓸 랜딩 URL을 입력하세요." };
  if (isValidCampaignLandingUrl(value)) return null;
  return { field: "landingUrl", message: "랜딩 URL은 https://, http://, 또는 /path 형식이어야 합니다." };
}

export function isValidCampaignLandingUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("/")) return trimmed.length > 1 && !trimmed.startsWith("//");
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function uniqueText(values: string[]): string[] {
  return Array.from(new Set(values.map(cleanText).filter(Boolean)));
}

function slugify(value: string): string {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function snakeIdentifier(value: string): string {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function readText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readPrimaryChannel(value: unknown): ProductPrimaryChannel | undefined {
  return value === "threads" || value === "tiktok" || value === "manual" ? value : undefined;
}

function cleanText(value: string | undefined): string { return value?.trim() ?? ""; }

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
