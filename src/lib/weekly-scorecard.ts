// Weekly scorecard: the one screen that says where the funnel leaks this week.
// Pure function over published posts; the API route owns the DB query.

export const BREAKOUT_VIEWS = 10_000;
export const MATURITY_HOURS = 72;
export const MIN_FORMULA_SAMPLE = 2;
export const MAX_FORMULA_ROWS = 8;

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

// Diagnosis thresholds, in evaluation order
const SAMPLE_MIN_MEASURED = 5;
const OPS_REVIEW_QUEUE = 10;
const REACH_MEDIAN_VIEWS = 300;
const CONVERSION_MIN_VIEWS = 1_000;
const CONVERSION_MIN_CLICKS_PER_1K = 5;
const CONVERSION_MIN_CLICKS_FOR_ZERO_CHECK = 10;

export interface ScorecardPostInput {
  publishedAt: Date | null;
  metricsAt: Date | null;
  status: string;
  views: number | null;
  replies: number | null;
  reposts: number | null;
  clicks: number | null;
  conversions: number | null;
  manualPaidConversions: number | null;
  formulaId: string | null;
  linkUrl: string | null;
}

export interface WeekBucket {
  label: string;
  startsAt: string;
  endsAt: string;
  published: number;
  measured: number;
  medianViews: number | null;
  breakoutCount: number;
  breakoutRate: number;
  funnel: { views: number; clicks: number; conversions: number; paid: number };
  clicksPer1kViews: number | null;
  conversionsPerClickPct: number | null;
  linked: { posts: number; medianViews: number | null; clicks: number };
  unlinked: { posts: number; medianViews: number | null };
}

export interface FormulaRow {
  formulaId: string;
  posts: number;
  medianViews: number | null;
  breakoutRate: number;
  clicks: number;
  conversions: number;
  paid: number;
}

export type Bottleneck = "sample" | "reach" | "conversion" | "ops" | "none";

export interface Diagnosis {
  bottleneck: Bottleneck;
  nextAction: string;
}

export interface WeeklyScorecard extends Diagnosis {
  generatedAt: string;
  weeks: WeekBucket[];
  formulas: FormulaRow[];
}

interface ScorecardOptions {
  now: Date;
  weeks?: number;
  reviewQueue: number;
  pendingQueue: number;
}

type MeasuredPost = ScorecardPostInput & { publishedAt: Date; views: number };

export function buildWeeklyScorecard(posts: ScorecardPostInput[], options: ScorecardOptions): WeeklyScorecard {
  const weekCount = Math.min(12, Math.max(1, options.weeks ?? 4));
  const windowStart = options.now.getTime() - weekCount * WEEK_MS;
  const published = posts.filter(
    (post): post is ScorecardPostInput & { publishedAt: Date } =>
      post.status === "PUBLISHED" && post.publishedAt instanceof Date && post.publishedAt.getTime() >= windowStart && post.publishedAt.getTime() <= options.now.getTime()
  );

  const weeks = Array.from({ length: weekCount }, (_, index) => {
    const endsAt = options.now.getTime() - index * WEEK_MS;
    const startsAt = endsAt - WEEK_MS;
    const inWeek = published.filter((post) => post.publishedAt.getTime() > startsAt && post.publishedAt.getTime() <= endsAt);
    return buildWeekBucket(inWeek, index, startsAt, endsAt, options.now);
  });

  const diagnosis = diagnoseBottleneck(weeks, { reviewQueue: options.reviewQueue });

  return {
    generatedAt: options.now.toISOString(),
    weeks,
    formulas: buildFormulaRows(published.filter((post) => isMeasured(post, options.now))),
    ...diagnosis,
  };
}

export function diagnoseBottleneck(weeks: WeekBucket[], queue: { reviewQueue: number }): Diagnosis {
  const recent = weeks.slice(0, 2);
  const measured = sum(recent.map((week) => week.measured));
  if (measured < SAMPLE_MIN_MEASURED) {
    return { bottleneck: "sample", nextAction: `표본 부족 (최근 2주 측정 ${measured}개): 발행을 유지하고 72시간 뒤 다시 확인` };
  }
  if (queue.reviewQueue >= OPS_REVIEW_QUEUE) {
    return { bottleneck: "ops", nextAction: `리뷰 큐 ${queue.reviewQueue}개 적체: 큐를 승인하거나 승자 공식 자동 승인 기준을 완화` };
  }

  const views = sum(recent.map((week) => week.funnel.views));
  const clicks = sum(recent.map((week) => week.funnel.clicks));
  const conversions = sum(recent.map((week) => week.funnel.conversions));
  const breakouts = sum(recent.map((week) => week.breakoutCount));
  const medianViews = median(recent.map((week) => week.medianViews).filter((value): value is number => value !== null));

  if (breakouts === 0 && (medianViews ?? 0) < REACH_MEDIAN_VIEWS) {
    return { bottleneck: "reach", nextAction: `도달 병목 (중앙값 ${medianViews ?? 0}뷰, 1만뷰 돌파 0건): 상위 공식 비중을 늘리고 훅을 실험` };
  }

  const clicksPer1k = views > 0 ? (clicks / views) * 1000 : 0;
  if (views >= CONVERSION_MIN_VIEWS && (clicksPer1k < CONVERSION_MIN_CLICKS_PER_1K || (clicks >= CONVERSION_MIN_CLICKS_FOR_ZERO_CHECK && conversions === 0))) {
    return { bottleneck: "conversion", nextAction: `전환 병목 (1천뷰당 클릭 ${round(clicksPer1k, 1)}, 전환 ${conversions}건): CTA·링크 목적지·링크 비율을 점검` };
  }

  return { bottleneck: "none", nextAction: "정상: 현재 배분을 유지하고 승자 공식을 20~30% 증량" };
}

function buildWeekBucket(posts: Array<ScorecardPostInput & { publishedAt: Date }>, index: number, startsAt: number, endsAt: number, now: Date): WeekBucket {
  const measured = posts.filter((post): post is MeasuredPost => isMeasured(post, now));
  const views = measured.map((post) => post.views);
  const funnel = {
    views: sum(views),
    clicks: sum(measured.map((post) => post.clicks ?? 0)),
    conversions: sum(measured.map((post) => post.conversions ?? 0)),
    paid: sum(measured.map((post) => post.manualPaidConversions ?? 0)),
  };
  const breakoutCount = views.filter((value) => value >= BREAKOUT_VIEWS).length;
  const linked = measured.filter((post) => Boolean(post.linkUrl));
  const unlinked = measured.filter((post) => !post.linkUrl);

  return {
    label: index === 0 ? "최근 7일" : `${index * 7 + 1}~${(index + 1) * 7}일 전`,
    startsAt: new Date(startsAt).toISOString(),
    endsAt: new Date(endsAt).toISOString(),
    published: posts.length,
    measured: measured.length,
    medianViews: median(views),
    breakoutCount,
    breakoutRate: rate(breakoutCount, measured.length),
    funnel,
    clicksPer1kViews: funnel.views > 0 ? round((funnel.clicks / funnel.views) * 1000, 2) : null,
    conversionsPerClickPct: funnel.clicks > 0 ? round((funnel.conversions / funnel.clicks) * 100, 1) : null,
    linked: { posts: linked.length, medianViews: median(linked.map((post) => post.views)), clicks: sum(linked.map((post) => post.clicks ?? 0)) },
    unlinked: { posts: unlinked.length, medianViews: median(unlinked.map((post) => post.views)) },
  };
}

function buildFormulaRows(measured: ScorecardPostInput[]): FormulaRow[] {
  const groups = new Map<string, MeasuredPost[]>();
  for (const post of measured) {
    if (!post.formulaId || typeof post.views !== "number" || !post.publishedAt) continue;
    const list = groups.get(post.formulaId) ?? [];
    list.push(post as MeasuredPost);
    groups.set(post.formulaId, list);
  }

  return Array.from(groups.entries())
    .filter(([, posts]) => posts.length >= MIN_FORMULA_SAMPLE)
    .map(([formulaId, posts]) => ({
      formulaId,
      posts: posts.length,
      medianViews: median(posts.map((post) => post.views)),
      breakoutRate: rate(posts.filter((post) => post.views >= BREAKOUT_VIEWS).length, posts.length),
      clicks: sum(posts.map((post) => post.clicks ?? 0)),
      conversions: sum(posts.map((post) => post.conversions ?? 0)),
      paid: sum(posts.map((post) => post.manualPaidConversions ?? 0)),
    }))
    .sort((a, b) => (b.medianViews ?? 0) - (a.medianViews ?? 0))
    .slice(0, MAX_FORMULA_ROWS);
}

function isMeasured(post: ScorecardPostInput, now: Date): post is MeasuredPost {
  if (!post.publishedAt || typeof post.views !== "number" || !post.metricsAt) return false;
  const maturesAt = post.publishedAt.getTime() + MATURITY_HOURS * 60 * 60 * 1000;
  return post.metricsAt.getTime() >= maturesAt && maturesAt <= now.getTime();
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function rate(part: number, total: number): number {
  return total === 0 ? 0 : round((part / total) * 100, 1);
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
