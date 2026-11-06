import { threadRootPart } from "@/lib/thread-splitter";

// 2026-11-06 full-text audit (cosmicpath, published since 10/17, measured 48h+, this exact pattern):
// posts whose first line names a saju concept had a median of 150 views (7 of 25 at 300+);
// posts that opened on a plain life situation had 54 (1 of 41 at 300+). Over 60 days: 150 vs 81.
// Every 1k+ post (화개 22,693 · 진술축미 5,521 · 괴강 338 · 이동수 411) named the concept up front.
// These modes write a saju claim, so they must open on the concept. Modes with their own opening
// (3지선다 상상, 복채 금액, 입문자 질문, 목록·예보·가이드) keep it.
export const CONCEPT_FIRST_MODE_IDS: ReadonlySet<string> = new Set([
  "concept_hierarchy",
  "identity_profile",
  "relationship_tension",
  "wealth_vault_unlock",
  "talent_reality_check",
  "fact_bomb_incumbent_attack",
]);

const FIRST_LINE_SAJU_CONCEPT_PATTERN = new RegExp(
  [
    "도화", "홍염", "화개", "역마", "원진", "귀문", "괴강", "양인", "백호",
    "인성", "재성", "식상", "관성", "식신", "상관(?!없|이)", "겁재", "비견", "편인", "정인", "편재", "정재", "편관", "정관",
    "진술축미", "인오술", "신자진", "해묘미", "사유축", "귀인",
    "일주", "일간", "[갑을병정무기경신임계][목화토금수]",
    "대운", "세운", "교운기", "삼재", "이동수", "팔자", "궁합", "오행", "원국", "시주",
    "(?:쥐|소|범|호랑이|토끼|용|뱀|말|양|원숭이|닭|개|돼지)띠",
  ].join("|")
);

export function hasFirstLineSajuConcept(post: string): boolean {
  const firstLine = threadRootPart(post).split("\n").find((line) => line.trim()) ?? "";
  return FIRST_LINE_SAJU_CONCEPT_PATTERN.test(firstLine);
}

export function findMissingFirstLineConcept(post: string): string | null {
  if (hasFirstLineSajuConcept(post)) return null;
  const firstLine = threadRootPart(post).split("\n").find((line) => line.trim()) ?? "";
  return `첫 줄에 사주 개념이 없음: "${firstLine.slice(0, 40)}" — 살·글자·십성·띠·대운 중 하나를 첫 줄에서 바로 꺼내`;
}

// cosmicpath-global, 60 days: 31 of 110 posts opened by correcting the reader ("Your zodiac animal is not...",
// "Saturn return is not...") at a median of 15 views vs 18 for the rest. The gap is small because the account has
// 6 followers; the rule is for variety and follows the benchmark: the big astrology accounts open on identity,
// the sky right now, a check-in, or a story, never on a correction.
const ENGLISH_NEGATION_HOOK_PATTERN = /\b(?:not|never|no longer)\b|n['’]t\b/i;

export function findEnglishNegationHook(post: string): string | null {
  const firstLine = threadRootPart(post).split("\n").find((line) => line.trim()) ?? "";
  return ENGLISH_NEGATION_HOOK_PATTERN.test(firstLine)
    ? `Line 1 corrects the reader ("${firstLine.slice(0, 50)}"). Open on an identity call-out, how this week feels, a check-in, or a story instead. No "not", "isn't", "never" in line 1.`
    : null;
}
