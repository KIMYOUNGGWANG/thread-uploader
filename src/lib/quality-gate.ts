import type { CareerDecisionType, QualityProfileId } from "@/types/brand";
import {
  checkProductGrowthQuality,
  type ProductQualityContext,
} from "@/lib/product-quality-gate";
import { getThreadsContentLimitError } from "@/lib/threads-limits";
import {
  checkViralModeFidelity,
  hasFortuneOverclaim,
  hasLowTouchEngagementMechanic,
  hasReplyBurdenPromise,
  type ViralModeFidelityFailureCode,
} from "@/lib/viral-intent-modes";
import { validateAntiSlop } from "@/lib/marketing-skills";
import { evaluateContentWithExpertPanel } from "@/lib/expert-panel-evaluator";
import { checkMetaPolicySafety } from "@/lib/meta-policy-guard";

/**
 * Quality Gate — CosmicPath 바이럴 공식 준수 검사기
 *
 * saju_viral은 기존 사주 특화 훅을 보존하고, career_decision은
 * 커리어 wedge 실험용 셀프체크/저장형 콘텐츠를 검증한다.
 */

const SAJU_KEYWORDS = [
  // 살(煞) 계열
  "화개살", "도화살", "홍염살", "역마살", "원진살", "귀문관살",
  // 십성
  "편인", "식신", "재성", "관성", "상관", "비견", "겁재", "정인", "편관", "정관",
  // 지지 조합
  "진술축미", "인오술", "삼합", "방합",
  // 귀인
  "천을귀인", "문창귀인", "월덕귀인",
  // 일주
  "일주", "갑자", "을축", "병인", "정묘", "무진", "기사", "경오", "신미", "임술", "계해",
  // 사주 일반
  "사주", "팔자", "사주팔자", "사주원국", "대운", "세운", "운세", "궁합",
  // 점성술 & 5대 계산 엔진
  "별자리", "쌍둥이자리", "전갈자리", "물고기자리", "염소자리", "천칭자리",
  "양자리", "황소자리", "사자자리", "처녀자리", "게자리", "물병자리",
  "자미두수", "명반", "12궁", "태국 점성술", "마하탁사", "수비학",
  // 진태양시 & 천문 보정
  "진태양시", "동경 135도", "동경135도", "균시차", "시주", "시지", "오행", "목화토금수",
  // MBTI 교차
  "MBTI",
];

const HOOK_PATTERNS = [
  /\?/,           // 질문형
  /상상해/,       // 상상 시나리오
  /혹시/,         // "혹시 ~알아?"
  /사실/,         // "사실 ~야"
  /아무도/,       // "아무도 말 안 해줬던"
  /진짜\s/,       // "진짜 ~야"
  /솔직히/,       // 솔직한 폭로
  /보다\s*센/,    // 120k 서열화 훅 ("A보다 센 B보다 센")
  /!$/m,          // 감탄 (행 끝)
  /알고\s*있어/,  // "알고 있어"
  /깔려있어/,     // 해당여부 확인
  /있는데/,       // 반전 구조
];

const ENGAGEMENT_PATTERNS = [
  /^\s*1\./m,     // 선택지 (1. 2. 3.)
  /1\/\d/,        // 시리즈 (1/2)
  /댓글/,
  /깔려있어/,     // 해당여부 확인
  /있어\?/,       // "있어?" 참여 유도
  /저장/,         // 저장 CTA
  /어때\?/,       // 의견 요청
  /뭔지\s*알아/,  // 궁금증 유발
  /있잖아/,       // 친근 말걸기
];

export interface QualityResult {
  pass: boolean;
  score: number;
  profile: QualityProfileId;
  reasons: string[];
  careerDecisionType?: CareerDecisionType;
}

const CAREER_FIRST_LINE_PATTERNS = [
  /이직/,
  /퇴사/,
  /버틸지/,
  /옮길지/,
  /번아웃/,
  /그만둘지/,
  /커리어/,
  /직장/,
  /회사/,
  /월급/,
  /통장/,
  /잔고/,
  /카드값/,
  /돈/,
  /현타/,
  /동기/,
  /제자리/,
  /뒤처/,
  /때려치우/,
  /일도\s*다\s*놓/,
  /출근/,
  /연봉/,
  /승진/,
  /상사/,
  /업무/,
  /동업/,
  /피벗/,
  /스타트업/,
  /창업/,
  /사업/,
  /대표/,
  /팀/,
  /조직/,
  /사주/,
  /운세/,
  /대운/,
  /멘탈/,
  /화병/,
  /존버/,
  /대박/,
  /오열/,
  /선택/,
  /성과/,
  /프리랜서/,
  /결산/,
  /입사/,
  /신입/,
  /스케이프고트/,
  /왕따/,
  /투자/,
  /아키텍트/,
  /파트너/,
  /손절/,
  /역할/,
  // Global English career & situation patterns
  /career/i,
  /job/i,
  /role/i,
  /work/i,
  /office/i,
  /promot/i,
  /boss|manager|leader|lead/i,
  /burnout|burnt\s*out/i,
  /quit|resign/i,
  /architect/i,
  /engineer|developer/i,
  /founder|startup/i,
  /company|corporate/i,
  /salary|paycheck|bonus/i,
  /hire|hired|hiring|layoff|laid\s*off/i,
  /scapegoat/i,
  /saturn\s*return/i,
  /stuck|trapped/i,
  /firefighter/i,
  /saju|zodiac|astrology|horoscope|birth\s*chart/i,
];

const CAREER_COMMENT_PATTERNS = [
  /A\/B\/C/i,
  /버팀형/,
  /이동형/,
  /준비형/,
  /A\s*\/\s*B/i,
  /어느\s*쪽/,
  /손\s*들/,
  /몇\s*개/,
  /체크/,
  /해당/,
  /저장/,
  /캡처/,
  /판정표/,
  /순서표/,
  /공유/,
  /태그/,
  /보내줘/,
  /단계/,
  /엔진/,
  // Global English engagement patterns
  /\b[ABC]\b[\.\:\-\)]/i,
  /archetype/i,
  /save|bookmark/i,
  /share/i,
  /checklist/i,
  /which\s*(one|type|matches|are\s*you)/i,
  /comment|tell\s*me/i,
  /tag/i,
  /step/i,
  /engine/i,
  /anchor|exodus|reposition/i,
];

const GENERIC_SELF_HELP_PATTERNS = [
  /좋은 일이 올 거예요/,
  /좋은 일이 올 거야/,
  /스스로를 믿으세요/,
  /스스로를 믿어/,
  /작은 변화가 큰 기적/,
  /포기하지 마세요/,
  /포기하지 마/,
  /당신은 할 수 있어/,
  /언젠가 다 잘될/,
];

const GENERATED_META_PATTERNS = [
  /자수\s*체크/,
  /글자\s*수\s*확인/,
  /공백[·\s]*줄바꿈.*포함/,
  /500자\s*이하\s*통과/,
  /Threads\s*본문/i,
  /초안\s*작성/,
  /#+\s*📌\s*THREADS\s*POST/i,
  /---\s*\*\*본문\*\*/i,
  /^\*\*본문\*\*/m,
  /===FIRST_COMMENT===/i,
  /#\s*The\s*Peach\s*Blossom/i,
];

const CAREER_DECISION_PATTERNS: Array<{
  type: CareerDecisionType;
  patterns: RegExp[];
}> = [
  {
    type: "stay",
    patterns: [
      /버팀형|존버형|잔류형|버티는\s*쪽|남는\s*쪽/,
      /anchor/i,
      /stay/i,
      /remain/i,
      /outlast/i,
      /버티/,
      /버텨/,
      /남아/,
      /유지/,
      /견디/,
      /숨\s*고르/,
      /에너지\s*보존/,
      /기다리/,
      /존버/,
      /스테이/,
      /버티기/,
      /잔류/,
    ],
  },
  {
    type: "move",
    patterns: [
      /이동형|이직형|퇴사형|탈출형|옮기는\s*쪽|떠나는\s*쪽/,
      /exodus/i,
      /exit/i,
      /leave/i,
      /escape/i,
      /옮기/,
      /이직/,
      /퇴사/,
      /나가/,
      /움직여/,
      /전환/,
      /밀어붙/,
      /탈출/,
      /런각/,
      /떠나/,
      /이탈/,
    ],
  },
  {
    type: "prepare",
    patterns: [
      /준비형|탐색형|간보는\s*쪽|준비하는\s*쪽/,
      /reposition/i,
      /pivot/i,
      /prepare/i,
      /portfolio/i,
      /준비/,
      /정리/,
      /포트폴리오/,
      /지원/,
      /2주|4주/,
      /시작해야/,
      /조건/,
      /스펙/,
      /탐색/,
      /물밑/,
      /알아보/,
    ],
  },
];

const CAREER_DECISION_FRAME_PATTERNS = [
  /three\s*(career)?\s*archetypes/i,
  /which\s*(one|type|matches)/i,
  /anchor[\s\S]*exodus[\s\S]*reposition/i,
  /stay[\s\S]*leave[\s\S]*prepare/i,
  /\b[ABC]\b\.\s*[\s\S]*\b[ABC]\b\.\s*/i,
  /버팀형[\s\S]*이동형[\s\S]*준비형/,
  /버티[\s\S]*나가[\s\S]*준비/,
  /버텨야[\s\S]*움직여야[\s\S]*준비/,
  /버티고\s*있는지[\s\S]*나가야[\s\S]*준비/,
  /세\s*가지로?\s*갈린/,
  /3가지로?\s*나뉘/,
  /어느\s*쪽인지/,
  /어느\s*쪽에\s*가까/,
  /어디에\s*해당/,
  /어떤\s*유형/,
  /당신의\s*선택/,
  /(버티|존버|잔류)[\s\S]*(이직|퇴사|이동)[\s\S]*(준비|정리|탐색)/,
  /[ABC123①②③]\s*(?:형)?\s*[\.\:\-\)]\s*[\s\S]*[ABC123①②③]\s*(?:형)?\s*[\.\:\-\)]/i,
  /(어디인가|어디야|어디에\s*있|어디\s*가까|어디\s*느껴|어느\s*지점|가장\s*가까운\s*곳|가장\s*가까운\s*쪽)/,
  /(?:[1-7]단계|[1-7]대\s*엔진|감사\s*체크|7단계)[\s\S]*(?:체크|판정|기준|확인|저장|도출)/,
];

const ENGLISH_ASTRO_TERMS = [
  /astrology|horoscope|birth chart|natal chart/i,
  /sun sign|moon sign|rising|midheaven|ascendant/i,
  /saturn return|mercury retrograde|ephemeris|transit/i,
  /saju|bazi|four pillars|day master|eastern metaphysics/i,
  /synastry|aspect|conjunction|opposition|trine|square/i,
  /house|10th house|6th house|8th house|7th house|4th house/i,
];

const ENGLISH_HOOK_PATTERNS = [
  /\?$/,                          // 질문형
  /^(why|how|what|stop|never)\b/i, // Why / Stop / Never
  /your\s+(birth\s*chart|horoscope|founder|saturn|moon|career)/i,
  /turning\s+29/i,
  /the\s+(reason|truth|paradox|mistake|trap)/i,
  /in\s+western\s+astrology/i,
  /most\s+people/i,
  /^\d+\s+(reasons|mistakes|signs|steps)/i,
  /\?/,                                                    // question anywhere in line 1
  /\b(probably|wrong|myth)\b/i,                           // correction hooks
  /^(born|to\s+(?:every|all))\b/i,                         // boundary / identity call-outs
  /your\s+(zodiac|animal|sign|day\s*master|real)/i,
];

function checkEcommerceD2CQuality(post: string): QualityResult {
  const reasons: string[] = [];
  let score = 0;

  // Zero Hangul check
  if (/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(post)) {
    reasons.push("영문 D2C 콘텐츠에 한글 문자 포함 (Zero Hangul 위반)");
    return { pass: false, score: 0, profile: "ecommerce_d2c", reasons };
  }

  const firstLine = post.split("\n").find((l) => l.trim().length > 0) ?? "";

  // Check 1: English Astro / Metaphysics relevance
  const hasAstroTerm = ENGLISH_ASTRO_TERMS.some((regex) => regex.test(post));
  if (hasAstroTerm) {
    score++;
  } else {
    reasons.push("점성술/사주/운명학 핵심 영문 용어 부재");
  }

  // Check 2: Strong opening hook
  const hasHook = ENGLISH_HOOK_PATTERNS.some((p) => p.test(firstLine));
  if (hasHook) {
    score++;
  } else {
    reasons.push(`영문 첫 줄 훅 약함: "${firstLine.slice(0, 50)}"`);
  }

  // Check 3: Contrarian / Insight structure (contains vs, or, but, however, not, instead)
  const hasContrastOrConflict = /(vs\.|instead|demolishes|dilute|invisible|trap|truth|mismatch|collapse|lie|myth|actually|wrong|not\s+(?:your|the|january)|differently)/i.test(post);
  if (hasContrastOrConflict) {
    score++;
  } else {
    reasons.push("대비(Contrast) 및 역설적 인사이트 구조 부재");
  }

  return {
    pass: score >= 2,
    score,
    profile: "ecommerce_d2c",
    reasons,
  };
}

export function checkQuality(
  post: string,
  profile: QualityProfileId = "saju_viral",
  context: ProductQualityContext = {}
): QualityResult {
  const isEnglish = profile === "ecommerce_d2c" || Boolean(context.isEnglish);
  if (profile === "ecommerce_d2c") {
    return enforceSafetyRules(post, enforceThreadsContentLimit(post, checkEcommerceD2CQuality(post)), isEnglish);
  }
  if (profile === "career_decision") {
    return enforceSafetyRules(post, enforceThreadsContentLimit(post, checkCareerDecisionQuality(post)), isEnglish);
  }
  if (profile === "product_growth") {
    return enforceSafetyRules(post, enforceThreadsContentLimit(post, checkProductGrowthQuality(post, context)), isEnglish);
  }
  return enforceSafetyRules(post, enforceThreadsContentLimit(post, checkSajuViralQuality(post, context)), isEnglish);
}

function enforceThreadsContentLimit(post: string, result: QualityResult): QualityResult {
  const lengthError = getThreadsContentLimitError(post, { allowMultiPart: true });
  if (!lengthError) return result;
  return {
    ...result,
    pass: false,
    reasons: [lengthError, ...result.reasons],
  };
}

function enforceSafetyRules(post: string, result: QualityResult, isEnglish = false): QualityResult {
  const reasons = [...result.reasons];
  if (isEnglish && /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(post)) {
    reasons.unshift("영문 프로필에 한글 문자 포함 (Zero Hangul 위반)");
  }
  if (hasReplyBurdenPromise(post)) reasons.unshift("reply-burden CTA 포함");
  if (hasFortuneOverclaim(post)) reasons.unshift("overclaim 운세/상대 마음 보장 표현 포함");
  if (GENERATED_META_PATTERNS.some((pattern) => pattern.test(post))) reasons.unshift("generated meta text 포함");

  const antiSlop = validateAntiSlop(post);
  if (!antiSlop.pass) {
    reasons.unshift(...antiSlop.issues);
  }

  const expertEvaluation = evaluateContentWithExpertPanel(post);
  if (!expertEvaluation.pass && expertEvaluation.blockingReasons.length > 0) {
    reasons.unshift(...expertEvaluation.blockingReasons);
  }

  const metaPolicy = checkMetaPolicySafety(post);
  if (!metaPolicy.pass && metaPolicy.recommendations.length > 0) {
    reasons.unshift(...metaPolicy.recommendations);
  }

  return reasons.length === result.reasons.length ? result : { ...result, pass: false, reasons };
}

function checkSajuViralQuality(post: string, context: ProductQualityContext): QualityResult {
  const firstLine = post.split("\n").find((l) => l.trim().length > 0) ?? "";
  const reasons: string[] = [];
  let score = 0;

  // Check 1: 사주 전문 용어 포함
  const hasSajuTerm = SAJU_KEYWORDS.some((k) => post.includes(k));
  if (hasSajuTerm) {
    score++;
  } else {
    reasons.push("사주 전문 용어 없음 — generic 콘텐츠 의심");
  }

  // Check 2: 첫 줄 훅 구조
  const hasHook = HOOK_PATTERNS.some((p) => p.test(firstLine));
  if (hasHook) {
    score++;
  } else {
    reasons.push(`훅 없는 첫 줄: "${firstLine.slice(0, 40)}"`);
  }

  // Check 3: 참여 유도 요소
  const hasEngagement = ENGAGEMENT_PATTERNS.some((p) => p.test(post));
  if (hasEngagement) {
    score++;
  } else {
    reasons.push("참여 유도 요소 없음 (선택지/시리즈/질문 필요)");
  }

  const fidelity = context.viralIntentModeId
    ? checkViralModeFidelity(post, context.viralIntentModeId)
    : { pass: true, failureCodes: [] };
  reasons.push(...fidelity.failureCodes.map(formatViralModeFidelityFailure));

  return { pass: score >= 2 && fidelity.pass, score, profile: "saju_viral", reasons };
}

const VIRAL_MODE_FAILURE_MESSAGES: Record<ViralModeFidelityFailureCode, string> = {
  formal_tone: "바이럴 모드에 맞지 않는 존댓말/전문가 문체",
  missing_three_choices: "3지선다 모드에 번호 선택지 1/2/3 없음",
  missing_hierarchy: "개념 서열 모드에 2단계 이상 비교 구조 없음",
  missing_identity_marker: "기질 프로파일 모드에 구체적 살/일주/글자 없음",
  missing_relationship_contrast: "관계 텐션 모드에 관계 키워드와 대비 구조 없음",
};

function formatViralModeFidelityFailure(code: ViralModeFidelityFailureCode): string {
  return VIRAL_MODE_FAILURE_MESSAGES[code];
}

function extractFirstContentLine(post: string): string {
  const lines = post.split("\n").map((l) => l.trim());
  for (const line of lines) {
    if (!line) continue;
    if (/^(\-{3,}|\*{3,}|={3,})$/.test(line)) continue;
    if (/^#+\s*(📌|\[?메인|threads|post|본문)/i.test(line)) continue;
    if (/^\*\*본문\*\*$/i.test(line)) continue;
    return line.replace(/^#+\s*/, "");
  }
  return "";
}

function checkCareerDecisionQuality(post: string): QualityResult {
  const firstLine = extractFirstContentLine(post);
  const reasons: string[] = [];
  let score = 0;

  if (CAREER_FIRST_LINE_PATTERNS.some((pattern) => pattern.test(firstLine))) {
    score++;
  } else {
    reasons.push(`첫 줄에 커리어 불안 없음: "${firstLine.slice(0, 40)}"`);
  }

  if (CAREER_COMMENT_PATTERNS.some((pattern) => pattern.test(post)) && hasLowTouchEngagementMechanic(post)) {
    score++;
  } else {
    reasons.push("low-touch 자기분류/저장/공유 장치 없음");
  }

  const careerDecisionType = detectCareerDecisionType(post);
  if (careerDecisionType || hasCareerDecisionFrame(post)) {
    score++;
  } else {
    reasons.push("버팀형/이동형/준비형 중 하나로 분류하기 어려움");
  }

  if (GENERIC_SELF_HELP_PATTERNS.some((pattern) => pattern.test(post))) {
    reasons.push("generic 자기계발 문장 포함");
  } else {
    score++;
  }

  return {
    pass: score === 4,
    score,
    profile: "career_decision",
    reasons,
    ...(careerDecisionType && { careerDecisionType }),
  };
}

function detectCareerDecisionType(post: string): CareerDecisionType | undefined {
  const explicitType = CAREER_DECISION_PATTERNS.find(({ patterns }) => (
    patterns[0]?.test(post)
  ));
  if (explicitType) return explicitType.type;

  return CAREER_DECISION_PATTERNS.find(({ patterns }) => (
    patterns.slice(1).filter((pattern) => pattern.test(post)).length >= 2
  ))?.type;
}

function hasCareerDecisionFrame(post: string): boolean {
  return CAREER_DECISION_FRAME_PATTERNS.some((pattern) => pattern.test(post));
}
