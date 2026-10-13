/** How many drafts the refill cron should generate so the backlog reaches its target. */
export const MAX_REFILL_PER_RUN = 6; // ponytail: keeps one run under maxDuration; raise with a faster model or batching

export function planRefillCount(backlog: number, target: number, maxPerRun: number = MAX_REFILL_PER_RUN): number {
  return Math.max(0, Math.min(target - backlog, maxPerRun));
}

/** Parses ?target= as an integer 1-50; null when absent or invalid. */
export function parseRefillTarget(raw: string | null): number | null {
  if (!raw) return null;
  const target = Number(raw);
  return Number.isInteger(target) && target >= 1 && target <= 50 ? target : null;
}
