import { formatCreatorPatternContext } from "@/lib/creator-prompt-patterns";
import {
  formatMarketingSkillsPrompt,
  type HookArchetype,
  type ContentPillar,
} from "@/lib/marketing-skills";
import { getDomainPreset } from "@/lib/domain-registry";
import {
  THREADS_CONTENT_MAX_LENGTH,
  THREADS_CONTENT_TARGET_LENGTH,
  THREADS_MULTI_PART_MAX_LENGTH,
} from "@/lib/threads-limits";
import { isValidCampaignLandingUrl } from "@/lib/product-auto-setup";
import { type QualityResult } from "@/lib/quality-gate";
import {
  formatViralIntentModePrompt,
  hasFortuneOverclaim,
  hasReplyBurdenPromise,
  resolveViralIntentMode,
  type ViralIntentMode,
} from "@/lib/viral-intent-modes";
import type { BrandConfig, CampaignConfig, QualityProfileId } from "@/types/brand";

export const GENERATED_META_PATTERNS = [
  /자수\s*체크/,
  /글자\s*수\s*확인/,
  /공백[·\s]*줄바꿈.*포함/,
  /500자\s*이하\s*통과/,
  /Threads\s*본문/,
  /초안\s*작성/,
];

export interface GenerationFormula {
  id: string;
  name: string;
  weight: number;
  instruction: string;
}

export interface GrowthExperiment {
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

export type CampaignGrowthExperiment = GrowthExperiment & { campaign: CampaignConfig };

export type RecentPostForPrompt = {
  content: string;
  topic: string | null;
  hookType: string | null;
  ctaType: string | null;
  campaignFormulaId: string | null;
};

export function buildFormulaPool(
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


export function hasGeneratedMetaText(content: string): boolean {
  return GENERATED_META_PATTERNS.some((pattern) => pattern.test(content));
}

export function enforceGeneratedSurfaceSafety<T extends QualityResult>(
  qualityResult: T,
  result: { post: string; firstComment: string }
): T {
  const reasons = [...qualityResult.reasons];
  const surface = [result.post, result.firstComment].join("\n");
  if (result.post.length > THREADS_MULTI_PART_MAX_LENGTH && !reasons.some((r) => r.includes("2400자") || r.includes("제한 초과"))) {
    reasons.unshift(`본문 ${result.post.length}자 - 5단 스레드 최대 허용(2,400자) 초과`);
  }
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

export function ensureMaxThreadsLength(content: string): string {
  if (content.length <= THREADS_MULTI_PART_MAX_LENGTH) return content;
  const lines = content.trim().split("\n");
  const lastLine = lines[lines.length - 1];
  const isHashtag = lastLine.startsWith("#");
  const hashtagSuffix = isHashtag ? "\n\n" + lastLine : "";
  const bodyText = isHashtag ? lines.slice(0, -1).join("\n") : content;
  const maxBodyLen = THREADS_MULTI_PART_MAX_LENGTH - hashtagSuffix.length;

  if (bodyText.length > maxBodyLen) {
    const truncated = bodyText.slice(0, maxBodyLen);
    const lastSentenceEnd = Math.max(
      truncated.lastIndexOf(". "),
      truncated.lastIndexOf(".\n"),
      truncated.lastIndexOf("? "),
      truncated.lastIndexOf("?\n"),
      truncated.lastIndexOf("! "),
      truncated.lastIndexOf("!\n")
    );
    if (lastSentenceEnd > 250) {
      return truncated.slice(0, lastSentenceEnd + 1).trim() + hashtagSuffix;
    }
    return truncated.trim() + hashtagSuffix;
  }
  return content;
}

export function mapToHookArchetype(hookType: string, sequenceIndex: number): HookArchetype {
  const lower = hookType.toLowerCase();
  if (lower.includes("호기심") || lower.includes("curiosity")) return "curiosity";
  if (lower.includes("스토리") || lower.includes("경험") || lower.includes("story")) return "story";
  if (lower.includes("가치") || lower.includes("체크리스트") || lower.includes("숫자") || lower.includes("value")) return "value";
  if (lower.includes("반전") || lower.includes("상식") || lower.includes("역발상") || lower.includes("contrarian")) return "contrarian";
  const archetypes: HookArchetype[] = ["curiosity", "value", "contrarian", "story"];
  return archetypes[sequenceIndex % archetypes.length];
}

export function selectPillarForIndex(sequenceIndex: number): ContentPillar {
  const pillars: ContentPillar[] = ["insight", "education", "story", "opinion", "promotion"];
  return pillars[sequenceIndex % pillars.length];
}

export function formatProductPrompt(config: BrandConfig): string[] {
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

export function buildProductQualityContext(config: BrandConfig) {
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

export function formatCareerCampaignPrompt(experiment: CampaignGrowthExperiment): string[] {
  return [
    `[캠페인]\n${experiment.campaign.name} (${experiment.campaign.id})`,
    `[품질 프로필]\n${experiment.qualityProfile}`,
    "[작성 가이드: 날것의 스토리텔링과 자연스러운 참여 유도]",
    "- 설명충 같은 훈계조나 사주 이론 강의(표준시 30분 왜곡, 타로 폐기 등)를 절대 반복하지 않는다.",
    "- 기질-조직 미스매치(식상 vs 관성), 10년 대운 교운기 번아웃 리스크, 단일 사주 맹점 등 실전 의사결정 팩트를 날것의 독백체로 쓴다.",
    "- 친구나 본인의 실제 관찰 썰, 직장인들의 소름 돋는 현실 딜레마를 100% 반말/독백체(~임, ~했음, ~있냐)로 쓴다.",
    "- 절대 금지 어휘: '심리적 자유', '타이밍 손실 리스크', '리스크', '손익', '시나리오', '골든타임', '의사결정', '데이터상' 등 기획서/보고서용 단어 절대 사용 금지.",
    "- 상황 표현: '통장 잔고', '카드값', '화병', '멘탈', '속 시원함', '존버' 같은 날것의 일상 구어로만 쓸 것.",
    "- 댓글 강요 대신, 글 말미에 독자가 본인의 상황을 스스로 점검할 수 있는 3가지 선택 프레임(예: 'A. 버팀형 / B. 이동형 / C. 준비형 중 어디에 가까운지 체크해' 또는 '1. 버티기 2. 이직 3. 준비 중 어느 쪽인지 저장해두고 봐')을 명확한 셀프체크/행동선으로 제시하여 마무리한다.",
    "- 첫 줄은 진로/이직/퇴사/인간관계/돈에 대한 솔직한 관찰이나 반전으로 시작한다.",
    "- '좋은 일이 올 거예요' 같은 뻔한 위로 문장을 쓰지 않는다.",
    `[링크 정책]\n${experiment.shouldLink ? "이번 글은 첫 댓글에 링크가 붙을 예정이므로 자연스럽게 연결" : "이번 글은 링크 없이 저장/공유/프로필 확인 유도"}`,
    "",
  ];
}

export function formatProductGrowthCampaignPrompt(experiment: CampaignGrowthExperiment): string[] {
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

export function formatCampaignPrompt(experiment: GrowthExperiment): string[] {
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

export function formatQualityFeedback(qualityFeedback: string[]): string[] {
  if (qualityFeedback.length === 0) return [];
  return [
    "",
    "[품질 게이트 실패 이유 - 이번 재작성에서 반드시 수정]",
    ...qualityFeedback.map((reason) => `- ${reason}`),
  ];
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
  const marketingSkillsContext = experiment.qualityProfile === "product_growth"
    ? formatMarketingSkillsPrompt({
        hookArchetype: mapToHookArchetype(experiment.hookType, experiment.sequenceIndex ?? 0),
        pillar: selectPillarForIndex(experiment.sequenceIndex ?? 0),
      })
    : null;

  const domainPreset = getDomainPreset(experiment.qualityProfile);
  const crossDomainGuardrails = domainPreset.forbiddenCrossDomainTerms.length > 0
    ? [
        "[금지된 도메인 교차 용어 (Cross-Domain Safety Guardrail)]",
        `- 다음 단어/개념은 다른 도메인 용어이므로 본문과 댓글에 절대 포함해서는 안 됩니다: ${domainPreset.forbiddenCrossDomainTerms.join(", ")}`,
        "",
      ]
    : [];

  return [
    `[공식: ${experiment.formula.name}]`,
    experiment.formula.instruction,
    "",
    ...formatProductPrompt(config),
    ...formatCampaignPrompt(experiment),
    formatViralIntentModePrompt(viralIntentMode),
    ...(marketingSkillsContext ? [marketingSkillsContext] : []),
    ...crossDomainGuardrails,
    "[Threads 길이 제한 및 Charlie Hills 바이럴 구조]",
    `- 본문은 공백과 줄바꿈을 포함해 반드시 ${THREADS_CONTENT_MAX_LENGTH}자 이하로 작성한다.`,
    `- 권장 본문 길이는 ${THREADS_CONTENT_TARGET_LENGTH}자 이하이며, 길면 예시와 수식어를 줄인다.`,
    `- ${THREADS_CONTENT_MAX_LENGTH}자를 넘으면 품질 실패로 처리되어 업로드할 수 없다.`,
    "- [Charlie Hills 2-Line Contrast Hook]: 첫 문장은 40자 이내의 대담한 단언(Opening)으로 시작하고, 바로 다음 줄은 40자 이내의 반전/대립각(Contrast)으로 상식을 뒤집는다.",
    "- [Single-Point Razor]: 원문이나 여러 주제를 요약/나열하지 말고, 상식을 뒤집는 단 하나의 반직관적 주장(Contrarian Insight)에만 모든 문장을 집중할 것.",
    "- [Focused Conflict]: 타겟과 상황에 제시된 페르소나의 실전 마찰 1개만 깊게 파고들고, 여러 갈등이나 딜레마를 백화점식으로 나열하지 말 것.",
    "- [No Factual Hallucination]: 프롬프트에 제공되지 않은 가짜 개인 일화나 날조된 매출/사례 숫자를 지어내지 말고, 구조적 관찰과 냉철한 논리로 설득할 것.",
    "- 첫 댓글은 구분자 아래에 별도로 솔직 고백형(4-line admission: 고백 + 셀프디스 + 작은 가치안내 + 수용)으로 작성한다.",
    "- 글자 수 확인, 자수 체크, 초안, Threads 본문 같은 메타 텍스트를 절대 출력하지 않는다.",
    ...(config.voiceProfile ? [
      `[브랜드 고유 보이스 (Voice Profile)]`,
      `- 톤: ${config.voiceProfile.tone}`,
      `- 화자 관점: ${config.voiceProfile.perspective}`,
      `- 문장 길이/호흡: ${config.voiceProfile.sentenceLength} / ${config.voiceProfile.paragraphStyle}`,
      ...(config.voiceProfile.forbiddenPhrases.length ? [`- 금지 어조: ${config.voiceProfile.forbiddenPhrases.join(", ")}`] : []),
    ] : []),
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
    `위 실험 조건을 조합해서 ${THREADS_CONTENT_MAX_LENGTH}자 이하 Threads 포스트 1개를 작성해줘. 작성 후 ===FIRST_COMMENT=== 를 출력하고, 바로 아래에 첫 댓글을 작성해줘.`,
    "본문과 첫 댓글에 실제 URL은 쓰지 마. 시스템이 저장 후 필요한 경우 UTM 링크를 붙인다.",
  ].join("\n");
}

export function buildLegacyFormula(formula: { id: string; name: string; weight: number; instruction: string }): GenerationFormula {
  return formula;
}

export function validateProductGrowthCampaignReadiness(
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

export function buildCampaignUtmLink(
  websiteUrl: string,
  campaign: CampaignConfig,
  postId: string
): { url: string; utmContent: string } | null {
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
