/**
 * Quality Gate — CosmicPath 바이럴 공식 준수 검사기
 *
 * go-viral-or-die의 Core Value Congruence 원칙 기반:
 * 콘텐츠가 사주 특화 바이럴 공식을 준수하는지 자동 검증해
 * generic 동기부여 글로 drift하는 것을 시스템 레벨에서 방지한다.
 *
 * 점수 기준: 3점 만점, 2점 미만 → FAIL → 재생성 트리거
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
  score: number; // 0–3
  reasons: string[];
}

export function checkQuality(post: string): QualityResult {
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

  return { pass: score >= 2, score, reasons };
}
