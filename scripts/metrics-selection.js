const MATURITY_MS = 72 * 60 * 60 * 1000;

function selectMetricsCandidates(posts, options) {
  const { now, minAgeMs, maxAgeMs, limit } = options;

  return posts
    .filter((post) => {
      if (!post.publishedAt) return false;
      const ageMs = now - new Date(post.publishedAt).getTime();
      return ageMs >= minAgeMs && ageMs <= maxAgeMs;
    })
    .sort((left, right) => compareMetricsPriority(left, right, now))
    .slice(0, limit);
}

function getPriorityTier(post, now) {
  if (post.metricsAt === null) return 1;
  const publishedTime = new Date(post.publishedAt).getTime();
  const metricsTime = new Date(post.metricsAt).getTime();
  const isMature = (now - publishedTime) >= MATURITY_MS;
  const hasMatureMetrics = metricsTime >= (publishedTime + MATURITY_MS);
  if (isMature && !hasMatureMetrics) return 2;
  return 3;
}

function compareMetricsPriority(left, right, now) {
  const tierLeft = getPriorityTier(left, now);
  const tierRight = getPriorityTier(right, now);

  if (tierLeft !== tierRight) {
    return tierLeft - tierRight;
  }

  if (tierLeft === 1) {
    return new Date(left.publishedAt).getTime() - new Date(right.publishedAt).getTime();
  }

  return new Date(left.metricsAt).getTime() - new Date(right.metricsAt).getTime();
}

module.exports = { selectMetricsCandidates };
