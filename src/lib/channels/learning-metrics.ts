type MetricFields = { views: number | null; likes: number | null; replies: number | null; reposts: number | null };
type PublicationMetrics = MetricFields & { metricsAt: Date | null };

// Overlay the four Threads metrics from the mirrored Publication; metricsAt stays the post's
// (campaign-metrics bumps Post.metricsAt without mirroring).
export function withThreadsMetrics<T extends MetricFields>(post: T & { publications: PublicationMetrics[] }): Omit<T, "publications"> {
  const { publications, ...rest } = post;
  const pub = Array.isArray(publications) ? publications[0] : undefined;
  if (!pub || pub.metricsAt == null) return rest;
  return { ...rest, views: pub.views, likes: pub.likes, replies: pub.replies, reposts: pub.reposts };
}
