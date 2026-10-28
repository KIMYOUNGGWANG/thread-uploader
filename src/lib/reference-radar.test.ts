import { describe, expect, it } from "vitest";
import { calculateSearchSignalScore } from "@/lib/viral-analysis";
import { calculateReferenceScore, calculateRisingScore, isEligibleSource, MIN_SEEN_AGE_MS } from "@/lib/reference-radar";
import { parseBrandConfig } from "@/types/brand";

const DAY_MS = 24 * 60 * 60 * 1000;
const now = new Date("2026-10-27T00:00:00Z");
const HOUR_MS = 60 * 60 * 1000;
const src = (handle: string, daysOld: number, timesSeen: number) => ({
  authorUsername: handle,
  publishedAt: new Date(now.getTime() - daysOld * DAY_MS),
  timesSeen,
  firstSeenAt: new Date(now.getTime() - DAY_MS).toISOString(),
});

describe("calculateReferenceScore", () => {
  it("adds search signal, replies bonus and structure", () => {
    const base = calculateReferenceScore({ signal: {}, content: "평범한 글", hasReplies: null });
    expect(calculateReferenceScore({ signal: { searchRank: 1, keywordHits: 2, timesSeen: 3 }, content: "평범한 글", hasReplies: true }))
      .toBe(base + calculateSearchSignalScore({ searchRank: 1, keywordHits: 2, timesSeen: 3 }) + 10);
  });
});

describe("isEligibleSource", () => {
  const rules = { ownHandle: "cosmicpath", excludedHandles: ["forceteller_official"], now };
  it("accepts a 3-day-old post seen twice from another account", () => expect(isEligibleSource(src("the.saju", 3, 2), rules)).toBe(true));
  it("rejects a post seen twice within minutes: two manual discover runs are not 12 hours of staying in TOP", () => {
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
    expect(isEligibleSource({ ...src("the.saju", 3, 2), firstSeenAt: tenMinutesAgo }, rules)).toBe(false);
  });
  it("accepts a post first seen 12 hours ago and rejects one without a firstSeenAt", () => {
    expect(isEligibleSource({ ...src("the.saju", 3, 2), firstSeenAt: new Date(now.getTime() - 12 * HOUR_MS).toISOString() }, rules)).toBe(true);
    expect(isEligibleSource({ ...src("the.saju", 3, 2), firstSeenAt: null }, rules)).toBe(false);
  });
  it("rejects a post seen only once", () => expect(isEligibleSource(src("the.saju", 3, 1), rules)).toBe(false));
  it("rejects posts older than 7 days and posts without a date", () => {
    expect(isEligibleSource(src("the.saju", 8, 2), rules)).toBe(false);
    expect(isEligibleSource({ ...src("the.saju", 3, 2), publishedAt: null }, rules)).toBe(false);
  });
  it("rejects the brand's own posts", () => expect(isEligibleSource(src("@CosmicPath", 3, 2), rules)).toBe(false));
  it("rejects excluded handles case-insensitively", () => expect(isEligibleSource(src("@Forceteller_Official", 3, 2), rules)).toBe(false));
  it("treats a missing own handle as no own-post rule", () => expect(isEligibleSource(src("anyone", 3, 2), { ...rules, ownHandle: null })).toBe(true));
});

describe("calculateRisingScore", () => {
  const h = (rank: number, hour: number) => ({ at: new Date(Date.UTC(2026, 9, 28, hour)).toISOString(), rank, hits: 1 });
  const fresh = new Date(now.getTime() - 6 * HOUR_MS);

  it("adds rank gain from the previous best to the latest and a freshness bonus", () => {
    // best before latest = 5, latest = 2 → gain 3 × 3 = 9; published 6h ago → +15
    expect(calculateRisingScore({ referenceScore: 40, rankHistory: [h(9, 0), h(5, 4), h(2, 8)], publishedAt: fresh, now })).toBe(40 + 9 + 15);
  });

  it("gives no gain for a single entry or a rank that got worse", () => {
    expect(calculateRisingScore({ referenceScore: 40, rankHistory: [h(2, 0)], publishedAt: null, now })).toBe(40);
    expect(calculateRisingScore({ referenceScore: 40, rankHistory: [h(2, 0), h(6, 4)], publishedAt: null, now })).toBe(40);
  });

  it("gives 5 for a 48h-old post and 0 beyond", () => {
    expect(calculateRisingScore({ referenceScore: 0, rankHistory: [], publishedAt: new Date(now.getTime() - 30 * HOUR_MS), now })).toBe(5);
    expect(calculateRisingScore({ referenceScore: 0, rankHistory: [], publishedAt: new Date(now.getTime() - 49 * HOUR_MS), now })).toBe(0);
  });

  it("lets a post rising over 8 hours beat one that merely sat in TOP for 4.5 days", () => {
    // 4.5 days × 6 runs = 27 sightings at rank 4, flat; vs seen 3 times rising 8 → 5 → 2, published 10h ago
    const stale = calculateRisingScore({
      referenceScore: calculateSearchSignalScore({ searchRank: 4, keywordHits: 1, timesSeen: 27 }),
      rankHistory: [h(4, 0), h(4, 4), h(4, 8)],
      publishedAt: new Date(now.getTime() - 4.5 * 24 * HOUR_MS),
      now,
    });
    const rising = calculateRisingScore({
      referenceScore: calculateSearchSignalScore({ searchRank: 2, keywordHits: 1, timesSeen: 3 }),
      rankHistory: [h(8, 0), h(5, 4), h(2, 8)],
      publishedAt: new Date(now.getTime() - 10 * HOUR_MS),
      now,
    });
    expect(rising).toBeGreaterThan(stale);
  });
});

describe("isEligibleSource with the 4-hour harvest cadence", () => {
  const rules = { ownHandle: "cosmicpath", excludedHandles: ["forceteller_official"], now };
  it("accepts a post first seen 4 hours ago", () => {
    expect(isEligibleSource({ ...src("the.saju", 3, 2), firstSeenAt: new Date(now.getTime() - 4 * HOUR_MS).toISOString() }, rules)).toBe(true);
  });
  it("still rejects a post first seen 2 hours ago", () => {
    expect(isEligibleSource({ ...src("the.saju", 3, 2), firstSeenAt: new Date(now.getTime() - 2 * HOUR_MS).toISOString() }, rules)).toBe(false);
    expect(MIN_SEEN_AGE_MS).toBe(3 * HOUR_MS);
  });
});

describe("normalizeViralDiscovery excludedHandles", () => {
  it("normalizes handles and defaults to an empty list", () => {
    expect(parseBrandConfig(JSON.stringify({ viralDiscovery: { excludedHandles: ["@The.Saju ", "x"] } })).viralDiscovery.excludedHandles).toEqual(["the.saju", "x"]);
    expect(parseBrandConfig("{}").viralDiscovery.excludedHandles).toEqual([]);
  });
});
