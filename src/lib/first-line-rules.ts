import { threadRootPart } from "@/lib/thread-splitter";
import { THREADS_CONTENT_MAX_LENGTH } from "@/lib/threads-limits";

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

// 2026-11-06 peer comparison (docs/research/2026-11-06-competitor-post-comparison.md, 64 astrology accounts):
// 51% of their posts name a Western sign or element group and those posts get 1.6x the account's usual likes;
// 1% use Eastern terms. 61% of ours opened on saju vocabulary (day master, pillar) the audience doesn't know.
// These formulas talk to the reader about themselves, so they must anchor on what the reader already uses.
// (The 11/6 "no 'not' in line 1" gate was dropped: peers open that way 18% of the time at 1.13x.)
export const WESTERN_ANCHOR_FORMULA_IDS: ReadonlySet<string> = new Set([
  "identity_callout",
  "element_bridge",
  "check_in",
  "two_birthday_compatibility",
  "saturn_reboot_timeline",
]);

const WESTERN_ANCHOR_PATTERN = new RegExp(
  [
    "aries", "taurus", "gemini", "cancer", "leo", "virgo", "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces",
    "(?:fire|water|earth|air) signs?", "sun signs?", "moon signs?", "rising", "big three", "birth chart", "natal chart",
    "mercury", "venus", "mars", "saturn", "jupiter", "retrograde", "full moon", "new moon", "eclipse", "[a-z]+ season",
  ].map((term) => `\\b${term}\\b`).join("|"),
  "i"
);

export function hasWesternAnchor(post: string): boolean {
  const opening = threadRootPart(post).split("\n").filter((line) => line.trim()).slice(0, 2).join("\n");
  return WESTERN_ANCHOR_PATTERN.test(opening);
}

export function findMissingWesternAnchor(post: string): string | null {
  return hasWesternAnchor(post)
    ? null
    : "Lines 1-2 name nothing the reader already uses. Open on a Western sign or element group (Scorpio, water signs), their big three, or a planet/season they know, then add the Korean saju layer.";
}

// 2026-11-10 logged-in scan: the saju accounts that get likes open every post with the same line ("무당입니다.",
// "아가…"), so readers learn the voice. Added after the gates so first-line rules still judge the hook itself;
// skipped when it would push the first Threads part over the length limit.
export function withSignatureOpener(content: string, opener: string | undefined): string {
  const line = opener?.trim();
  if (!line || content.trimStart().startsWith(line)) return content;
  const next = `${line}\n${content}`;
  return threadRootPart(next).length > THREADS_CONTENT_MAX_LENGTH ? content : next;
}
