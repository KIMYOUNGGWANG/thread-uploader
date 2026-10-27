import { describe, expect, it } from "vitest";
import { calculateSearchSignalScore } from "@/lib/viral-analysis";
import { calculateReferenceScore, isEligibleSource } from "@/lib/reference-radar";
import { parseBrandConfig } from "@/types/brand";

const DAY_MS = 24 * 60 * 60 * 1000;
const now = new Date("2026-10-27T00:00:00Z");
const src = (handle: string, daysOld: number, timesSeen: number) => ({
  authorUsername: handle,
  publishedAt: new Date(now.getTime() - daysOld * DAY_MS),
  timesSeen,
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
  it("rejects a post seen only once", () => expect(isEligibleSource(src("the.saju", 3, 1), rules)).toBe(false));
  it("rejects posts older than 7 days and posts without a date", () => {
    expect(isEligibleSource(src("the.saju", 8, 2), rules)).toBe(false);
    expect(isEligibleSource({ ...src("the.saju", 3, 2), publishedAt: null }, rules)).toBe(false);
  });
  it("rejects the brand's own posts", () => expect(isEligibleSource(src("@CosmicPath", 3, 2), rules)).toBe(false));
  it("rejects excluded handles case-insensitively", () => expect(isEligibleSource(src("@Forceteller_Official", 3, 2), rules)).toBe(false));
  it("treats a missing own handle as no own-post rule", () => expect(isEligibleSource(src("anyone", 3, 2), { ...rules, ownHandle: null })).toBe(true));
});

describe("normalizeViralDiscovery excludedHandles", () => {
  it("normalizes handles and defaults to an empty list", () => {
    expect(parseBrandConfig(JSON.stringify({ viralDiscovery: { excludedHandles: ["@The.Saju ", "x"] } })).viralDiscovery.excludedHandles).toEqual(["the.saju", "x"]);
    expect(parseBrandConfig("{}").viralDiscovery.excludedHandles).toEqual([]);
  });
});
