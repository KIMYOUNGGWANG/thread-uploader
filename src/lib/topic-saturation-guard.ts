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
