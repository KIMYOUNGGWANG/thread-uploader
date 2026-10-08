import { describe, expect, it } from "vitest";
import { isMetricsCollectionStale, selectMetricsCandidates } from "./metrics-selection";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = Date.parse("2026-09-27T12:00:00.000Z");

function post(id: string, ageMs: number, metricsAt: Date | null = null) {
  return { id, publishedAt: new Date(NOW - ageMs), metricsAt };
}

describe("selectMetricsCandidates", () => {
  const options = { now: NOW, minAgeMs: 6 * HOUR, maxAgeMs: 14 * DAY, limit: 60 };

  it("keeps posts from the 6-hour lower boundary through the 14-day upper boundary", () => {
    const selected = selectMetricsCandidates([
      post("too-new", 6 * HOUR - 1),
      post("six-hours", 6 * HOUR),
      post("fourteen-days", 14 * DAY),
      post("too-old", 14 * DAY + 1),
    ], options);

    expect(selected.map((item) => item.id)).toEqual(["fourteen-days", "six-hours"]);
  });

  it("backfills never-collected posts past 14 days but keeps measured posts capped", () => {
    const selected = selectMetricsCandidates([
      post("measured-old", 20 * DAY, new Date(NOW - 10 * DAY)),
      post("uncollected-old", 30 * DAY),
      post("uncollected-too-old", 60 * DAY + 1),
    ], { ...options, uncollectedMaxAgeMs: 60 * DAY });

    expect(selected.map((item) => item.id)).toEqual(["uncollected-old"]);
  });

  it("prioritizes posts with no metrics before the oldest measured posts", () => {
    const selected = selectMetricsCandidates([
      post("recently-measured", DAY, new Date(NOW - HOUR)),
      post("missing-newer", 2 * DAY),
      post("oldest-measured", 3 * DAY, new Date(NOW - 2 * DAY)),
      post("missing-older", 4 * DAY),
    ], options);

    expect(selected.map((item) => item.id)).toEqual([
      "missing-older",
      "missing-newer",
      "oldest-measured",
      "recently-measured",
    ]);
  });

  it("prioritizes mature posts lacking 72-hour mature metrics over already mature posts", () => {
    const alreadyMature = post("already-mature", 8 * DAY, new Date(NOW - DAY));
    const needsMature = post("needs-mature", 4 * DAY, new Date(NOW - 3.5 * DAY));

    const selected = selectMetricsCandidates([alreadyMature, needsMature], options);
    expect(selected.map((item) => item.id)).toEqual(["needs-mature", "already-mature"]);
  });

  it("caps each run at 60 posts", () => {
    const selected = selectMetricsCandidates(
      Array.from({ length: 75 }, (_, index) => post(`post-${index}`, DAY + index)),
      options
    );

    expect(selected).toHaveLength(60);
  });
});

describe("isMetricsCollectionStale", () => {
  it("flags missing or 48h+ old collection only", () => {
    expect(isMetricsCollectionStale(null, NOW)).toBe(true);
    expect(isMetricsCollectionStale(new Date(NOW - 49 * HOUR), NOW)).toBe(true);
    expect(isMetricsCollectionStale(new Date(NOW - 25 * HOUR), NOW)).toBe(false);
  });
});
