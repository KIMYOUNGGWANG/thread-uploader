const MATURITY_MS = 72 * 60 * 60 * 1000;

export interface MetricsCandidate {
  publishedAt: Date | null;
  metricsAt: Date | null;
}

export interface MetricsSelectionOptions {
  now: number;
  minAgeMs: number;
  maxAgeMs: number;
  limit: number;
}

// Priority: never-collected first (oldest first), then mature posts lacking a 72h+ snapshot, then stalest metrics.
export function selectMetricsCandidates<T extends MetricsCandidate>(posts: T[], options: MetricsSelectionOptions): T[] {
  const { now, minAgeMs, maxAgeMs, limit } = options;
  return posts
    .filter((post) => {
      if (!post.publishedAt) return false;
      const ageMs = now - post.publishedAt.getTime();
      return ageMs >= minAgeMs && ageMs <= maxAgeMs;
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
