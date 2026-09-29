import { normalizeViralIntentModeId } from "@/lib/viral-intent-modes";

export interface SummaryMetricPost {
  views: number | null;
  replies: number | null;
  reposts: number | null;
  clicks: number | null;
  conversions: number | null;
  manualPaidConversions: number | null;
  qualityPass: boolean | null;
}

export interface SummaryViralModePost {
  campaignFormulaId: string | null;
}

export interface SummaryComparisonPost extends SummaryViralModePost {
  publishedAt: Date | null;
  metricsAt: Date | null;
  linkUrl: string | null;
  views: number | null;
  replies: number | null;
  reposts: number | null;
}

export interface ExperimentReadiness {
  status: "empty" | "incomplete" | "ready";
  totalPosts: number;
  immaturePosts: number;
  maturePosts: number;
  measuredMaturePosts: number;
  missingMetricsPosts: number;
  zeroViewMaturePosts: number;
}

export interface MatureComparison {
  totalPosts: number;
  maturePosts: number;
  measuredPosts: number;
  missingMetricsPosts: number;
  medianViews: number | null;
  replyRate: number;
  repostRate: number;
}

const MATURITY_MS = 72 * 60 * 60 * 1000;

export function resolveSummaryViralIntentModeId(post: SummaryViralModePost): string | null {
  if (!post.campaignFormulaId) return null;
  return normalizeViralIntentModeId(post.campaignFormulaId);
}

export function buildViralModeBuckets(posts: SummaryViralModePost[]): Record<string, number> {
  return posts.reduce<Record<string, number>>((buckets, post) => {
    const modeId = resolveSummaryViralIntentModeId(post);
    if (!modeId) return buckets;
    buckets[modeId] = (buckets[modeId] ?? 0) + 1;
    return buckets;
  }, {});
}

export function buildExperimentReadiness(
  posts: SummaryComparisonPost[],
  referenceTime: Date
): ExperimentReadiness {
  const maturePosts = posts.filter((post) => isMature(post, referenceTime));
  const measuredPosts = maturePosts.filter(hasMatureMetrics);
  const missingMetricsPosts = maturePosts.length - measuredPosts.length;

  return {
    status: posts.length === 0
      ? "empty"
      : maturePosts.length === posts.length && missingMetricsPosts === 0
        ? "ready"
        : "incomplete",
    totalPosts: posts.length,
    immaturePosts: posts.length - maturePosts.length,
    maturePosts: maturePosts.length,
    measuredMaturePosts: measuredPosts.length,
    missingMetricsPosts,
    zeroViewMaturePosts: measuredPosts.filter((post) => post.views === 0).length,
  };
}

export function buildViralModeComparisons(
  posts: SummaryComparisonPost[],
  referenceTime: Date
): Array<MatureComparison & { viralIntentModeId: string }> {
  const groups = new Map<string, SummaryComparisonPost[]>();
  for (const post of posts) {
    const modeId = resolveSummaryViralIntentModeId(post);
    if (!modeId) continue;
    groups.set(modeId, [...(groups.get(modeId) ?? []), post]);
  }

  return Array.from(groups, ([viralIntentModeId, groupedPosts]) => ({
    viralIntentModeId,
    ...buildMatureComparison(groupedPosts, referenceTime),
  }));
}

export function buildLinkExposureComparison(
  posts: SummaryComparisonPost[],
  referenceTime: Date
): { linked: MatureComparison; control: MatureComparison } {
  return {
    linked: buildMatureComparison(posts.filter((post) => Boolean(post.linkUrl)), referenceTime),
    control: buildMatureComparison(posts.filter((post) => !post.linkUrl), referenceTime),
  };
}

function buildMatureComparison(
  posts: SummaryComparisonPost[],
  referenceTime: Date
): MatureComparison {
  const maturePosts = posts.filter((post) => isMature(post, referenceTime));
  const measuredPosts = maturePosts.filter(hasMatureMetrics);
  const views = measuredPosts.map((post) => post.views ?? 0);
  const totalViews = views.reduce((sumValue, value) => sumValue + value, 0);

  return {
    totalPosts: posts.length,
    maturePosts: maturePosts.length,
    measuredPosts: measuredPosts.length,
    missingMetricsPosts: maturePosts.length - measuredPosts.length,
    medianViews: median(views),
    replyRate: percentage(sumPostMetric(measuredPosts, "replies"), totalViews),
    repostRate: percentage(sumPostMetric(measuredPosts, "reposts"), totalViews),
  };
}

function isMature(post: SummaryComparisonPost, referenceTime: Date): boolean {
  return Boolean(
    post.publishedAt
    && referenceTime.getTime() - post.publishedAt.getTime() >= MATURITY_MS
  );
}

function hasMatureMetrics(post: SummaryComparisonPost): boolean {
  if (!post.publishedAt || !post.metricsAt || post.views === null) return false;
  return post.metricsAt.getTime() >= post.publishedAt.getTime() + MATURITY_MS;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function sumPostMetric(posts: SummaryComparisonPost[], key: "replies" | "reposts"): number {
  return posts.reduce((total, post) => total + (post[key] ?? 0), 0);
}

function percentage(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 10_000) / 100;
}

export function sumMetricValue(posts: SummaryMetricPost[], metricName: string): number {
  const normalized = metricName.trim();
  if (normalized === "views") return posts.reduce((sum, post) => sum + (post.views ?? 0), 0);
  if (normalized === "replies") return posts.reduce((sum, post) => sum + (post.replies ?? 0), 0);
  if (normalized === "reposts") return posts.reduce((sum, post) => sum + (post.reposts ?? 0), 0);
  if (normalized === "clicks") return posts.reduce((sum, post) => sum + (post.clicks ?? 0), 0);
  if (normalized === "conversions") return posts.reduce((sum, post) => sum + (post.conversions ?? 0), 0);
  if (normalized === "manualPaidConversions") return posts.reduce((sum, post) => sum + (post.manualPaidConversions ?? 0), 0);
  return 0;
}

export function buildCampaignNextAction(posts: SummaryMetricPost[], primaryMetric: string, conversionMetric: string): string {
  if (posts.length === 0) return "첫 배치를 생성하고 제품 가설에 맞는 hook/CTA를 넓게 테스트하세요.";
  const qualityFailed = posts.filter((post) => post.qualityPass === false).length;
  if (qualityFailed / posts.length >= 0.3) return "품질 실패 비율이 높습니다. 제품 키워드와 CTA를 더 명확히 넣어 재생성하세요.";
  if (sumMetricValue(posts, conversionMetric) > 0) return "전환 신호가 있습니다. 같은 오퍼 약속을 유지하고 hook만 변주하세요.";
  if (sumMetricValue(posts, primaryMetric) === 0) return "핵심 지표가 아직 비어 있습니다. 게시 후 수동 성과를 먼저 입력하세요.";
  return "성과가 있는 주제 1개를 고르고 다음 배치에서 CTA만 바꿔 비교하세요.";
}
