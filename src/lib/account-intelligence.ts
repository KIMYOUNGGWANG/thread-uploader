import type { Brand, Post } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calculatePerformanceScore, getPerformanceTier } from "@/lib/growth-learning";
import { fetchPostInsightsForBrand } from "@/lib/threads-api";
import type {
  AccountInsightAction,
  AccountInsightMetrics,
  AccountInsightSnapshot,
} from "@/types/account-intelligence";

const DEFAULT_WINDOW_HOURS = 48;
const MAX_METRICS_REFRESH_POSTS = 30;
const METRICS_REFRESH_DELAY_MS = 500;

interface RunOptions {
  windowHours?: number;
  fetchMetrics?: boolean;
  source?: string;
}

interface MetricsRefreshResult {
  attempted: number;
  updated: number;
  failed: number;
}

type InsightPost = Post;

export async function runAccountIntelligence(
  brandId: string,
  options: RunOptions = {}
): Promise<AccountInsightSnapshot> {
  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!brand) throw new Error("Brand not found");

  const windowHours = options.windowHours ?? DEFAULT_WINDOW_HOURS;
  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - windowHours * 60 * 60 * 1000);
  const metricsRefresh = options.fetchMetrics === false
    ? { attempted: 0, updated: 0, failed: 0 }
    : await refreshRecentMetrics(brand, windowStart);
  const posts = await loadWindowPosts(brand.id, windowStart, windowEnd);
  const metrics = buildMetrics(posts, windowHours, metricsRefresh);
  const actions = buildActions(posts, metrics);
  const summary = buildSummary(metrics, actions);

  const insight = await prisma.accountInsight.create({
    data: {
      brandId: brand.id,
      windowStart,
      windowEnd,
      source: options.source ?? "manual",
      summary,
      actions: JSON.stringify(actions),
      metrics: JSON.stringify(metrics),
    },
  });

  return formatInsight(insight);
}

export async function getAccountIntelligenceReport(brandId: string) {
  const insights = await prisma.accountInsight.findMany({
    where: { brandId },
    orderBy: { generatedAt: "desc" },
    take: 8,
  });

  return {
    latest: insights[0] ? formatInsight(insights[0]) : null,
    history: insights.map(formatInsight),
  };
}

async function refreshRecentMetrics(brand: Brand, windowStart: Date): Promise<MetricsRefreshResult> {
  const posts = await prisma.post.findMany({
    where: {
      brandId: brand.id,
      status: "PUBLISHED",
      threadsId: { not: null },
      scheduledAt: { gte: windowStart },
    },
    orderBy: { scheduledAt: "desc" },
    take: MAX_METRICS_REFRESH_POSTS,
  });

  const result = { attempted: posts.length, updated: 0, failed: 0 };
  for (const post of posts) {
    try {
      const insights = await fetchPostInsightsForBrand(post.threadsId!, brand.accessToken);
      const performanceScore = calculatePerformanceScore({
        ...insights,
        clicks: post.clicks,
        conversions: post.conversions,
        manualPaidConversions: post.manualPaidConversions,
      });
      await prisma.post.update({
        where: { id: post.id },
        data: {
          ...insights,
          metricsAt: new Date(),
          performanceScore,
          performanceTier: getPerformanceTier(performanceScore),
        },
      });
      result.updated++;
    } catch (error) {
      result.failed++;
      console.warn(`[account-intelligence] metrics skipped for ${post.id}:`, error);
    }
    await delay(METRICS_REFRESH_DELAY_MS);
  }
  return result;
}

function loadWindowPosts(brandId: string, windowStart: Date, windowEnd: Date): Promise<InsightPost[]> {
  return prisma.post.findMany({
    where: {
      brandId,
      scheduledAt: {
        gte: windowStart,
        lte: windowEnd,
      },
      status: { in: ["PENDING", "PUBLISHED", "FAILED"] },
    },
    orderBy: { scheduledAt: "desc" },
    take: 300,
  });
}

function buildMetrics(
  posts: InsightPost[],
  windowHours: number,
  metricsRefresh: MetricsRefreshResult
): AccountInsightMetrics {
  const publishedPosts = posts.filter((post) => post.status === "PUBLISHED");
  const scores = publishedPosts.map((post) => getPostScore(post));

  return {
    windowHours,
    totalPosts: posts.length,
    publishedPosts: publishedPosts.length,
    pendingPosts: posts.filter((post) => post.status === "PENDING").length,
    linkedPosts: posts.filter((post) => Boolean(post.linkUrl)).length,
    qualityFailedPosts: posts.filter((post) => post.qualityPass === false).length,
    totalViews: sum(publishedPosts, "views"),
    totalReplies: sum(publishedPosts, "replies"),
    totalReposts: sum(publishedPosts, "reposts"),
    totalClicks: sum(posts, "clicks"),
    totalConversions: sum(posts, "conversions") + sum(posts, "manualPaidConversions"),
    avgPerformanceScore: scores.length ? Math.round(scores.reduce((total, score) => total + score, 0) / scores.length) : 0,
    metricsRefresh,
  };
}

function buildActions(posts: InsightPost[], metrics: AccountInsightMetrics): AccountInsightAction[] {
  return [
    ...buildReplyActions(posts),
    ...buildQualityActions(posts, metrics),
    ...buildLinkRatioActions(posts),
    ...buildFormatActions(posts),
    ...buildWatchActions(posts),
  ].slice(0, 8);
}

function buildReplyActions(posts: InsightPost[]): AccountInsightAction[] {
  return posts
    .filter((post) => post.status === "PUBLISHED" && (post.replies ?? 0) > 0)
    .sort((a, b) => (b.replies ?? 0) - (a.replies ?? 0))
    .slice(0, 3)
    .map((post, index) => ({
      id: `reply_now_${post.id}`,
      type: "reply_now",
      priority: (post.replies ?? 0) >= 3 ? "high" : "medium",
      title: index === 0 ? "지금 답글 달 글" : "답글 후보",
      detail: `댓글 ${post.replies ?? 0}개 · 리포스트 ${post.reposts ?? 0}개. Reply Playbook으로 대응하기 좋습니다.`,
      postId: post.id,
      campaignId: post.campaignId ?? undefined,
      formulaId: post.campaignFormulaId ?? post.formulaId ?? undefined,
      score: getPostScore(post),
    } satisfies AccountInsightAction));
}

function buildQualityActions(
  posts: InsightPost[],
  metrics: AccountInsightMetrics
): AccountInsightAction[] {
  if (metrics.totalPosts === 0 || metrics.qualityFailedPosts === 0) return [];
  const failRatio = metrics.qualityFailedPosts / metrics.totalPosts;
  if (failRatio < 0.2 && metrics.qualityFailedPosts < 2) return [];

  return [{
    id: "quality_warning",
    type: "quality_warning",
    priority: failRatio >= 0.35 ? "high" : "medium",
    title: "Quality fail 비율 확인",
    detail: `${metrics.qualityFailedPosts}/${metrics.totalPosts}개가 gate를 통과하지 못했습니다. 생성 프롬프트나 토픽을 조정하세요.`,
  }];
}

function buildLinkRatioActions(posts: InsightPost[]): AccountInsightAction[] {
  const campaignPosts = posts.filter((post) => post.campaignId);
  if (campaignPosts.length < 3) return [];

  const linkedPosts = campaignPosts.filter((post) => post.linkUrl).length;
  const ratio = linkedPosts / campaignPosts.length;
  if (ratio <= 0.45) return [];

  return [{
    id: "link_ratio_warning",
    type: "link_ratio_warning",
    priority: ratio >= 0.6 ? "high" : "medium",
    title: "링크 비율이 높음",
    detail: `최근 캠페인 글 ${campaignPosts.length}개 중 ${linkedPosts}개가 링크 포함입니다. 3개 중 1개 cadence를 유지하세요.`,
    campaignId: campaignPosts[0]?.campaignId ?? undefined,
  }];
}

function buildFormatActions(posts: InsightPost[]): AccountInsightAction[] {
  const groups = groupPublishedByFormula(posts);
  if (groups.length < 2) return [];

  const [best] = groups;
  const worst = groups[groups.length - 1];
  const actions: AccountInsightAction[] = [];

  if (best && best.count >= 2) {
    actions.push({
      id: `boost_format_${best.formulaId}`,
      type: "boost_format",
      priority: "medium",
      title: "늘릴 포맷",
      detail: `${best.formulaId} 평균 점수 ${best.avgScore}. 다음 배치에서 비중을 조금 높여볼 만합니다.`,
      formulaId: best.formulaId,
      score: best.avgScore,
    });
  }
  if (worst && worst.count >= 2 && best && best.avgScore > worst.avgScore * 1.4) {
    actions.push({
      id: `reduce_format_${worst.formulaId}`,
      type: "reduce_format",
      priority: "low",
      title: "줄일 포맷",
      detail: `${worst.formulaId} 평균 점수 ${worst.avgScore}. 훅이나 CTA를 바꿔 재실험하세요.`,
      formulaId: worst.formulaId,
      score: worst.avgScore,
    });
  }
  return actions;
}

function buildWatchActions(posts: InsightPost[]): AccountInsightAction[] {
  const candidate = posts
    .filter((post) => post.status === "PUBLISHED" && (post.views ?? 0) >= 200 && (post.replies ?? 0) === 0)
    .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))[0];

  if (!candidate) return [];
  return [{
    id: `watch_post_${candidate.id}`,
    type: "watch_post",
    priority: "low",
    title: "조회는 있는데 댓글이 약함",
    detail: `조회 ${candidate.views ?? 0}회지만 댓글이 없습니다. CTA 답글이나 다음 변주에서 댓글 유도를 강화하세요.`,
    postId: candidate.id,
    campaignId: candidate.campaignId ?? undefined,
    formulaId: candidate.campaignFormulaId ?? candidate.formulaId ?? undefined,
    score: getPostScore(candidate),
  }];
}

function buildSummary(metrics: AccountInsightMetrics, actions: AccountInsightAction[]): string {
  if (metrics.totalPosts === 0) {
    return `최근 ${metrics.windowHours}시간 안에 분석할 포스트가 없습니다.`;
  }
  const highPriorityCount = actions.filter((action) => action.priority === "high").length;
  return [
    `최근 ${metrics.windowHours}시간: 발행 ${metrics.publishedPosts}개, 예약 ${metrics.pendingPosts}개.`,
    `댓글 ${metrics.totalReplies}개, 리포스트 ${metrics.totalReposts}개, 평균 점수 ${metrics.avgPerformanceScore}.`,
    highPriorityCount > 0 ? `우선 처리 ${highPriorityCount}건이 있습니다.` : "긴급 액션은 없습니다.",
  ].join(" ");
}

function groupPublishedByFormula(posts: InsightPost[]) {
  const groups = new Map<string, InsightPost[]>();
  for (const post of posts) {
    if (post.status !== "PUBLISHED") continue;
    const formulaId = post.campaignFormulaId ?? post.formulaId;
    if (!formulaId) continue;
    groups.set(formulaId, [...(groups.get(formulaId) ?? []), post]);
  }

  return Array.from(groups.entries())
    .map(([formulaId, group]) => ({
      formulaId,
      count: group.length,
      avgScore: Math.round(group.reduce((total, post) => total + getPostScore(post), 0) / group.length),
    }))
    .sort((a, b) => b.avgScore - a.avgScore);
}

function formatInsight(insight: {
  id: string;
  brandId: string;
  generatedAt: Date;
  windowStart: Date;
  windowEnd: Date;
  source: string;
  summary: string;
  actions: string;
  metrics: string;
}): AccountInsightSnapshot {
  return {
    id: insight.id,
    brandId: insight.brandId,
    generatedAt: insight.generatedAt.toISOString(),
    windowStart: insight.windowStart.toISOString(),
    windowEnd: insight.windowEnd.toISOString(),
    source: insight.source,
    summary: insight.summary,
    actions: parseJsonList<AccountInsightAction>(insight.actions),
    metrics: parseJsonObject<AccountInsightMetrics>(insight.metrics, emptyMetrics()),
  };
}

function getPostScore(post: InsightPost): number {
  return post.performanceScore ?? calculatePerformanceScore(post);
}

function sum(posts: InsightPost[], key: keyof InsightPost): number {
  return posts.reduce((total, post) => {
    const value = post[key];
    return total + (typeof value === "number" ? value : 0);
  }, 0);
}

function parseJsonList<T>(raw: string): T[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

function parseJsonObject<T>(raw: string, fallback: T): T {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return typeof parsed === "object" && parsed !== null ? parsed as T : fallback;
  } catch {
    return fallback;
  }
}

function emptyMetrics(): AccountInsightMetrics {
  return {
    windowHours: DEFAULT_WINDOW_HOURS,
    totalPosts: 0,
    publishedPosts: 0,
    pendingPosts: 0,
    linkedPosts: 0,
    qualityFailedPosts: 0,
    totalViews: 0,
    totalReplies: 0,
    totalReposts: 0,
    totalClicks: 0,
    totalConversions: 0,
    avgPerformanceScore: 0,
    metricsRefresh: { attempted: 0, updated: 0, failed: 0 },
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
