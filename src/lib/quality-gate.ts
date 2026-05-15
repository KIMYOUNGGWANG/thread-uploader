import type { CareerDecisionType, QualityProfileId } from "@/types/brand";

/**
 * Quality Gate — CosmicPath 바이럴 공식 준수 검사기
 *
 * saju_viral은 기존 사주 특화 훅을 보존하고, career_decision은
 * 커리어 wedge 실험용 댓글 진단형 콘텐츠를 검증한다.
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
  // 점성술
  "별자리", "쌍둥이자리", "전갈자리", "물고기자리", "염소자리", "천칭자리",
  "양자리", "황소자리", "사자자리", "처녀자리", "게자리", "물병자리",
  // 타로
  "타로",
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
  /반박시/,       // "반박시 니 말이 맞음"
  /!$/m,          // 감탄 (행 끝)
  /알고\s*있어/,  // "알고 있어"
  /깔려있어/,     // 해당여부 확인
  /있는데/,       // 반전 구조
];

const ENGAGEMENT_PATTERNS = [
  /^\s*1\./m,     // 선택지 (1. 2. 3.)
  /1\/\d/,        // 시리즈 (1/2)
  /댓글/,         // 댓글 유도
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
];

const CAREER_COMMENT_PATTERNS = [
  /댓글/,
  /답글/,
  /남겨/,
  /써줘/,
  /적어줘/,
  /상황/,
  /A\/B\/C/i,
  /버팀형/,
  /이동형/,
  /준비형/,
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

const CAREER_DECISION_PATTERNS: Array<{
  type: CareerDecisionType;
  patterns: RegExp[];
}> = [
  { type: "stay", patterns: [/버팀형/, /버티/, /남아/, /유지/, /견디/] },
  { type: "move", patterns: [/이동형/, /옮기/, /이직/, /퇴사/, /나가/] },
  { type: "prepare", patterns: [/준비형/, /준비/, /정리/, /포트폴리오/, /지원/, /2주|4주/] },
];

export function checkQuality(post: string, profile: QualityProfileId = "saju_viral"): QualityResult {
  if (profile === "career_decision") return checkCareerDecisionQuality(post);
  return checkSajuViralQuality(post);
}

function checkSajuViralQuality(post: string): QualityResult {
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

  return { pass: score >= 2, score, profile: "saju_viral", reasons };
}

function checkCareerDecisionQuality(post: string): QualityResult {
  const firstLine = post.split("\n").find((line) => line.trim().length > 0) ?? "";
  const reasons: string[] = [];
  let score = 0;

  if (CAREER_FIRST_LINE_PATTERNS.some((pattern) => pattern.test(firstLine))) {
    score++;
  } else {
    reasons.push(`첫 줄에 커리어 불안 없음: "${firstLine.slice(0, 40)}"`);
  }

  if (CAREER_COMMENT_PATTERNS.some((pattern) => pattern.test(post))) {
    score++;
  } else {
    reasons.push("댓글 유도 없음 — 상황 공유/분류 요청 필요");
  }

  const careerDecisionType = detectCareerDecisionType(post);
  if (careerDecisionType) {
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
