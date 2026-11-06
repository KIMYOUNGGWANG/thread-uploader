// Topic saturation guard: stops one proven angle from being copy-pasted into every post.
// learnings 2026-09-03: the "30분 오차" case overfit the whole account. Cap it in code, not prose.

export interface SaturationMarkerGroup {
  id: string;
  markers: string[];
  maxInRecent: number;
}

export interface SaturatedTopic {
  id: string;
  recentHits: number;
  maxInRecent: number;
}

export const SATURATION_WINDOW = 10;

export const SATURATION_MARKER_GROUPS: SaturationMarkerGroup[] = [
  { id: "birth_time_offset", markers: ["진태양시", "30분 오차", "32분", "동경시", "서머타임"], maxInRecent: 1 },
  // 2026-11-06: "공시/자격증인데 성과 그대로" ran on 11/4 and again on 11/6 with the same first comment, and the
  // 복채 roast twice in four days. One of each per ~3 days (10 posts at 3/day).
  { id: "career_prep_stuck", markers: ["자격증", "공시", "대학원", "취준", "고시"], maxInRecent: 1 },
  { id: "paid_reading_roast", markers: ["복채", "점집", "철학관", "타로집"], maxInRecent: 1 },
];

function hasMarker(text: string, markers: string[]): boolean {
  return markers.some((marker) => text.includes(marker));
}

export function findSaturatedTopics(
  candidate: string,
  recentContents: string[],
  groups: SaturationMarkerGroup[] = SATURATION_MARKER_GROUPS
): SaturatedTopic[] {
  const window = recentContents.slice(0, SATURATION_WINDOW);
  return groups.flatMap((group) => {
    if (!hasMarker(candidate, group.markers)) return [];
    const recentHits = window.filter((content) => hasMarker(content, group.markers)).length;
    return recentHits >= group.maxInRecent ? [{ id: group.id, recentHits, maxInRecent: group.maxInRecent }] : [];
  });
}

// Learned frictionWeights let one friction win most weighted picks (2026-10: 동업/재회 took 26 of 30 posts).
export const SITUATION_MAX_IN_RECENT = 2;

export function isSituationSaturated(friction: string, recentSituations: Array<string | null | undefined>): boolean {
  const hits = recentSituations.slice(0, SATURATION_WINDOW).filter((situation) => situation?.includes(friction)).length;
  return hits >= SITUATION_MAX_IN_RECENT;
}

export function formatSaturationReason(topic: SaturatedTopic): string {
  return `토픽 포화: ${topic.id} (최근 ${SATURATION_WINDOW}개 중 ${topic.recentHits}개, 허용 ${topic.maxInRecent}개) - 다른 소재로 작성`;
}

// A first comment that repeats a recent one ("제일 오래 붙잡고 있는 준비가 뭐야?" twice in three days) reads as a bot.
export const FIRST_COMMENT_REPEAT_WINDOW = 10;
const FIRST_COMMENT_SIMILARITY_MAX = 0.5;

function bigrams(text: string): Set<string> {
  const compact = text.replace(/https?:\/\/\S+/g, "").replace(/[^가-힣A-Za-z0-9]/g, "");
  const grams = new Set<string>();
  for (let i = 0; i < compact.length - 1; i++) grams.add(compact.slice(i, i + 2));
  return grams;
}

export function findRepeatedFirstComment(candidate: string, recentFirstComments: Array<string | null | undefined>): string | null {
  const own = bigrams(candidate);
  // Very short comments ("북마크 2 저장") share most bigrams by chance; real first comments are 20+ characters.
  if (own.size < 8) return null;
  for (const recent of recentFirstComments.slice(0, FIRST_COMMENT_REPEAT_WINDOW)) {
    if (!recent) continue;
    const other = bigrams(recent);
    if (other.size < 8) continue;
    const shared = [...own].filter((gram) => other.has(gram)).length;
    const similarity = shared / (own.size + other.size - shared);
    if (similarity >= FIRST_COMMENT_SIMILARITY_MAX) return recent.split("\n")[0].slice(0, 40);
  }
  return null;
}
