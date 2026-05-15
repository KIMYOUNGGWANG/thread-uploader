import type { GrowthMemory, GrowthPattern } from "@/types/brand";
import { EMPTY_GROWTH_MEMORY, parseGrowthMemory } from "@/types/brand";

export interface GrowthPostInput {
  id: string;
  formulaId: string | null;
  topic: string | null;
  targetAudience: string | null;
  hookType: string | null;
  ctaType: string | null;
  views: number | null;
  likes: number | null;
  replies: number | null;
  reposts: number | null;
  performanceScore: number | null;
}

interface PerformanceMetrics {
  views: number | null;
  likes: number | null;
  replies: number | null;
  reposts: number | null;
  clicks?: number | null;
  conversions?: number | null;
  manualPaidConversions?: number | null;
}

type GrowthDimension = GrowthPattern["dimension"];

export function calculatePerformanceScore(metrics: PerformanceMetrics): number {
  const views = metrics.views ?? 0;
  const replies = metrics.replies ?? 0;
  const reposts = metrics.reposts ?? 0;
  const clicks = metrics.clicks ?? 0;
  const conversions = metrics.conversions ?? 0;
  const manualPaidConversions = metrics.manualPaidConversions ?? 0;
  const conversionSignal = clicks + conversions * 5 + manualPaidConversions * 20;
  return Math.round(views * 0.2 + replies * 40 + reposts * 25 + conversionSignal * 15);
}

export function getPerformanceTier(score: number): string {
  if (score >= 1000) return "breakout";
  if (score >= 300) return "strong";
  if (score >= 80) return "promising";
  return "learning";
}

export function parseStoredGrowthMemory(raw: string): GrowthMemory {
  return parseGrowthMemory(raw);
}

export function buildGrowthMemory(posts: GrowthPostInput[]): GrowthMemory {
  const scoredPosts = posts.filter((post) => getPostScore(post) !== null);
  if (scoredPosts.length === 0) return EMPTY_GROWTH_MEMORY;

  const scores = scoredPosts.map((post) => getPostScore(post) ?? 0);
  const avgScore = average(scores);
  const patterns = buildAllPatternSummaries(scoredPosts);
  const winners = patterns.filter((pattern) => pattern.count >= 2).slice(0, 5);
  const weakSignals = [...patterns]
    .filter((pattern) => pattern.count >= 2)
    .sort((a, b) => a.avgScore - b.avgScore)
    .slice(0, 5);

  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    sampleSize: scoredPosts.length,
    avgScore,
    winners,
    weakSignals,
    recommendations: buildRecommendations(winners, weakSignals, scoredPosts.length),
  };
}

export function buildGrowthReport(posts: GrowthPostInput[], memory: GrowthMemory) {
  const scoredPosts = posts.filter((post) => getPostScore(post) !== null);
  const patterns = buildAllPatternSummaries(scoredPosts);
  const recentPosts = scoredPosts
    .slice(0, 10)
    .map((post) => ({
      id: post.id,
      formulaId: post.formulaId,
      topic: post.topic,
      hookType: post.hookType,
      ctaType: post.ctaType,
      score: getPostScore(post) ?? 0,
      tier: getPerformanceTier(getPostScore(post) ?? 0),
    }));

  return {
    sampleSize: scoredPosts.length,
    memory,
    topPatterns: patterns.slice(0, 8),
    weakPatterns: [...patterns].sort((a, b) => a.avgScore - b.avgScore).slice(0, 8),
    recentPosts,
  };
}

export function formatGrowthPromptContext(memory: GrowthMemory): string {
  if (memory.sampleSize === 0 || memory.winners.length === 0) {
    return "아직 충분한 성과 학습 데이터가 없습니다. 다양한 훅/CTA/주제 조합을 넓게 실험하세요.";
  }

  const winners = memory.winners
    .slice(0, 4)
    .map((pattern) => `- 잘 먹힌 패턴: ${labelPattern(pattern)} (평균 ${pattern.avgScore}점)`);
  const weakSignals = memory.weakSignals
    .slice(0, 3)
    .map((pattern) => `- 약한 패턴: ${labelPattern(pattern)} (평균 ${pattern.avgScore}점)`);

  return [
    `최근 ${memory.sampleSize}개 성과 학습 결과:`,
    ...winners,
    ...weakSignals,
    "새 포스트는 승자 패턴을 참고하되, 같은 표현을 복붙하지 말고 새로운 각도로 변주하세요.",
  ].join("\n");
}

function buildAllPatternSummaries(posts: GrowthPostInput[]): GrowthPattern[] {
  return [
    ...buildPatternSummaries(posts, "formula", "formulaId"),
    ...buildPatternSummaries(posts, "hook", "hookType"),
    ...buildPatternSummaries(posts, "topic", "topic"),
    ...buildPatternSummaries(posts, "target", "targetAudience"),
    ...buildPatternSummaries(posts, "cta", "ctaType"),
  ].sort((a, b) => b.avgScore - a.avgScore);
}

function buildPatternSummaries(
  posts: GrowthPostInput[],
  dimension: GrowthDimension,
  key: keyof GrowthPostInput
): GrowthPattern[] {
  const groups = new Map<string, GrowthPostInput[]>();
  for (const post of posts) {
    const value = post[key];
    if (typeof value !== "string" || !value.trim()) continue;
    groups.set(value, [...(groups.get(value) ?? []), post]);
  }

  return Array.from(groups.entries()).map(([value, group]) => ({
    dimension,
    value,
    count: group.length,
    avgScore: average(group.map((post) => getPostScore(post) ?? 0)),
    avgViews: average(group.map((post) => post.views ?? 0)),
    avgLikes: average(group.map((post) => post.likes ?? 0)),
    avgReplies: average(group.map((post) => post.replies ?? 0)),
    avgReposts: average(group.map((post) => post.reposts ?? 0)),
  }));
}

function buildRecommendations(
  winners: GrowthPattern[],
  weakSignals: GrowthPattern[],
  sampleSize: number
): string[] {
  const recommendations = [];
  if (sampleSize < 10) {
    recommendations.push("아직 표본이 작습니다. 다음 배치는 훅/CTA를 넓게 분산해서 학습 데이터를 늘리세요.");
  }
  if (winners[0]) {
    recommendations.push(`${labelPattern(winners[0])} 조합을 다음 배치에서 20~30% 더 자주 테스트하세요.`);
  }
  if (weakSignals[0]) {
    recommendations.push(`${labelPattern(weakSignals[0])} 패턴은 문장 각도나 타겟을 바꿔 재실험하세요.`);
  }
  return recommendations;
}

function labelPattern(pattern: GrowthPattern): string {
  const labels: Record<GrowthDimension, string> = {
    formula: "공식",
    hook: "훅",
    topic: "주제",
    target: "타겟",
    cta: "CTA",
  };
  return `${labels[pattern.dimension]} '${pattern.value}'`;
}

function getPostScore(post: GrowthPostInput): number | null {
  if (post.performanceScore !== null) return post.performanceScore;
  if (post.views === null) return null;
  return calculatePerformanceScore(post);
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}
