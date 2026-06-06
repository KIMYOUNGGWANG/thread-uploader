import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { accessErrorResponse, requireBrandForCurrentUser } from "@/lib/brand-access";
import { formatCreatorPatternContext } from "@/lib/creator-prompt-patterns";
import { formatGrowthPromptContext, parseStoredGrowthMemory } from "@/lib/growth-learning";
import { isValidCampaignLandingUrl } from "@/lib/product-auto-setup";
import { checkQuality } from "@/lib/quality-gate";
import { THREADS_CONTENT_MAX_LENGTH, THREADS_CONTENT_TARGET_LENGTH } from "@/lib/threads-limits";
import {
  formatViralIntentModePrompt,
  hasFortuneOverclaim,
  hasReplyBurdenPromise,
  resolveViralIntentMode,
  selectViralIntentMode,
  type ViralIntentMode,
} from "@/lib/viral-intent-modes";
import { formatViralPromptContext } from "@/lib/viral-analysis";
import { getActiveCampaign, parseBrandConfig } from "@/types/brand";
import type { BrandConfig, CampaignConfig, QualityProfileId } from "@/types/brand";
import { parseViralMemory } from "@/types/viral";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const SEPARATOR = "===FIRST_COMMENT===";
const RETRYABLE_STATUSES = new Set([429, 529]);
const RECENT_POST_AVOIDANCE_COUNT = 24;
const GENERATED_META_PATTERNS = [
  /자수\s*체크/,
  /글자\s*수\s*확인/,
  /공백[·\s]*줄바꿈.*포함/,
  /500자\s*이하\s*통과/,
  /Threads\s*본문/,
  /초안\s*작성/,
];

interface GrowthExperiment {
  formula: GenerationFormula;
  topic: string;
  targetAudience: string;
  situation: string;
  hookType: string;
  ctaType: string;
  angleVariation?: string;
  structureVariation?: string;
  viralIntentMode?: ViralIntentMode;
  qualityProfile: QualityProfileId;
  campaign: CampaignConfig | null;
  campaignFormulaId: string | null;
  shouldLink: boolean;
  sequenceIndex?: number;
}

interface GenerationFormula {
  id: string;
  name: string;
  weight: number;
  instruction: string;
}

type CampaignGrowthExperiment = GrowthExperiment & { campaign: CampaignConfig };
type RecentPostForPrompt = {
  content: string;
  topic: string | null;
  hookType: string | null;
  ctaType: string | null;
  campaignFormulaId: string | null;
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffleTopics(topics: string[], count: number): string[] {
  const shuffled = [...topics].sort(() => Math.random() - 0.5);
  const result: string[] = [];
  while (result.length < count) {
    result.push(...shuffled.slice(0, Math.min(topics.length, count - result.length)));
  }
  return result;
}

function buildFormulaPool(
  formulas: GenerationFormula[],
  dbWeights: Record<string, number>
): GenerationFormula[] {
  const pool: GenerationFormula[] = [];
  for (const formula of formulas) {
    const weight = dbWeights[formula.id] ?? formula.weight;
    for (let i = 0; i < weight; i++) pool.push(formula);
  }
  return pool;
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

export function cleanGeneratedContentLabels(content: string): string {
  return content
    .replace(/^\s*(?:\*\*)?(?:\[)?본문(?:\s*[-:：][^\]\n]*)?(?:\])?(?:\*\*)?\s*/i, "")
    .replace(/^\s*(?:\*\*)?본문(?:\*\*)?\s*[:：]?\s*/i, "")
    .trim();
}

function buildQualityFallback(experiment: GrowthExperiment): { post: string; firstComment: string } {
  const modeId = experiment.viralIntentMode?.id ?? "self_classification";
  const sequenceLabel = `이직/퇴사 판단 ${experiment.topic} #${(experiment.sequenceIndex ?? 0) + 1}`;
  const hookByMode: Record<string, string> = {
    self_classification: `${sequenceLabel}: 이직할지 버틸지 모르겠다면, 지금 상태부터 나눠봐.`,
    saveable_tool: `${sequenceLabel}: 저장해둘 3칸 체크가 필요하다면 이 기준부터 봐.`,
    quiet_contrarian: `${sequenceLabel}: 타이밍은 느낌보다 반복 신호에 더 가깝다.`,
    friend_share: `${sequenceLabel}: 같은 고민 중인 친구에게 보낼 기준이 필요하다면.`,
  };
  const closingByMode: Record<string, string> = {
    self_classification: "A/B/C 중 가까운 쪽 하나만 마음속으로 표시해도 선택지가 좁아져.",
    saveable_tool: "저장해두고 다음 선택 전에 다시 봐.",
    quiet_contrarian: "정답을 맞히는 게 아니라 선택지를 좁히는 게 먼저야.",
    friend_share: "비슷한 고민 중인 친구에게 보내줘도 좋아.",
  };
  const hook = hookByMode[modeId] ?? hookByMode.self_classification;
  const closing = closingByMode[modeId] ?? closingByMode.self_classification;
  return {
    post: [
      hook,
      "",
      "A. 버팀형 - 지치긴 했지만 아직 조건을 정리할 게 남아있다.",
      "B. 이동형 - 같은 문제가 반복되고 마음은 이미 밖으로 가 있다.",
      "C. 준비형 - 당장 결론보다 2주 안에 확인할 조건이 먼저다.",
      "",
      closing,
    ].join("\n"),
    firstComment: "저장해두고 다음 선택 전에 다시 봐.",
  };
}

function hasGeneratedMetaText(content: string): boolean {
  return GENERATED_META_PATTERNS.some((pattern) => pattern.test(content));
}

export function enforceGeneratedSurfaceSafety<T extends { pass: boolean; reasons: string[] }>(
  qualityResult: T,
  result: { post: string; firstComment: string }
): T {
  const reasons = [...qualityResult.reasons];
  const surface = [result.post, result.firstComment].join("\n");
  if (hasReplyBurdenPromise(surface) && !reasons.includes("reply-burden CTA 포함")) {
    reasons.unshift("reply-burden CTA 포함");
  }
  if (hasFortuneOverclaim(surface) && !reasons.includes("overclaim 운세/상대 마음 보장 표현 포함")) {
    reasons.unshift("overclaim 운세/상대 마음 보장 표현 포함");
  }
  if (hasGeneratedMetaText(surface) && !reasons.includes("generated meta text 포함")) {
    reasons.unshift("generated meta text 포함");
  }
  return reasons.length === qualityResult.reasons.length
    ? qualityResult
    : { ...qualityResult, pass: false, reasons };
}

async function generateOne(
  experiment: GrowthExperiment,
  config: BrandConfig,
  growthContext: string,
  viralContext: string,
  recentPostContext: string,
  qualityFeedback: string[] = [],
  retries = 5,
  delayMs = 3000
): Promise<{ post: string; firstComment: string }> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const message = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 900,
        temperature: 0.95,
        system: config.systemPrompt,
        messages: [
          {
            role: "user",
            content: buildGenerationPrompt(experiment, config, growthContext, viralContext, recentPostContext, qualityFeedback),
          },
        ],
      });

      const raw = (message.content[0] as { text: string }).text.trim();
      const parts = raw.split(SEPARATOR);
      return {
        post: cleanGeneratedContentLabels(parts[0]),
        firstComment: cleanGeneratedContentLabels(parts[1] ?? ""),
      };
    } catch (err: unknown) {
      const status = typeof err === "object" && err !== null ? (err as { status?: number }).status : undefined;
      if (status !== undefined && RETRYABLE_STATUSES.has(status) && attempt < retries) {
        console.warn(`API ${status} (attempt ${attempt}/${retries}). Retrying in ${delayMs * attempt}ms…`);
        await new Promise((res) => setTimeout(res, delayMs * attempt));
      } else {
        throw err;
      }
    }
  }
  throw new Error("generateOne: exceeded max retries");
}

async function generateWithQuality(
  experiment: GrowthExperiment,
  config: BrandConfig,
  growthContext: string,
  viralContext: string,
  recentPostContext: string,
  maxRetries = 2
): Promise<{
  post: string;
  firstComment: string;
  formulaId: string;
  topic: string;
  targetAudience: string;
  situation: string;
  hookType: string;
  ctaType: string;
  qualityScore: number;
  qualityProfile: QualityProfileId;
  qualityPass: boolean;
  qualityReasons: string[];
  campaignId: string | null;
  campaignFormulaId: string | null;
  careerDecisionType: string | null;
  shouldLink: boolean;
}> {
  let lastResult = await generateOne(experiment, config, growthContext, viralContext, recentPostContext);
  const qualityContext = buildProductQualityContext(config);
  let qualityResult = enforceGeneratedSurfaceSafety(
    checkQuality(lastResult.post, experiment.qualityProfile, qualityContext),
    lastResult
  );

  for (let attempt = 1; attempt <= maxRetries && !qualityResult.pass; attempt++) {
    console.warn(`Quality FAIL (${qualityResult.profile}, score ${qualityResult.score}, attempt ${attempt}/${maxRetries}):`, qualityResult.reasons);
    lastResult = await generateOne(experiment, config, growthContext, viralContext, recentPostContext, qualityResult.reasons);
    qualityResult = enforceGeneratedSurfaceSafety(
      checkQuality(lastResult.post, experiment.qualityProfile, qualityContext),
      lastResult
    );
  }

  if (!qualityResult.pass) {
    console.warn(`Quality FALLBACK: 최대 재시도 초과. profile=${qualityResult.profile}, score=${qualityResult.score}. deterministic fallback 사용.`);
    lastResult = buildQualityFallback(experiment);
    qualityResult = enforceGeneratedSurfaceSafety(
      checkQuality(lastResult.post, experiment.qualityProfile, qualityContext),
      lastResult
    );
  }

  if (!qualityResult.pass) {
    throw new Error(`Quality generation failed: ${qualityResult.reasons.join(", ")}`);
  }

  return {
    post: lastResult.post,
    firstComment: lastResult.firstComment,
    formulaId: experiment.formula.id,
    topic: experiment.topic,
    targetAudience: experiment.targetAudience,
    situation: experiment.situation,
    hookType: experiment.hookType,
    ctaType: experiment.ctaType,
    qualityScore: qualityResult.score,
    qualityProfile: qualityResult.profile,
    qualityPass: qualityResult.pass,
    qualityReasons: qualityResult.reasons,
    campaignId: experiment.campaign?.id ?? null,
    campaignFormulaId: experiment.campaignFormulaId,
    careerDecisionType: qualityResult.careerDecisionType ?? null,
    shouldLink: experiment.shouldLink,
  };
}

function buildExperiment(
  formula: GenerationFormula,
  topic: string,
  config: BrandConfig,
  campaign: CampaignConfig | null,
  index: number,
  viralIntentMode = selectViralIntentMode(index)
): GrowthExperiment {
  const qualityProfile = campaign?.qualityProfile ?? config.qualityProfile ?? "saju_viral";
  const cadence = Math.max(1, campaign?.linkCadenceEvery ?? 1);
  const defaultCtaTypes = qualityProfile === "career_decision"
    ? ["셀프체크", "저장 유도", "공유 유도", "프로필 확인"]
    : ["링크 확인", "저장 유도", "공유 유도", "프로필 확인"];
  const ctaTypeCandidates = (config.ctaTypes?.length ? config.ctaTypes : defaultCtaTypes)
    .filter((ctaType) => !hasReplyBurdenPromise(ctaType));
  const ctaTypes = ctaTypeCandidates.length ? ctaTypeCandidates : defaultCtaTypes;
  return {
    formula,
    topic,
    targetAudience: pickRandom(config.targets.length ? config.targets : ["일반 독자"]),
    situation: pickRandom(config.situations.length ? config.situations : ["일상적인 상황"]),
    hookType: pickRandom(config.hookTypes?.length ? config.hookTypes : ["공감형 훅"]),
    ctaType: pickRandom(ctaTypes),
    viralIntentMode,
    qualityProfile,
    campaign,
    campaignFormulaId: campaign ? viralIntentMode.id : null,
    shouldLink: campaign ? index % cadence === 0 : Boolean(config.websiteUrl.trim()),
    sequenceIndex: index,
  };
}

export function buildGenerationPrompt(
  experiment: GrowthExperiment,
  config: BrandConfig,
  growthContext: string,
  viralContext: string,
  recentPostContext = "최근 생성 글 없음. 같은 첫 문장/같은 구조/같은 결론 반복은 피한다.",
  qualityFeedback: string[] = []
): string {
  const creatorPatternContext = formatCreatorPatternContext(experiment.hookType, experiment.ctaType);
  const viralIntentMode = experiment.viralIntentMode
    ?? resolveViralIntentMode(experiment.campaignFormulaId ?? experiment.formula.id, 0);

  return [
    `[공식: ${experiment.formula.name}]`,
    experiment.formula.instruction,
    "",
    ...formatProductPrompt(config),
    ...formatCampaignPrompt(experiment),
    formatViralIntentModePrompt(viralIntentMode),
    "[Threads 길이 제한]",
    `- 본문은 공백과 줄바꿈을 포함해 반드시 ${THREADS_CONTENT_MAX_LENGTH}자 이하로 작성한다.`,
    `- 권장 본문 길이는 ${THREADS_CONTENT_TARGET_LENGTH}자 이하이며, 길면 예시와 수식어를 줄인다.`,
    `- ${THREADS_CONTENT_MAX_LENGTH}자를 넘으면 품질 실패로 처리되어 업로드할 수 없다.`,
    "- 첫 댓글은 구분자 아래에 별도로 짧게 작성한다.",
    "- 첫 댓글은 질문형으로 끝내지 말고 저장, 프로필 확인, 공유 안내로만 쓴다.",
    "- 글자 수 확인, 자수 체크, 초안, Threads 본문 같은 메타 텍스트를 절대 출력하지 않는다.",
    `[주제]\n${experiment.topic}`,
    `[타겟 독자]\n${experiment.targetAudience}`,
    `[상황/맥락]\n${experiment.situation}`,
    `[훅 유형]\n${experiment.hookType}`,
    `[CTA 유형]\n${experiment.ctaType}`,
    `[이번 글 변주]\n각도: ${experiment.angleVariation ?? viralIntentMode.label}\n구조: ${experiment.structureVariation ?? viralIntentMode.instruction}`,
    ...(creatorPatternContext ? [creatorPatternContext] : []),
    `[성과 학습 메모리]\n${growthContext}`,
    `[바이럴 레퍼런스 학습 메모리]\n${viralContext}`,
    `[최근 생성 글 회피]\n${recentPostContext}`,
    ...formatQualityFeedback(qualityFeedback),
    "",
    `위 실험 조건을 조합해서 ${THREADS_CONTENT_MAX_LENGTH}자 이하 Threads 포스트 1개를 작성해줘. 작성 후 ${SEPARATOR} 를 출력하고, 바로 아래에 첫 댓글을 작성해줘.`,
    "본문과 첫 댓글에 실제 URL은 쓰지 마. 시스템이 저장 후 필요한 경우 UTM 링크를 붙인다.",
  ].join("\n");
}

function formatRecentPostContext(posts: RecentPostForPrompt[]): string {
  if (posts.length === 0) {
    return "최근 생성 글 없음. 단, 같은 첫 문장/같은 구조/같은 결론 반복은 피한다.";
  }
  return [
    "아래 최근 글과 첫 문장, 전개 구조, 예시, 결론 문장을 반복하지 않는다.",
    "같은 주제를 쓰더라도 다른 각도와 다른 문장 리듬으로 작성한다.",
    ...posts.map((post, index) => (
      `${index + 1}. ${post.content.slice(0, 120).replace(/\s+/g, " ")}`
    )),
  ].join("\n");
}

function formatProductPrompt(config: BrandConfig): string[] {
  const profile = config.productProfile;
  const experiment = config.activeExperiment;
  return [
    "[제품 프로필]",
    `제품명: ${profile.productName}`,
    `한 줄 설명: ${profile.oneLineDescription || "미설정"}`,
    `타깃 고객: ${profile.targetCustomer || "미설정"}`,
    `오퍼 약속: ${profile.offerPromise || "미설정"}`,
    `랜딩 URL: ${profile.landingUrl || config.websiteUrl || "미설정"}`,
    `주요 채널: ${profile.primaryChannel}`,
    `핵심 지표: ${profile.primaryMetric}`,
    `전환 지표: ${profile.conversionMetric}`,
    `포지셔닝 메모: ${profile.positioningNotes || "미설정"}`,
    "[현재 실험]",
    `실험명: ${experiment.name}`,
    `가설: ${experiment.hypothesis}`,
    `단계: ${experiment.stage}`,
    `기간: ${experiment.durationDays}일`,
    `핵심 지표: ${experiment.primaryMetric}`,
    `가드레일: ${experiment.guardrailMetric}`,
    `상태: ${experiment.status}`,
    "",
  ];
}

function buildProductQualityContext(config: BrandConfig) {
  const profile = config.productProfile;
  return {
    productName: profile.productName,
    productKeywords: [
      profile.productName,
      profile.oneLineDescription,
      profile.targetCustomer,
      profile.offerPromise,
      ...config.topics,
    ].filter((value) => value.trim().length > 0),
    ctaTerms: ["확인", "랜딩", "링크", "프로필", profile.conversionMetric],
  };
}

function formatCampaignPrompt(experiment: GrowthExperiment): string[] {
  if (!experiment.campaign) return [];
  const campaignExperiment = { ...experiment, campaign: experiment.campaign };
  if (experiment.qualityProfile === "career_decision") return formatCareerCampaignPrompt(campaignExperiment);
  if (experiment.qualityProfile === "product_growth") return formatProductGrowthCampaignPrompt(campaignExperiment);
  return [
    `[캠페인]\n${campaignExperiment.campaign.name} (${campaignExperiment.campaign.id})`,
    `[품질 프로필]\n${experiment.qualityProfile}`,
    `[링크 정책]\n${experiment.shouldLink ? "이번 글은 첫 댓글에 링크가 붙을 예정이므로 CTA를 자연스럽게 작성" : "이번 글은 링크 없이 저장/공유/프로필 방문만 유도"}`,
    "",
  ];
}

function formatCareerCampaignPrompt(experiment: CampaignGrowthExperiment): string[] {
  return [
    `[캠페인]\n${experiment.campaign.name} (${experiment.campaign.id})`,
    `[품질 프로필]\n${experiment.qualityProfile}`,
    "[중요: 캠페인 예외]",
    "- 이 캠페인은 더 이상 댓글 자기분류 실험이 아니다.",
    "- 댓글을 요구하지 말고 본문 안에서 독자가 혼자 체크/저장/공유할 수 있게 만든다.",
    "- 개인 질문 접수, 답글 약속, 무료 풀이 약속 금지.",
    "- 장문 사연 요청 금지.",
    "- 개인별 검토를 암시하는 CTA 금지. 선택지는 댓글이 아니라 본문 안에서 혼자 고르게 한다.",
    "- A/B/C, 버팀형/이동형/준비형, 연락/대기/축소/보류처럼 사용자가 스스로 고르는 구조로 쓴다.",
    "- '댓글', '남겨', '답글', '상황 써줘', '같이 보자', '같이 봐요', '뭐가 걸렸어', '어디였어' 표현 금지.",
    "[커리어 wedge 필수 조건]",
    "- 첫 줄은 반드시 이직/퇴사/버틸지/옮길지/번아웃/월급 현타/동기보다 뒤처짐 중 하나의 커리어 불안으로 시작",
    "- 장문 사연 접수나 댓글 선택 유도 없이 자기 상태에 가까운 선택지를 본문에서 고르게 만들기",
    "- 본문 후반에 버팀형/이동형/준비형 또는 A/B/C 분류 프레임을 명확히 넣기",
    "- '좋은 일이 올 거예요' 같은 generic 자기계발 문장 금지",
    "- 사주 전문용어를 억지로 넣지 말고, 타이밍/흐름/성향/결정 패턴 정도로 CosmicPath 결을 유지",
    "- 마지막 2줄 안에 저장 CTA, 프로필 확인 CTA, 또는 친구 공유 CTA를 넣기",
    `[링크 정책]\n${experiment.shouldLink ? "이번 글은 첫 댓글에 링크가 붙을 예정이므로 프로필/리포트 확인 CTA를 자연스럽게 작성" : "이번 글은 링크 없이 저장/공유/프로필 방문만 유도"}`,
    "",
  ];
}

function formatProductGrowthCampaignPrompt(experiment: CampaignGrowthExperiment): string[] {
  return [
    `[캠페인]\n${experiment.campaign.name} (${experiment.campaign.id})`,
    `[품질 프로필]\n${experiment.qualityProfile}`,
    "[제품 성장 필수 조건]",
    "- 첫 줄은 타깃 고객의 구체적인 문제, 비용, 시간 낭비, 망설임, 또는 반복 작업에서 시작",
    "- 제품명/제품 카테고리/오퍼 약속 중 하나를 본문 안에 자연스럽게 포함",
    "- 추상적인 자기계발 문장이 아니라 실제 제품 사용 전후 차이를 보여주기",
    "- 링크 확인, 프로필 방문, 신청, 가입, 저장, 공유 중 하나의 명확한 행동을 넣기",
    "- 댓글 CTA를 쓰지 말고 A/B/C 선택, 숫자 선택, 체크리스트 자기분류는 본문 안에서 셀프체크로 완결",
    "- 운영자가 답글을 달아야 성립하는 CTA 금지",
    "- 개인 질문 접수, 답글 약속, 무료 풀이 약속 금지.",
    "- 장문 사연 요청 금지.",
    "- 개인별 검토를 암시하는 CTA 금지.",
    "- 특정 제품과 무관한 generic 동기부여 문장 금지",
    `[링크 정책]\n${experiment.shouldLink ? "이번 글은 첫 댓글에 링크가 붙을 예정이므로 제품 확인 CTA를 자연스럽게 작성" : "이번 글은 링크 없이 저장/공유/프로필 방문만 유도"}`,
    "",
  ];
}

function formatQualityFeedback(qualityFeedback: string[]): string[] {
  if (qualityFeedback.length === 0) return [];
  return [
    "",
    "[품질 게이트 실패 이유 - 이번 재작성에서 반드시 수정]",
    ...qualityFeedback.map((reason) => `- ${reason}`),
  ];
}

function buildLegacyFormula(formula: { id: string; name: string; weight: number; instruction: string }): GenerationFormula {
  return formula;
}

export function validateGenerationReadiness(
  config: BrandConfig,
  activeCampaign: CampaignConfig | null,
  dbWeights: Record<string, number> = {},
  approvedCampaignStart = false
): string | null {
  if (!config.formulas.length && !activeCampaign?.formulas.length) {
    return "제품에 공식이 설정되지 않았습니다. 제품 설정에서 formulas를 추가하세요.";
  }
  if (!config.systemPrompt) {
    return "제품에 시스템 프롬프트가 설정되지 않았습니다.";
  }

  const sourceFormulas = activeCampaign
    ? activeCampaign.formulas
    : config.formulas.map(buildLegacyFormula);
  const formulaPool = buildFormulaPool(sourceFormulas, activeCampaign ? {} : dbWeights);
  if (formulaPool.length === 0) {
    return "공식 가중치가 모두 0입니다. 제품 설정을 확인하세요.";
  }
  const allTopics = [...config.topics, ...(config.trendingTopics ?? [])];
  if (allTopics.length === 0) {
    return "토픽이 없습니다. 제품 설정에서 주제 또는 트렌딩 토픽을 추가하세요.";
  }
  if (activeCampaign?.qualityProfile === "product_growth" || config.qualityProfile === "product_growth") {
    return validateProductGrowthCampaignReadiness(config, activeCampaign, approvedCampaignStart);
  }
  return null;
}

function validateProductGrowthCampaignReadiness(
  config: BrandConfig,
  activeCampaign: CampaignConfig | null,
  approvedCampaignStart: boolean
): string | null {
  const profile = config.productProfile;
  if (!profile.oneLineDescription) return "제품 한 줄 설명이 필요합니다.";
  if (!profile.targetCustomer) return "타깃 고객이 필요합니다.";
  if (!profile.offerPromise) return "오퍼 약속이 필요합니다.";
  if (!profile.landingUrl || !isValidCampaignLandingUrl(profile.landingUrl)) {
    return "제품 랜딩 URL 형식이 필요합니다.";
  }
  if (!activeCampaign?.landingUrl || !isValidCampaignLandingUrl(activeCampaign.landingUrl)) {
    return "캠페인 랜딩 URL 형식이 필요합니다.";
  }
  if (config.activeExperiment.status !== "active") return "제품 실험 상태가 active가 아닙니다.";
  if (!approvedCampaignStart) return "캠페인 시작 승인이 필요합니다.";
  return null;
}

export function buildCampaignUtmLink(websiteUrl: string, campaign: CampaignConfig, postId: string): { url: string; utmContent: string } | null {
  const utmContent = campaign.utmContentTemplate === "{{postId}}" ? postId : postId;
  const landingUrl = campaign.landingUrl.trim();
  if (!landingUrl) return null;
  const params = new URLSearchParams({
    utm_source: campaign.utmSource,
    utm_campaign: campaign.utmCampaign,
    utm_content: utmContent,
  });

  if (/^https?:\/\//.test(landingUrl)) {
    const url = new URL(landingUrl);
    for (const [key, value] of params) url.searchParams.set(key, value);
    return { url: url.toString(), utmContent };
  }

  const normalized = /^https?:\/\//.test(websiteUrl) ? websiteUrl : `https://${websiteUrl}`;
  try {
    if (websiteUrl.trim()) {
      const url = new URL(landingUrl.startsWith("/") ? landingUrl : `/${landingUrl}`, normalized);
      for (const [key, value] of params) url.searchParams.set(key, value);
      return { url: url.toString(), utmContent };
    }
  } catch {
    return null;
  }
  return { url: `${landingUrl}${landingUrl.includes("?") ? "&" : "?"}${params.toString()}`, utmContent };
}

function appendFirstCommentLink(firstComment: string, linkUrl: string): string {
  return [firstComment.trim(), `→ ${linkUrl}`].filter(Boolean).join("\n\n");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { brandId?: unknown; count?: unknown; insertAtFront?: unknown; campaignId?: unknown; approvedCampaignStart?: unknown };
    const brandId = typeof body.brandId === "string" ? body.brandId : null;
    const count = typeof body.count === "number" ? body.count : 30;
    const insertAtFront = body.insertAtFront === true;
    const requestedCampaignId = typeof body.campaignId === "string" ? body.campaignId : null;
    const approvedCampaignStart = body.approvedCampaignStart === true;

    if (!brandId) {
      return NextResponse.json({ error: "brandId is required" }, { status: 400 });
    }
    if (count < 1 || count > 300) {
      return NextResponse.json({ error: "count는 1~300 사이여야 합니다" }, { status: 400 });
    }

    const { brand } = await requireBrandForCurrentUser(brandId);

    const config = parseBrandConfig(brand.brandConfig);
    const activeCampaign = getActiveCampaign(config, requestedCampaignId);
    const dbWeights = JSON.parse(brand.formulaWeights) as Record<string, number>;
    const readinessError = validateGenerationReadiness(config, activeCampaign, dbWeights, approvedCampaignStart);
    if (readinessError) {
      return NextResponse.json({ error: readinessError }, { status: 400 });
    }
    const sourceFormulas = activeCampaign
      ? activeCampaign.formulas
      : config.formulas.map(buildLegacyFormula);
    const formulaPool = buildFormulaPool(sourceFormulas, activeCampaign ? {} : dbWeights);
    const allTopics = [...config.topics, ...(config.trendingTopics ?? [])];
    const topics = shuffleTopics(allTopics, count);
    const growthContext = formatGrowthPromptContext(parseStoredGrowthMemory(brand.growthMemory));
    const viralContext = formatViralPromptContext(parseViralMemory(brand.viralMemory));
    const recentPosts = await prisma.post.findMany({
      where: { brandId },
      orderBy: { createdAt: "desc" },
      take: RECENT_POST_AVOIDANCE_COUNT,
      select: {
        content: true,
        topic: true,
        hookType: true,
        ctaType: true,
        campaignFormulaId: true,
      },
    });
    const recentPostContext = formatRecentPostContext(recentPosts);

    const BATCH = 3;
    const BATCH_COOLDOWN = 500;
    const results: Awaited<ReturnType<typeof generateWithQuality>>[] = [];

    for (let i = 0; i < count; i += BATCH) {
      const batch = Array.from({ length: Math.min(BATCH, count - i) }, (_, j) => {
        const viralIntentMode = selectViralIntentMode(i + j);
        const formula = activeCampaign
          ? selectCampaignFormulaForViralMode(sourceFormulas, viralIntentMode)
          : pickRandom(formulaPool);
        const topic = topics[i + j];
        const experiment = buildExperiment(formula, topic, config, activeCampaign, i + j, viralIntentMode);
        return generateWithQuality(experiment, config, growthContext, viralContext, recentPostContext);
      });
      results.push(...await Promise.all(batch));
      if (i + BATCH < count) {
        await new Promise((res) => setTimeout(res, BATCH_COOLDOWN));
      }
    }

    const now = Date.now();
    let baseTime = now;
    if (insertAtFront) {
      const earliest = await prisma.post.findFirst({
        where: { status: "PENDING", brandId },
        orderBy: { scheduledAt: "asc" },
      });
      if (earliest && earliest.scheduledAt.getTime() > now) {
        baseTime = Math.max(now, earliest.scheduledAt.getTime() - count * 1000);
      }
    } else {
      const latest = await prisma.post.findFirst({
        where: { status: "PENDING", brandId },
        orderBy: { scheduledAt: "desc" },
      });
      if (latest && latest.scheduledAt.getTime() > now) {
        baseTime = latest.scheduledAt.getTime() + 1000;
      }
    }

    let linkedCount = 0;
    const createdPosts = [];
    for (const [index, result] of results.entries()) {
      const post = await prisma.post.create({
        data: {
          brandId,
          content: result.post,
          firstComment: result.firstComment || null,
          imageUrls: "[]",
          scheduledAt: new Date(baseTime + index * 1000),
          status: "PENDING",
          formulaId: result.formulaId,
          topic: result.topic,
          targetAudience: result.targetAudience,
          situation: result.situation,
          hookType: result.hookType,
          ctaType: result.ctaType,
          qualityScore: result.qualityScore,
          qualityProfile: result.qualityProfile,
          qualityPass: result.qualityPass,
          qualityReasons: JSON.stringify(result.qualityReasons),
          campaignId: result.campaignId,
          campaignFormulaId: result.campaignFormulaId,
          careerDecisionType: result.careerDecisionType,
        },
      });

      if (result.shouldLink && activeCampaign) {
        const utm = buildCampaignUtmLink(config.websiteUrl, activeCampaign, post.id);
        if (utm) {
          linkedCount++;
          createdPosts.push(await prisma.post.update({
            where: { id: post.id },
            data: {
              firstComment: appendFirstCommentLink(result.firstComment, utm.url),
              linkUrl: utm.url,
              utmContent: utm.utmContent,
            },
          }));
          continue;
        }
      }
      createdPosts.push(post);
    }

    return NextResponse.json({
      success: true,
      count: createdPosts.length,
      linkedCount,
      campaignId: activeCampaign?.id ?? null,
    });
  } catch (error) {
    const response = accessErrorResponse(error);
    if (response) return response;
    console.error("Generate error:", error);
    return NextResponse.json({ error: "생성 실패" }, { status: 500 });
  }
}
