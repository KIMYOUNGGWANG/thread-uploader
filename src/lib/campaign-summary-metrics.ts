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
