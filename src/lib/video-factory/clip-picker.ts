const RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type PickableClip = { id: string; usedCount: number; lastUsedAt: Date | null };

function lastUsedMs(clip: PickableClip): number {
  return clip.lastUsedAt?.getTime() ?? 0;
}

function isRecent(clip: PickableClip, now: Date): boolean {
  return clip.lastUsedAt !== null && now.getTime() - lastUsedMs(clip) < RECENT_WINDOW_MS;
}

export function pickClip<T extends PickableClip>(clips: T[], now: Date): T | null {
  const eligible = clips.filter((clip) => !isRecent(clip, now));

  if (eligible.length === 0) {
    // 전부 최근 7일 안에 쓰였으면 가장 오래 전에 쓴 클립을 고른다.
    const oldest = [...clips].sort((a, b) => lastUsedMs(a) - lastUsedMs(b))[0];
    return oldest ?? null;
  }

  const best = [...eligible].sort(
    (a, b) => a.usedCount - b.usedCount || lastUsedMs(a) - lastUsedMs(b),
  )[0];
  return best ?? null;
}
