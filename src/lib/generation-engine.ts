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
  ENGLISH_VIRAL_MODE_LABELS,
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
    // Remove markdown headers like "# 제목 - Threads Post" or "## Threads 본문"
    .replace(/^\s*#+\s*[^#\n]+(?:Threads\s*Post|스레드\s*포스트|본문|초안)[^\n]*\n+(?:---\s*\n+)?/i, "")
    // Remove leading labels like [본문], **본문**, Threads 본문:
    .replace(/^\s*(?:#+\s*)?(?:\*\*)?(?:\[)?(?:Threads\s*)?(?:본문|포스트|Post|첫\s*댓글)(?:\s*(?:내용|초안|시작|예약됨?))?(?:\s*[-:：][^\]\n]*)?(?:\])?(?:\*\*)?\s*[:：]?\s*/i, "")
    .replace(/^\s*(?:#+\s*)?(?:\*\*)?(?:Threads\s*)?(?:본문|포스트|Post|첫\s*댓글)(?:\s*(?:내용|초안|시작|예약됨?))?(?:\*\*)?\s*[:：]?\s*/i, "")
    .replace(/^#+\s*(?:본문|Threads\s*본문|Threads\s*포스트|Threads\s*Post|첫\s*댓글)[^\n]*\n+/i, "")
    // Remove trailing generation checklist/metadata sections
    .replace(/\n\s*---\s*\n+\s*(?:\*\*)?(?:생성\s*완료|자수|포맷|훅\s*유형|규격|체크리스트|검증)[\s\S]*$/i, "")
    // Remove trailing horizontal rule
    .replace(/\n+\s*---\s*$/i, "")
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
  const isEnglish =
    config.voiceProfile?.language === "en" ||
    Boolean(profile.productName?.toLowerCase().includes("global"));

  if (isEnglish) {
    return [
      "[Product Profile]",
      `Product Name: ${profile.productName}`,
      `Description: ${profile.oneLineDescription || "Not set"}`,
      `Target Customer: ${profile.targetCustomer || "Not set"}`,
      `Offer Promise: ${profile.offerPromise || "Not set"}`,
      `Landing URL: ${profile.landingUrl || config.websiteUrl || "Not set"}`,
      `Primary Channel: ${profile.primaryChannel}`,
      `Primary Metric: ${profile.primaryMetric}`,
      `Conversion Metric: ${profile.conversionMetric}`,
      `Positioning Notes: ${profile.positioningNotes || "Not set"}`,
      "[Current Experiment]",
      `Experiment Name: ${experiment.name}`,
      `Hypothesis: ${experiment.hypothesis}`,
      `Stage: ${experiment.stage}`,
      `Duration: ${experiment.durationDays} days`,
      `Primary Metric: ${experiment.primaryMetric}`,
      `Guardrail: ${experiment.guardrailMetric}`,
      `Status: ${experiment.status}`,
      "",
    ];
  }

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
    "- 댓글 강요 대신, 글 말미에 독자가 본인의 상황을 스스로 점검할 수 있는 3가지 선택 프레임(예: 'A. 버팀형 / B. 이동형 / C. 준비형 중 어디에 가까운지 체크해' 또는 '7대 엔진 감사표: 1단계~5단계 체크 후 기준 삼아봐')을 명확한 셀프체크/행동선으로 제시하여 마무리한다.",
    "- 모듈러 감사형(modular_audit)인 경우: 1~5단계는 자가진단 기준을 명확히 주고, 6~7단계(손절선/탈출 윈도우)는 첫 댓글 링크를 통해 정밀 진단받도록 결핍 구조를 유지한다.",
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

export function formatQualityFeedback(qualityFeedback: string[], isEnglish = false): string[] {
  if (qualityFeedback.length === 0) return [];
  return [
    "",
    isEnglish ? "[Quality Gate Feedback - Must fix on retry]" : "[품질 게이트 실패 이유 - 이번 재작성에서 반드시 수정]",
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
  const isEnglish =
    experiment.qualityProfile === "ecommerce_d2c" ||
    config.voiceProfile?.language === "en" ||
    Boolean(config.productProfile?.productName?.toLowerCase().includes("global"));

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
        isEnglish ? "[Cross-Domain Safety Guardrails]" : "[금지된 도메인 교차 용어 (Cross-Domain Safety Guardrail)]",
        isEnglish
          ? `- Do not include any of these forbidden terms or concepts in the post or comment: ${domainPreset.forbiddenCrossDomainTerms.join(", ")}`
          : `- 다음 단어/개념은 다른 도메인 용어이므로 본문과 댓글에 절대 포함해서는 안 됩니다: ${domainPreset.forbiddenCrossDomainTerms.join(", ")}`,
        "",
      ]
    : [];

  const languageMandate = isEnglish
    ? [
        "[CRITICAL LANGUAGE MANDATE - ABSOLUTE REQUIREMENT]",
        "- The entire output MUST be written strictly in fluent, natural English (US/UK English).",
        "- ZERO Korean characters (Hangul / 가-힣) are allowed anywhere in the post body or the first comment.",
        "- Both the main Threads post and the first comment must be 100% native, compelling English.",
        "",
      ]
    : [];

  const viralRules = isEnglish
    ? [
        "[Threads Viral Compression & High-Retention Hook Rules]",
        `- Target body length: ~${THREADS_CONTENT_TARGET_LENGTH} chars (approx 35-55 words / max ${THREADS_CONTENT_MAX_LENGTH} chars). Highly compressed and punchy.`,
        "- Hook within the first 100 characters before the feed fold. Stop the scroll instantly. No boring preamble, no lectures, no bullet lists.",
        "- [Charlie Hills 2-Line Contrast Hook]: Line 1 is a bold provocative assertion (<40 chars). Line 2 immediately delivers a counter-intuitive twist/contrast (<40 chars) shattering conventional wisdom.",
        "- [Single-Point Razor]: Focus on ONE contrarian insight. Never summarize or list multiple unfocused ideas.",
        "- [Focused Conflict]: Zero in on one specific persona friction and internal conflict.",
        "- [Zero-in-body URL]: Never place links or URLs inside the post body.",
        "- [Zero AI Slop]: Avoid cliché patterns like 'Here is the truth', 'Imagine if', 'Let's dive in', or checkbox emojis.",
        "- [Zero-Promo Conversation Igniter First Comment]: Below the delimiter (===FIRST_COMMENT===), write 1-2 lines of an honest personal confession / admission or a raw provocative question that compels readers to reply. Never write sales pitches or spam links in the first comment.",
        "- [Strictly No Meta Text]: Never output character counts, draft labels, headers (# Title), or explanations.",
      ]
    : [
        "[Threads 압축 바이럴 규격 및 12만 뷰 검증 구조]",
        `- 본문 목표 길이는 ${THREADS_CONTENT_TARGET_LENGTH}자 내외(이상적 범위: 140~240자, 최대 ${THREADS_CONTENT_MAX_LENGTH}자 이하)로 극도로 압축한다.`,
        `- 상단 100자(피드 접히기 전 Fold)에서 스크롤을 멈추게 해야 한다. 지루한 배경 설명, 훈계조 사주 강의, 불필요한 증상 나열(□)은 절대 금지한다.`,
        `- [Charlie Hills 2-Line Contrast Hook]: 첫 문장은 40자 이내의 대담한 단언(Opening)으로 시작하고, 바로 다음 줄은 40자 이내의 반전/대립각(Contrast)으로 상식을 뒤집는다.`,
        `- [12만 뷰 서열화/극단적 앵커 훅]: 대중이 아는 통념/기운보다 상위 티어를 비교('A보다 센 B보다 센 게 뭔지 알아? 바로 C야')하거나, 한 문장으로 끝나는 극단적 비유('스님도 파계시킴')와 독자 자신에게 투사시키는 인정 욕구('너한테 그런 치명적 매력이 숨겨져 있을 수도')를 활용한다.`,
        "- [Single-Point Razor]: 원문이나 여러 주제를 요약/나열하지 말고, 상식을 뒤집는 단 하나의 반직관적 주장(Contrarian Insight)에만 모든 문장을 집중할 것.",
        "- [Focused Conflict]: 타겟과 상황에 제시된 페르소나의 실전 마찰 1개만 깊게 파고들고, 여러 갈등이나 딜레마를 백화점식으로 나열하지 말 것.",
        "- [No Factual Hallucination]: 프롬프트에 제공되지 않은 가짜 개인 일화나 날조된 매출/사례 숫자를 지어내지 말고, 구조적 관찰과 냉철한 논리로 설득할 것.",
        "- [Zero-in-body URL]: 본문에는 절대 링크/URL을 넣지 않는다 (알고리즘 노출 패널티 방지).",
        "- [AI Slop 절대 금지]: 'AI한테 생년월일 넣었더니', '반박시 니 말이 맞음', '끝. 더 이상 설명 안 함', '자, 상상해봐', '핵심만 말해줌', '□ 나열 체크박스' 등 복제된 클리셰 문구는 즉시 품질 탈락 처리된다.",
        "- [Zero-Promo Conversation Igniter 첫 댓글]: 첫 댓글은 구분자(===FIRST_COMMENT===) 바로 아래에 1~2줄로 작성한다. **[치명적 금지 규칙]** 첫 댓글에 '프로필 링크', '리포트', '판정표', '진단', 링크, 상업적 유도 문구를 절대 쓰지 마라 (Meta 알고리즘이 즉각 스팸 봇으로 판정하여 조회수를 0으로 락을 건다). 첫 댓글은 오직 작성자 본인의 솔직한 찌질한 경험담/실수 고백 또는 독자가 댓글을 달 수밖에 없게 만드는 날것의 도발적 질문(Conversation Igniter)으로만 작성한다. (예: \"난 솔직히 2번 고르고 1년 존버했다가 번아웃 오고 퇴직금 다 날렸음. 너넨 몇 번이냐?\")",
        "- [메타 텍스트 및 체크리스트 출력 절대 금지]: 글자 수 확인, 자수 체크, 초안, Threads 본문 같은 메타 텍스트를 절대 출력하지 않는다. 제목(# 제목), 구분선(---), '생성 완료', '포맷 체크', '본문/첫댓글 안내' 등 기획서용 메타 텍스트를 본문이나 첫 댓글에 단 한 줄도 출력하지 마라.",
      ];

  const sideMissionPrompt = config.sideMission
    ? isEnglish
      ? [
          "[Side Mission: Natural Sub-Promotion]",
          `- Mission: ${config.sideMission}`,
          "- Core rule: Never hard-sell or advertise openly. Weave in smoothly at the end or in the first comment only when context allows.",
          "",
        ]
      : [
          "[사이드 미션 (Side Mission: 자연스러운 서브 프로모션)]",
          `- 미션 내용: ${config.sideMission}`,
          "- 핵심 지침: 본문 전면에 절대 노골적 광고나 하드셀을 하지 마라. 글의 맥락이 자연스러울 때만 마지막 부분 또는 첫 댓글에 부드럽게 한 줄 녹여내라.",
          "",
        ]
    : [];

  const voiceProfilePrompt = config.voiceProfile
    ? isEnglish
      ? [
          "[Brand Voice Profile]",
          `- Tone: ${config.voiceProfile.tone}`,
          `- Perspective: ${config.voiceProfile.perspective}`,
          `- Sentence length / Rhythm: ${config.voiceProfile.sentenceLength} / ${config.voiceProfile.paragraphStyle}`,
          ...(config.voiceProfile.forbiddenPhrases.length ? [`- Forbidden phrases/tones: ${config.voiceProfile.forbiddenPhrases.join(", ")}`] : []),
        ]
      : [
          `[브랜드 고유 보이스 (Voice Profile)]`,
          `- 톤: ${config.voiceProfile.tone}`,
          `- 화자 관점: ${config.voiceProfile.perspective}`,
          `- 문장 길이/호흡: ${config.voiceProfile.sentenceLength} / ${config.voiceProfile.paragraphStyle}`,
          ...(config.voiceProfile.forbiddenPhrases.length ? [`- 금지 어조: ${config.voiceProfile.forbiddenPhrases.join(", ")}`] : []),
        ]
    : [];

  const enMode = isEnglish ? ENGLISH_VIRAL_MODE_LABELS[viralIntentMode.id] : null;
  const variationAngle = experiment.angleVariation ?? enMode?.label ?? viralIntentMode.label;
  const variationStructure = experiment.structureVariation ?? enMode?.instruction ?? viralIntentMode.instruction;
  const sanitizedRecentPostContext = isEnglish && recentPostContext.includes("최근 생성 글 없음")
    ? "No recent posts. Avoid repeating identical openings, hooks, or conclusions."
    : recentPostContext;

  const experimentParams = isEnglish
    ? [
        `[Topic]\n${experiment.topic}`,
        `[Target Audience]\n${experiment.targetAudience}`,
        `[Situation/Context]\n${experiment.situation}`,
        `[Hook Type]\n${experiment.hookType}`,
        `[CTA Type]\n${experiment.ctaType}`,
        `[Variation]\nAngle: ${variationAngle}\nStructure: ${variationStructure}`,
        ...(creatorPatternContext ? [creatorPatternContext] : []),
        `[Performance Memory]\n${growthContext}`,
        `[Viral Reference Memory]\n${viralContext}`,
        `[Recent Post Avoidance]\n${sanitizedRecentPostContext}`,
        ...formatQualityFeedback(qualityFeedback, true),
        "",
        `Combine the experimental conditions above and write 1 high-retention Threads post (~${THREADS_CONTENT_TARGET_LENGTH} chars, max ${THREADS_CONTENT_MAX_LENGTH} chars) STRICTLY IN ENGLISH. Output ===FIRST_COMMENT=== and immediately write the first comment in English below it.`,
        "Do NOT write actual URLs in the body or first comment. The system handles UTM tracking links.",
      ]
    : [
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
        ...formatQualityFeedback(qualityFeedback, false),
        "",
        `위 실험 조건을 조합해서 ${THREADS_CONTENT_TARGET_LENGTH}자 내외(140~240자, 최대 ${THREADS_CONTENT_MAX_LENGTH}자 이하) Threads 포스트 1개를 작성해줘. 작성 후 ===FIRST_COMMENT=== 를 출력하고, 바로 아래에 첫 댓글을 작성해줘.`,
        "본문과 첫 댓글에 실제 URL은 쓰지 마. 시스템이 저장 후 필요한 경우 UTM 링크를 붙인다.",
      ];

  return [
    ...languageMandate,
    isEnglish ? `[Formula: ${experiment.formula.name}]` : `[공식: ${experiment.formula.name}]`,
    experiment.formula.instruction,
    "",
    ...formatProductPrompt(config),
    ...formatCampaignPrompt(experiment),
    formatViralIntentModePrompt(viralIntentMode, isEnglish),
    ...(marketingSkillsContext ? [marketingSkillsContext] : []),
    ...crossDomainGuardrails,
    ...viralRules,
    ...sideMissionPrompt,
    ...voiceProfilePrompt,
    ...experimentParams,
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
  const formulaPool = buildFormulaPool(sourceFormulas, dbWeights);
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
