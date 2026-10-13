import { describe, expect, it } from "vitest";
import {
  BREAKOUT_VIEWS,
  buildWeeklyScorecard,
  diagnoseBottleneck,
  type ScorecardPostInput,
  type WeekBucket,
} from "@/lib/weekly-scorecard";

const now = new Date("2026-10-13T00:00:00Z");
const HOUR = 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * HOUR);

function post(overrides: Partial<ScorecardPostInput> & { daysAgo: number }): ScorecardPostInput {
  const publishedAt = daysAgo(overrides.daysAgo);
  return {
    publishedAt,
    metricsAt: new Date(publishedAt.getTime() + 80 * HOUR),
    status: "PUBLISHED",
    views: 100,
    replies: 0,
    reposts: 0,
    clicks: 0,
    conversions: 0,
    manualPaidConversions: 0,
    formulaId: "f1",
    linkUrl: null,
    ...overrides,
  };
}

function bucket(overrides: Partial<WeekBucket>): WeekBucket {
  return {
    label: "",
    startsAt: "",
    endsAt: "",
    published: 0,
    measured: 0,
    medianViews: null,
    breakoutCount: 0,
    breakoutRate: 0,
    funnel: { views: 0, clicks: 0, conversions: 0, paid: 0 },
    clicksPer1kViews: null,
    conversionsPerClickPct: null,
    linked: { posts: 0, medianViews: null, clicks: 0 },
    unlinked: { posts: 0, medianViews: null },
    ...overrides,
  };
}

describe("buildWeeklyScorecard", () => {
  it("buckets posts into 7-day windows ending now, newest first", () => {
    const card = buildWeeklyScorecard(
      [post({ daysAgo: 1 }), post({ daysAgo: 8 }), post({ daysAgo: 20 })],
      { now, weeks: 3, reviewQueue: 0, pendingQueue: 0 }
    );

    expect(card.weeks).toHaveLength(3);
    expect(card.weeks.map((week) => week.published)).toEqual([1, 1, 1]);
    expect(card.weeks[0].label).toBe("최근 7일");
    expect(card.weeks[1].label).toBe("8~14일 전");
  });

  it("counts a post as measured only when metrics were captured 72h after publish", () => {
    const immature = post({ daysAgo: 1, metricsAt: new Date(daysAgo(1).getTime() + 10 * HOUR) });
    const noMetrics = post({ daysAgo: 5, metricsAt: null, views: null });
    const mature = post({ daysAgo: 5 });

    const card = buildWeeklyScorecard([immature, noMetrics, mature], { now, weeks: 1, reviewQueue: 0, pendingQueue: 0 });

    expect(card.weeks[0].published).toBe(3);
    expect(card.weeks[0].measured).toBe(1);
  });

  it("computes breakout rate, median views and the funnel from measured posts", () => {
    const card = buildWeeklyScorecard(
      [
        post({ daysAgo: 4, views: BREAKOUT_VIEWS, clicks: 20, conversions: 2, manualPaidConversions: 1, linkUrl: "https://x" }),
        post({ daysAgo: 5, views: 500, clicks: 5 }),
        post({ daysAgo: 6, views: 100 }),
        post({ daysAgo: 6.5, views: 50 }),
      ],
      { now, weeks: 1, reviewQueue: 0, pendingQueue: 0 }
    );
    const week = card.weeks[0];

    expect(week.breakoutCount).toBe(1);
    expect(week.breakoutRate).toBe(25);
    expect(week.medianViews).toBe(300);
    expect(week.funnel).toEqual({ views: 10650, clicks: 25, conversions: 2, paid: 1 });
    expect(week.clicksPer1kViews).toBeCloseTo(2.35, 2);
    expect(week.conversionsPerClickPct).toBe(8);
    expect(week.linked).toEqual({ posts: 1, medianViews: BREAKOUT_VIEWS, clicks: 20 });
    expect(week.unlinked).toEqual({ posts: 3, medianViews: 100 });
  });

  it("ranks formulas by median views and drops formulas with fewer than 2 measured posts", () => {
    const card = buildWeeklyScorecard(
      [
        post({ daysAgo: 4, formulaId: "a", views: 100 }),
        post({ daysAgo: 4, formulaId: "a", views: 300 }),
        post({ daysAgo: 5, formulaId: "b", views: 2000, clicks: 3 }),
        post({ daysAgo: 5, formulaId: "b", views: BREAKOUT_VIEWS }),
        post({ daysAgo: 6, formulaId: "solo", views: 99999 }),
        post({ daysAgo: 6, formulaId: null, views: 99999 }),
      ],
      { now, weeks: 1, reviewQueue: 0, pendingQueue: 0 }
    );

    expect(card.formulas.map((row) => row.formulaId)).toEqual(["b", "a"]);
    expect(card.formulas[0]).toMatchObject({ posts: 2, medianViews: 6000, breakoutRate: 50, clicks: 3 });
  });

  it("ignores posts that are not published or fall outside the window", () => {
    const card = buildWeeklyScorecard(
      [post({ daysAgo: 1, status: "PENDING" }), post({ daysAgo: 40 }), post({ daysAgo: 1, publishedAt: null })],
      { now, weeks: 2, reviewQueue: 0, pendingQueue: 0 }
    );

    expect(card.weeks.every((week) => week.published === 0)).toBe(true);
    expect(card.bottleneck).toBe("sample");
  });
});

describe("diagnoseBottleneck", () => {
  const healthy = bucket({ measured: 5, medianViews: 800, breakoutRate: 10, funnel: { views: 20000, clicks: 200, conversions: 5, paid: 1 }, clicksPer1kViews: 10 });

  it("asks for more sample before anything else", () => {
    expect(diagnoseBottleneck([bucket({ measured: 2 }), bucket({ measured: 2 })], { reviewQueue: 50 }).bottleneck).toBe("sample");
  });

  it("flags an operations backlog when the review queue is large", () => {
    expect(diagnoseBottleneck([healthy, healthy], { reviewQueue: 10 }).bottleneck).toBe("ops");
  });

  it("flags reach when nothing breaks out and median views are low", () => {
    const quiet = bucket({ measured: 5, medianViews: 120, breakoutRate: 0, funnel: { views: 600, clicks: 0, conversions: 0, paid: 0 } });
    expect(diagnoseBottleneck([quiet, quiet], { reviewQueue: 0 }).bottleneck).toBe("reach");
  });

  it("flags conversion when views exist but clicks or conversions do not follow", () => {
    const noClicks = bucket({ measured: 5, medianViews: 800, breakoutRate: 10, funnel: { views: 5000, clicks: 3, conversions: 0, paid: 0 }, clicksPer1kViews: 0.6 });
    expect(diagnoseBottleneck([noClicks, noClicks], { reviewQueue: 0 }).bottleneck).toBe("conversion");

    const clicksNoConversion = bucket({ measured: 5, medianViews: 800, breakoutRate: 10, funnel: { views: 5000, clicks: 40, conversions: 0, paid: 0 }, clicksPer1kViews: 8 });
    expect(diagnoseBottleneck([clicksNoConversion, clicksNoConversion], { reviewQueue: 0 }).bottleneck).toBe("conversion");
  });

  it("returns none with a keep-going action when everything is healthy", () => {
    const result = diagnoseBottleneck([healthy, healthy], { reviewQueue: 0 });
    expect(result.bottleneck).toBe("none");
    expect(result.nextAction).toContain("유지");
  });
});
