/** How many drafts the refill cron should generate so the backlog reaches its target. */
export const MAX_REFILL_PER_RUN = 6; // ponytail: keeps one run under maxDuration; raise with a faster model or batching

// Drafts booked further ahead (e.g. an experiment pre-loaded for two weeks) are not backlog: counting them
// stalls refill, and queueing after them pushes new drafts past the booking.
export const BACKLOG_HORIZON_MS = 48 * 60 * 60 * 1000;

export function backlogHorizon(now: Date): Date {
  return new Date(now.getTime() + BACKLOG_HORIZON_MS);
}

export function planRefillCount(backlog: number, target: number, maxPerRun: number = MAX_REFILL_PER_RUN): number {
  return Math.max(0, Math.min(target - backlog, maxPerRun));
}

/** Parses ?target= as an integer 1-50; null when absent or invalid. */
export function parseRefillTarget(raw: string | null): number | null {
  if (!raw) return null;
  const target = Number(raw);
  return Number.isInteger(target) && target >= 1 && target <= 50 ? target : null;
}
