import type { ViralAdapterId } from "@/types/viral";

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

export type QualityProfileId = "saju_viral" | "career_decision";
export type CampaignFormulaId = "comment_diagnosis" | "friend_tag" | "self_confession";
export type CareerDecisionType = "stay" | "move" | "prepare";

export interface CampaignFormula {
  id: CampaignFormulaId;
  name: string;
  weight: number;
  instruction: string;
}

export interface ReplyPlaybook {
  stay: string;
  move: string;
  prepare: string;
  cta: string;
}

export interface CampaignConfig {
  id: string;
  name: string;
  mode: "viral-content" | "landing-test";
  qualityProfile: QualityProfileId;
  landingUrl: string;
  utmSource: "threads";
  utmCampaign: string;
  utmContentTemplate: "{{postId}}";
  dailyPostTarget: number;
  linkCadenceEvery: number;
  linkPlacement: "firstComment";
  formulas: CampaignFormula[];
  replyPlaybook: ReplyPlaybook;
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
}

export interface GrowthPattern {
  dimension: "formula" | "hook" | "topic" | "target" | "cta";
  value: string;
  count: number;
  avgScore: number;
  avgViews: number;
  avgLikes: number;
  avgReplies: number;
  avgReposts: number;
}

export interface GrowthMemory {
  version: 1;
  updatedAt: string;
  sampleSize: number;
  avgScore: number;
  winners: GrowthPattern[];
  weakSignals: GrowthPattern[];
  recommendations: string[];
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

export const CAREER_TIMING_WEDGE_399: CampaignConfig = {
  id: "career_timing_wedge_399",
  name: "커리어 타이밍 불안 wedge",
  mode: "landing-test",
  qualityProfile: "career_decision",
  landingUrl: "/career/uncertainty",
  utmSource: "threads",
  utmCampaign: "career_timing_wedge_399",
  utmContentTemplate: "{{postId}}",
  dailyPostTarget: 3,
  linkCadenceEvery: 3,
  linkPlacement: "firstComment",
  formulas: [
    {
      id: "comment_diagnosis",
      name: "댓글 진단형",
      weight: 3,
      instruction: "댓글에 현재 상황을 쓰면 버팀형/이동형/준비형 중 어디에 가까운지 분류해준다는 구조로 작성한다.",
    },
    {
      id: "friend_tag",
      name: "친구 태그형",
      weight: 2,
      instruction: "이직, 퇴사, 번아웃을 고민하는 친구에게 보내주고 싶게 만드는 공유 유도형 구조로 작성한다.",
    },
    {
      id: "self_confession",
      name: "자기고백 공감형",
      weight: 2,
      instruction: "퇴사/이직 타이밍을 놓칠까 불안했던 자기고백에서 시작해 독자가 댓글로 자기 상황을 말하게 만든다.",
    },
  ],
  replyPlaybook: {
    stay: "버팀형에 가까워요. 지금은 판을 엎기보다 에너지 누수 지점과 협상 가능한 조건부터 정리해보는 쪽이 안전해요.",
    move: "이동형 신호가 보여요. 감정이 아니라 반복되는 패턴 때문에 흔들리는 거라면, 다음 선택지를 실제로 비교해볼 타이밍입니다.",
    prepare: "준비형에 가까워요. 당장 결론보다 2~4주 안에 확인할 조건, 포트폴리오, 지원 루틴을 먼저 잡는 게 좋아요.",
    cta: "타이밍이 헷갈리면 프로필 링크에서 커리어 흐름 리포트를 먼저 확인해보세요. 지금 고민을 더 구체적으로 볼 수 있어요.",
  },
};

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
  ],
  ctaTypes: [
    "첫 댓글 링크",
    "댓글 유도",
    "저장 유도",
    "공유 유도",
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
};

export const EMPTY_GROWTH_MEMORY: GrowthMemory = {
  version: 1,
  updatedAt: "",
  sampleSize: 0,
  avgScore: 0,
  winners: [],
  weakSignals: [],
  recommendations: [],
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
      trendingTopics: parsed.trendingTopics ?? DEFAULT_BRAND_CONFIG.trendingTopics,
      hookTypes: parsed.hookTypes ?? DEFAULT_BRAND_CONFIG.hookTypes,
      ctaTypes: parsed.ctaTypes ?? DEFAULT_BRAND_CONFIG.ctaTypes,
      viralDiscovery: normalizeViralDiscovery(parsed.viralDiscovery),
      campaigns: normalizeCampaigns(parsed.campaigns),
      activeCampaignId: normalizeActiveCampaignId(parsed.activeCampaignId, parsed.campaigns),
      qualityProfile: normalizeQualityProfile(parsed.qualityProfile),
    };
  } catch {
    return DEFAULT_BRAND_CONFIG;
  }
}

export function getActiveCampaign(config: BrandConfig, campaignId?: string | null): CampaignConfig | null {
  const selectedId = campaignId ?? config.activeCampaignId;
  return config.campaigns.find((campaign) => campaign.id === selectedId) ?? config.campaigns[0] ?? null;
}

function normalizeViralDiscovery(input: unknown): ViralDiscoveryConfig {
  const raw = typeof input === "object" && input !== null
    ? input as Partial<ViralDiscoveryConfig>
    : {};
  const defaults = DEFAULT_BRAND_CONFIG.viralDiscovery;

  return {
    keywords: normalizeStringList(raw.keywords),
    competitorHandles: normalizeStringList(raw.competitorHandles).map((handle) => handle.replace(/^@/, "")),
    excludedTerms: normalizeStringList(raw.excludedTerms),
    maxExamplesPerRun: clampNumber(raw.maxExamplesPerRun, 1, 50, defaults.maxExamplesPerRun),
    minViralScore: clampNumber(raw.minViralScore, 0, 1000000, defaults.minViralScore),
    adapters: defaults.adapters.map((adapter) => ({
      id: adapter.id,
      enabled: raw.adapters?.find((item) => item.id === adapter.id)?.enabled ?? adapter.enabled,
    })),
  };
}

function normalizeCampaigns(input: unknown): CampaignConfig[] {
  if (!Array.isArray(input) || input.length === 0) return [CAREER_TIMING_WEDGE_399];
  const campaigns = input
    .filter((value): value is Partial<CampaignConfig> => typeof value === "object" && value !== null)
    .map((campaign) => normalizeCampaign(campaign));
  return campaigns.length ? campaigns : [CAREER_TIMING_WEDGE_399];
}

function normalizeCampaign(input: Partial<CampaignConfig>): CampaignConfig {
  const defaults = input.id === CAREER_TIMING_WEDGE_399.id ? CAREER_TIMING_WEDGE_399 : CAREER_TIMING_WEDGE_399;
  return {
    id: normalizeIdentifier(input.id, defaults.id),
    name: typeof input.name === "string" && input.name.trim() ? input.name.trim() : defaults.name,
    mode: input.mode === "viral-content" || input.mode === "landing-test" ? input.mode : defaults.mode,
    qualityProfile: normalizeQualityProfile(input.qualityProfile),
    landingUrl: typeof input.landingUrl === "string" && input.landingUrl.trim() ? input.landingUrl.trim() : defaults.landingUrl,
    utmSource: "threads",
    utmCampaign: normalizeIdentifier(input.utmCampaign, defaults.utmCampaign),
    utmContentTemplate: "{{postId}}",
    dailyPostTarget: clampNumber(input.dailyPostTarget, 1, 12, defaults.dailyPostTarget),
    linkCadenceEvery: clampNumber(input.linkCadenceEvery, 1, 12, defaults.linkCadenceEvery),
    linkPlacement: "firstComment",
    formulas: normalizeCampaignFormulas(input.formulas, defaults.formulas),
    replyPlaybook: normalizeReplyPlaybook(input.replyPlaybook, defaults.replyPlaybook),
  };
}

function normalizeCampaignFormulas(input: unknown, fallback: CampaignFormula[]): CampaignFormula[] {
  if (!Array.isArray(input)) return fallback;
  const formulas = input
    .filter((value): value is Partial<CampaignFormula> => typeof value === "object" && value !== null)
    .map((formula, index) => {
      const fallbackFormula = fallback[index] ?? fallback[0];
      return {
        id: normalizeCampaignFormulaId(formula.id, fallbackFormula.id),
        name: typeof formula.name === "string" && formula.name.trim() ? formula.name.trim() : fallbackFormula.name,
        weight: clampNumber(formula.weight, 1, 6, fallbackFormula.weight),
        instruction: typeof formula.instruction === "string" && formula.instruction.trim()
          ? formula.instruction.trim()
          : fallbackFormula.instruction,
      };
    });
  return formulas.length ? formulas : fallback;
}

function normalizeReplyPlaybook(input: unknown, fallback: ReplyPlaybook): ReplyPlaybook {
  const raw = typeof input === "object" && input !== null ? input as Partial<ReplyPlaybook> : {};
  return {
    stay: normalizeText(raw.stay, fallback.stay),
    move: normalizeText(raw.move, fallback.move),
    prepare: normalizeText(raw.prepare, fallback.prepare),
    cta: normalizeText(raw.cta, fallback.cta),
  };
}

function normalizeActiveCampaignId(input: unknown, campaignsInput: unknown): string {
  const campaigns = normalizeCampaigns(campaignsInput);
  if (typeof input === "string" && campaigns.some((campaign) => campaign.id === input)) return input;
  return campaigns[0]?.id ?? CAREER_TIMING_WEDGE_399.id;
}

function normalizeQualityProfile(input: unknown): QualityProfileId {
  return input === "saju_viral" || input === "career_decision" ? input : "career_decision";
}

function normalizeCampaignFormulaId(input: unknown, fallback: CampaignFormulaId): CampaignFormulaId {
  return input === "comment_diagnosis" || input === "friend_tag" || input === "self_confession" ? input : fallback;
}

function normalizeIdentifier(input: unknown, fallback: string): string {
  return typeof input === "string" && input.trim()
    ? input.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_")
    : fallback;
}

function normalizeText(input: unknown, fallback: string): string {
  return typeof input === "string" && input.trim() ? input.trim() : fallback;
}

function normalizeStringList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(new Set(input
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean)));
}

function clampNumber(input: unknown, min: number, max: number, fallback: number): number {
  return typeof input === "number" && Number.isFinite(input)
    ? Math.min(max, Math.max(min, Math.round(input)))
    : fallback;
}

export function parseGrowthMemory(raw: string): GrowthMemory {
  try {
    const parsed = JSON.parse(raw) as Partial<GrowthMemory>;
    return {
      version: 1,
      updatedAt: parsed.updatedAt ?? "",
      sampleSize: parsed.sampleSize ?? 0,
      avgScore: parsed.avgScore ?? 0,
      winners: parsed.winners ?? [],
      weakSignals: parsed.weakSignals ?? [],
      recommendations: parsed.recommendations ?? [],
    };
  } catch {
    return EMPTY_GROWTH_MEMORY;
  }
}
