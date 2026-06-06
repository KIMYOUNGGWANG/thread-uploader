import { clampNumber, isRecord, normalizeIdentifier, normalizeText } from "@/types/config-normalizers";
import { normalizeViralIntentModeId } from "@/lib/viral-intent-modes";

export type QualityProfileId = "saju_viral" | "career_decision" | "product_growth";
export type CampaignFormulaId = "self_classification" | "saveable_tool" | "quiet_contrarian" | "friend_share";
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
      id: "self_classification",
      name: "자기분류 셀프체크형",
      weight: 3,
      instruction: "A/B/C 또는 버팀형/이동형/준비형 중 가까운 선택지를 본문 안에서 혼자 체크하게 만든다. 추가 응답 없이도 참여가 완결되어야 한다.",
    },
    {
      id: "saveable_tool",
      name: "저장형 판단 도구",
      weight: 2,
      instruction: "이직, 퇴사, 번아웃 판단 전에 저장해두고 다시 볼 3-4칸 체크리스트나 판정표로 작성한다.",
    },
    {
      id: "friend_share",
      name: "친구 공유형",
      weight: 2,
      instruction: "이직, 퇴사, 번아웃을 고민하는 친구에게 보내주고 싶게 만드는 공유 유도형 구조로 작성한다.",
    },
  ],
  replyPlaybook: {
    stay: "버팀형에 가까워요. 지금은 판을 엎기보다 에너지 누수 지점과 협상 가능한 조건부터 정리해보는 쪽이 안전해요.",
    move: "이동형 신호가 보여요. 감정이 아니라 반복되는 패턴 때문에 흔들리는 거라면, 다음 선택지를 실제로 비교해볼 타이밍입니다.",
    prepare: "준비형에 가까워요. 당장 결론보다 2~4주 안에 확인할 조건, 포트폴리오, 지원 루틴을 먼저 잡는 게 좋아요.",
    cta: "타이밍이 헷갈리면 프로필 링크에서 커리어 흐름 리포트를 먼저 확인해보세요. 지금 고민을 더 구체적으로 볼 수 있어요.",
  },
};

export const PRODUCT_GROWTH_BASELINE: CampaignConfig = {
  id: "product_growth_baseline",
  name: "제품 성장 baseline",
  mode: "landing-test",
  qualityProfile: "product_growth",
  landingUrl: "",
  utmSource: "threads",
  utmCampaign: "product_growth_baseline",
  utmContentTemplate: "{{postId}}",
  dailyPostTarget: 3,
  linkCadenceEvery: 3,
  linkPlacement: "firstComment",
  formulas: [
    {
      id: "self_classification",
      name: "고객 문제 자기분류형",
      weight: 3,
      instruction: "타깃 고객이 A/B/C 중 가까운 문제 유형만 고르게 만든다. 추가 응답 없이도 참여가 완결되어야 한다.",
    },
    {
      id: "saveable_tool",
      name: "저장형 제품 체크리스트",
      weight: 2,
      instruction: "제품 사용 전후 차이를 저장 가능한 체크리스트나 순서표로 보여준다.",
    },
    {
      id: "friend_share",
      name: "운영자 관찰형",
      weight: 2,
      instruction: "제품을 만들며 관찰한 고객 문제에서 시작해 같은 문제를 겪는 사람에게 공유하고 싶게 만든다.",
    },
  ],
  replyPlaybook: {
    stay: "A/B/C 중 가까운 문제 유형을 먼저 고르면 다음 행동선을 줄이기 쉽습니다.",
    move: "그 문제라면 지금 쓰는 방식보다 제품으로 줄일 수 있는 시간이 클 수 있어요.",
    prepare: "바로 바꾸기 어렵다면 가장 자주 반복되는 작업 하나부터 적어보세요.",
    cta: "자세히 확인하려면 링크에서 제품 흐름을 먼저 확인해보세요.",
  },
};

export function normalizeCampaigns(input: unknown): CampaignConfig[] {
  if (!Array.isArray(input) || input.length === 0) return [CAREER_TIMING_WEDGE_399];
  const campaigns = input
    .filter(isRecord)
    .map((campaign) => normalizeCampaign(campaign));
  return campaigns.length ? campaigns : [CAREER_TIMING_WEDGE_399];
}

export function normalizeActiveCampaignId(input: unknown, campaignsInput: unknown): string {
  const campaigns = normalizeCampaigns(campaignsInput);
  if (typeof input === "string" && campaigns.some((campaign) => campaign.id === input)) return input;
  return campaigns[0]?.id ?? CAREER_TIMING_WEDGE_399.id;
}

export function normalizeQualityProfile(input: unknown): QualityProfileId {
  return input === "saju_viral" || input === "career_decision" || input === "product_growth" ? input : "career_decision";
}

function normalizeCampaign(input: Record<string, unknown>): CampaignConfig {
  const defaults = input.id === PRODUCT_GROWTH_BASELINE.id || input.qualityProfile === "product_growth"
    ? PRODUCT_GROWTH_BASELINE
    : CAREER_TIMING_WEDGE_399;
  return {
    id: normalizeIdentifier(input.id, defaults.id),
    name: normalizeText(input.name, defaults.name),
    mode: input.mode === "viral-content" || input.mode === "landing-test" ? input.mode : defaults.mode,
    qualityProfile: normalizeCampaignQualityProfile(input.qualityProfile, defaults.qualityProfile),
    landingUrl: normalizeText(input.landingUrl, defaults.landingUrl),
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
    .filter(isRecord)
    .map((formula, index) => {
      const fallbackFormula = fallback[index] ?? fallback[0];
      const normalizedId = normalizeCampaignFormulaId(formula.id, fallbackFormula.id);
      const isLegacyId = typeof formula.id === "string" && normalizeViralIntentModeId(formula.id) !== formula.id;
      return {
        id: normalizedId,
        name: normalizeText(formula.name, fallbackFormula.name),
        weight: clampNumber(formula.weight, 1, 6, fallbackFormula.weight),
        instruction: isLegacyId ? fallbackFormula.instruction : normalizeText(formula.instruction, fallbackFormula.instruction),
      };
    });
  return formulas.length ? formulas : fallback;
}

function normalizeReplyPlaybook(input: unknown, fallback: ReplyPlaybook): ReplyPlaybook {
  const raw = isRecord(input) ? input : {};
  return {
    stay: normalizeText(raw.stay, fallback.stay),
    move: normalizeText(raw.move, fallback.move),
    prepare: normalizeText(raw.prepare, fallback.prepare),
    cta: normalizeText(raw.cta, fallback.cta),
  };
}

function normalizeCampaignQualityProfile(input: unknown, fallback: QualityProfileId): QualityProfileId {
  return input === "saju_viral" || input === "career_decision" || input === "product_growth" ? input : fallback;
}

function normalizeCampaignFormulaId(input: unknown, fallback: CampaignFormulaId): CampaignFormulaId {
  return normalizeViralIntentModeId(input) ?? fallback;
}
