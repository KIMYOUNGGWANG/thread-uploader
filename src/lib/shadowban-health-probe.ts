/**
 * Silent Shadowban Health Probe & Self-Healing Guard
 *
 * Automatically monitors account reach velocity across rolling post windows,
 * flags stealth shadowbans (when Meta silently suppresses reach by >85%),
 * and triggers self-healing remediation (freezing polarizing formulas and switching to safe warmup mode).
 */

export interface PostReachRecord {
  postId: string;
  views: number;
  likes: number;
  replies: number;
  publishedAt: Date;
}

export type ShadowbanHealthStatus = "HEALTHY" | "WARNING" | "SHADOWBAN_SUSPECTED";

export interface ShadowbanProbeOptions {
  recentWindowSize?: number; // default 3 posts
  baselineWindowSize?: number; // default 15 posts
  dropThresholdWarning?: number; // default 0.50 (50% drop)
  dropThresholdSuspected?: number; // default 0.85 (85% drop)
  minBaselineViews?: number; // default 100
  minHoursSincePublished?: number; // default 6 (T+6h filter to prevent Meta API lag false positives)
  minTotalPostsForColdStart?: number; // default 5
  referenceTime?: Date; // default current date
}

export interface ShadowbanHealthReport {
  status: ShadowbanHealthStatus;
  recentAverageViews: number;
  baselineAverageViews: number;
  dropPercentage: number;
  analyzedPostCount: number;
  consecutiveDepressedCount: number;
  reasons: string[];
}

export interface SelfHealingDirective {
  mode: "NORMAL" | "MONITOR" | "WARMUP_ONLY";
  freezePolarizingFormulas: boolean;
  maxDailyPosts: number;
  forbiddenElements: string[];
  actionMessage: string;
}

const DEFAULT_OPTIONS: Required<ShadowbanProbeOptions> = {
  recentWindowSize: 3,
  baselineWindowSize: 15,
  dropThresholdWarning: 0.5,
  dropThresholdSuspected: 0.85,
  minBaselineViews: 100,
  minHoursSincePublished: 6,
  minTotalPostsForColdStart: 5,
  referenceTime: new Date(),
};

/**
 * Evaluates account health based on recent post reach metrics versus historical baseline.
 */
export function evaluateShadowbanHealth(
  history: PostReachRecord[],
  options: ShadowbanProbeOptions = {}
): ShadowbanHealthReport {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const refTime = (options.referenceTime ?? new Date()).getTime();
  const minAgeMs = (opts.minHoursSincePublished ?? 6) * 60 * 60 * 1000;

  // Filter out immature posts (< 6 hours old) to avoid Meta API lag false positives
  const maturePosts = history.filter((p) => {
    if (opts.minHoursSincePublished === 0) return true;
    const age = refTime - p.publishedAt.getTime();
    return age >= minAgeMs;
  });

  // Cold start guard: if mature posts count is below minimum, remain HEALTHY
  if (maturePosts.length < opts.minTotalPostsForColdStart) {
    return {
      status: "HEALTHY",
      recentAverageViews: 0,
      baselineAverageViews: 0,
      dropPercentage: 0,
      analyzedPostCount: maturePosts.length,
      consecutiveDepressedCount: 0,
      reasons: [
        `데이터 축적 중 (T+${opts.minHoursSincePublished}h 경과 포스트 ${maturePosts.length}/${opts.minTotalPostsForColdStart}개, 콜드 스타트 보호 모드).`,
      ],
    };
  }

  const sorted = [...maturePosts].sort(
    (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime()
  );

  if (sorted.length < opts.recentWindowSize) {
    return {
      status: "HEALTHY",
      recentAverageViews: 0,
      baselineAverageViews: 0,
      dropPercentage: 0,
      analyzedPostCount: sorted.length,
      consecutiveDepressedCount: 0,
      reasons: ["분석을 위한 최소 포스트 수(3개) 부족. 정상 모드 유지."],
    };
  }

  const recent = sorted.slice(0, opts.recentWindowSize);
  const baseline = sorted.slice(opts.recentWindowSize, opts.recentWindowSize + opts.baselineWindowSize);

  const recentAvg = recent.reduce((sum, p) => sum + p.views, 0) / recent.length;

  // If no baseline exists or baseline reach is too low to establish a signal
  if (baseline.length === 0) {
    return {
      status: "HEALTHY",
      recentAverageViews: Math.round(recentAvg),
      baselineAverageViews: Math.round(recentAvg),
      dropPercentage: 0,
      analyzedPostCount: sorted.length,
      consecutiveDepressedCount: 0,
      reasons: ["이전 기준선(Baseline) 포스트 부족으로 정상 모드 유지."],
    };
  }

  const baselineAvg = baseline.reduce((sum, p) => sum + p.views, 0) / baseline.length;

  if (baselineAvg < opts.minBaselineViews) {
    return {
      status: "HEALTHY",
      recentAverageViews: Math.round(recentAvg),
      baselineAverageViews: Math.round(baselineAvg),
      dropPercentage: 0,
      analyzedPostCount: sorted.length,
      consecutiveDepressedCount: 0,
      reasons: ["기준선 평균 노출 수가 100회 미만이므로 노이즈 구간으로 판단, 정상 유지."],
    };
  }

  const dropRatio = Math.max(0, (baselineAvg - recentAvg) / baselineAvg);
  const dropPercentage = Math.round(dropRatio * 100);

  // Check how many of the recent posts were severely depressed (< 20% of baseline)
  const depressedCutoff = baselineAvg * 0.2;
  const consecutiveDepressedCount = recent.filter((p) => p.views <= depressedCutoff).length;

  const reasons: string[] = [];
  let status: ShadowbanHealthStatus = "HEALTHY";

  if (dropRatio >= opts.dropThresholdSuspected && consecutiveDepressedCount >= opts.recentWindowSize) {
    status = "SHADOWBAN_SUSPECTED";
    reasons.push(
      `최근 ${opts.recentWindowSize}개 포스트의 노출수가 기준선(${Math.round(baselineAvg)}뷰) 대비 ${dropPercentage}% 급락함 (스텔스 섀도우밴 위험).`
    );
  } else if (dropRatio >= opts.dropThresholdWarning) {
    status = "WARNING";
    reasons.push(
      `노출수가 기준선 대비 ${dropPercentage}% 감소하여 주의 필요 (경고 구간).`
    );
  } else {
    reasons.push("노출수와 인게이지먼트가 정상 범위 내에 있습니다.");
  }

  return {
    status,
    recentAverageViews: Math.round(recentAvg),
    baselineAverageViews: Math.round(baselineAvg),
    dropPercentage,
    analyzedPostCount: sorted.length,
    consecutiveDepressedCount,
    reasons,
  };
}

/**
 * Returns self-healing instructions based on health evaluation.
 */
export function getSelfHealingAction(report: ShadowbanHealthReport): SelfHealingDirective {
  switch (report.status) {
    case "SHADOWBAN_SUSPECTED":
      return {
        mode: "WARMUP_ONLY",
        freezePolarizingFormulas: true,
        maxDailyPosts: 1,
        forbiddenElements: ["외부 링크", "서열 비교/어그로 훅", "상업적 CTA", "첫 댓글 플러그"],
        actionMessage:
          "스텔스 섀도우밴 감지: 공격적 공식이 동결되었으며, 14일간 무해한 공감형 일상/토론 포스트(1일 1회)로 계정 신뢰도 회복(자가 치유) 모드가 실행됩니다.",
      };
    case "WARNING":
      return {
        mode: "MONITOR",
        freezePolarizingFormulas: false,
        maxDailyPosts: 2,
        forbiddenElements: ["본문 링크", "과도한 느낌표"],
        actionMessage:
          "도달율 하락 주의: 자극적인 후킹을 지양하고 가치 제공 및 대화형 포스트 비중을 70% 이상으로 유지하십시오.",
      };
    case "HEALTHY":
    default:
      return {
        mode: "NORMAL",
        freezePolarizingFormulas: false,
        maxDailyPosts: 5,
        forbiddenElements: ["본문 외부 링크"],
        actionMessage: "계정 상태가 매우 건강합니다. 톰슨 샘플링 최적화가 정상 가동 중입니다.",
      };
  }
}
