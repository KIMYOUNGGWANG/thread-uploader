const MATURITY_MS = 72 * 60 * 60 * 1000;

export interface MetricsCandidate {
  publishedAt: Date | null;
  metricsAt: Date | null;
}

export interface MetricsSelectionOptions {
  now: number;
  minAgeMs: number;
  maxAgeMs: number;
  // Never-collected posts stay eligible longer so a scheduler outage can be backfilled.
  uncollectedMaxAgeMs?: number;
  limit: number;
}

// Priority: never-collected first (oldest first), then mature posts lacking a 72h+ snapshot, then stalest metrics.
export function selectMetricsCandidates<T extends MetricsCandidate>(posts: T[], options: MetricsSelectionOptions): T[] {
  const { now, minAgeMs, maxAgeMs, uncollectedMaxAgeMs = maxAgeMs, limit } = options;
  return posts
    .filter((post) => {
      if (!post.publishedAt) return false;
      const ageMs = now - post.publishedAt.getTime();
      const maxAge = post.metricsAt === null ? Math.max(maxAgeMs, uncollectedMaxAgeMs) : maxAgeMs;
      return ageMs >= minAgeMs && ageMs <= maxAge;
    })
    .sort((left, right) => compareMetricsPriority(left, right, now))
    .slice(0, limit);
}

function getPriorityTier(post: MetricsCandidate, now: number): number {
  if (post.metricsAt === null) return 1;
  const publishedTime = post.publishedAt?.getTime() ?? 0;
  const isMature = now - publishedTime >= MATURITY_MS;
  const hasMatureMetrics = post.metricsAt.getTime() >= publishedTime + MATURITY_MS;
  return isMature && !hasMatureMetrics ? 2 : 3;
}

function compareMetricsPriority(left: MetricsCandidate, right: MetricsCandidate, now: number): number {
  const tierLeft = getPriorityTier(left, now);
  const tierRight = getPriorityTier(right, now);
  if (tierLeft !== tierRight) return tierLeft - tierRight;
  if (tierLeft === 1) return (left.publishedAt?.getTime() ?? 0) - (right.publishedAt?.getTime() ?? 0);
  return (left.metricsAt?.getTime() ?? 0) - (right.metricsAt?.getTime() ?? 0);
}

const METRICS_STALE_MS = 48 * 60 * 60 * 1000;

// fetch-metrics runs daily in its own workflow; no collection for 48h means it stopped.
export function isMetricsCollectionStale(latestMetricsAt: Date | null, now: number): boolean {
  return latestMetricsAt === null || now - latestMetricsAt.getTime() > METRICS_STALE_MS;
}
