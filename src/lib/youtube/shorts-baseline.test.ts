import { describe, it, expect } from "vitest";
import {
  computeChannelBaseline,
  computeOutlier,
  readStoredBaseline,
  planBaselineWork,
  BASELINE_KEYS,
  type StoredBaseline,
} from "./shorts-baseline";

const NOW = new Date("2026-10-24T00:00:00Z");
const DAY = 86_400_000;
const v = (id: string, daysAgo: number, views: number, durationSec = 30) => ({
  id,
  publishedAt: new Date(NOW.getTime() - daysAgo * DAY),
  durationSec,
  views,
});

describe("computeChannelBaseline", () => {
  it("takes the median of an odd sample", () => {
    const videos = [4, 5, 6, 7, 8].map((d, i) => v(`a${i}`, d, [100, 300, 200, 500, 400][i]));
    expect(computeChannelBaseline(videos, { now: NOW, maxDurationSec: 180 })).toEqual({ medianViews: 300, sampleSize: 5 });
  });
  it("averages the two middle values of an even sample", () => {
    const videos = [4, 5, 6, 7, 8, 9].map((d, i) => v(`a${i}`, d, (i + 1) * 100));
    expect(computeChannelBaseline(videos, { now: NOW, maxDurationSec: 180 }).medianViews).toBe(350);
  });
  it("drops videos younger than 3 days and longer than maxDurationSec", () => {
    const videos = [v("young", 2, 9_999_999), v("long", 5, 9_999_999, 600), ...[4, 5, 6, 7, 8].map((d) => v(`k${d}`, d, 100))];
    expect(computeChannelBaseline(videos, { now: NOW, maxDurationSec: 180 })).toEqual({ medianViews: 100, sampleSize: 5 });
  });
  it("uses only the 12 most recent eligible videos", () => {
    const recent = Array.from({ length: 12 }, (_, i) => v(`r${i}`, 4 + i, 100));
    const old = Array.from({ length: 5 }, (_, i) => v(`o${i}`, 30 + i, 1_000_000));
    expect(computeChannelBaseline([...old, ...recent], { now: NOW, maxDurationSec: 180 })).toEqual({ medianViews: 100, sampleSize: 12 });
  });
  it("returns null with fewer than 5 eligible videos", () => {
    const videos = [4, 5, 6, 7].map((d) => v(`a${d}`, d, 100));
    expect(computeChannelBaseline(videos, { now: NOW, maxDurationSec: 180 })).toEqual({ medianViews: null, sampleSize: 4 });
  });
  it("returns null when the median is 0", () => {
    const videos = [4, 5, 6, 7, 8].map((d) => v(`a${d}`, d, 0));
    expect(computeChannelBaseline(videos, { now: NOW, maxDurationSec: 180 }).medianViews).toBeNull();
  });
});

describe("computeOutlier", () => {
  it("rounds the ratio to 2 decimals and scores ×100", () => {
    expect(computeOutlier(32_000, 10_000)).toEqual({ outlierRatio: 3.2, viralScore: 320 });
    expect(computeOutlier(10_000, 3_000)).toEqual({ outlierRatio: 3.33, viralScore: 333 });
  });
  it("returns null ratio and score 0 without a baseline", () => {
    expect(computeOutlier(32_000, null)).toEqual({ outlierRatio: null, viralScore: 0 });
  });
});

describe("readStoredBaseline", () => {
  it("reads a valid baseline and rejects unknown status or wrong types", () => {
    const ok = { baselineStatus: "measured", channelMedianViews: 100, baselineSampleSize: 12, baselineComputedAt: "2026-10-23T00:00:00.000Z" };
    expect(readStoredBaseline(ok)).toEqual(ok);
    expect(readStoredBaseline({ ...ok, baselineStatus: "weird" })).toBeNull();
    expect(readStoredBaseline({ ...ok, baselineSampleSize: "12" })).toBeNull();
    expect(readStoredBaseline({})).toBeNull();
  });
  it("exposes the four stored keys", () => {
    expect([...BASELINE_KEYS].sort()).toEqual(["baselineComputedAt", "baselineSampleSize", "baselineStatus", "channelMedianViews"]);
  });
});

describe("planBaselineWork", () => {
  const measured = (daysAgo: number): StoredBaseline => ({ baselineStatus: "measured", channelMedianViews: 100, baselineSampleSize: 12, baselineComputedAt: new Date(NOW.getTime() - daysAgo * DAY).toISOString() });
  const skipped: StoredBaseline = { baselineStatus: "skipped", channelMedianViews: null, baselineSampleSize: 0, baselineComputedAt: null };
  it("reuses a fresh measured or insufficient baseline from any row of the channel", () => {
    const plan = planBaselineWork([{ channelId: "c1", baselines: [null, measured(1)] }], NOW);
    expect(plan.reuse.get("c1")).toEqual(measured(1));
    expect(plan.measure).toEqual([]);
  });
  it("re-measures baselines older than 7 days, skipped, or missing", () => {
    const plan = planBaselineWork([
      { channelId: "old", baselines: [measured(8)] },
      { channelId: "skip", baselines: [skipped] },
      { channelId: "none", baselines: [null] },
    ], NOW);
    expect(plan.measure).toEqual(["old", "skip", "none"]);
  });
  it("caps measurement at 40 channels and skips the rest", () => {
    const channels = Array.from({ length: 41 }, (_, i) => ({ channelId: `c${i}`, baselines: [null] }));
    const plan = planBaselineWork(channels, NOW);
    expect(plan.measure).toHaveLength(40);
    expect(plan.skip).toEqual(["c40"]);
  });
});
