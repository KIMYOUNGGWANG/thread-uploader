import { describe, expect, it } from "vitest";
import { buildShortsOrderBy, buildShortsWhere, parseShortsFilters } from "./shorts-feed";

const minViews = { kr: 10000, global: 50000 };
const now = new Date("2026-10-22T12:00:00.000Z");
const base = { brandId: "b1", minViews, now };

describe("shorts-feed", () => {
  it("defaults to 24h, kr and velocity", () => {
    expect(parseShortsFilters({})).toEqual({ window: "24", region: "kr", sort: "velocity" });
  });

  it("accepts sort=outlier and falls back to velocity otherwise", () => {
    expect(parseShortsFilters({ sort: "outlier" }).sort).toBe("outlier");
    expect(parseShortsFilters({ sort: "views" }).sort).toBe("velocity");
    expect(parseShortsFilters({ sort: ["outlier", "x"] }).sort).toBe("outlier");
  });

  it("orders by viralScore then velocity for outlier, unchanged for velocity", () => {
    expect(buildShortsOrderBy("outlier")).toEqual([{ viralScore: "desc" }, { velocityScore: "desc" }]);
    expect(buildShortsOrderBy("velocity")).toEqual([{ velocityScore: "desc" }, { views: "desc" }]);
  });

  it("kr region filters country = KR with the kr floor", () => {
    const where = buildShortsWhere({ ...base, window: "24", region: "kr" });
    expect(where.country).toBe("KR");
    expect(where.views).toEqual({ gte: 10000 });
  });

  it("global region excludes KR (UNKNOWN included) with the global floor", () => {
    const where = buildShortsWhere({ ...base, window: "24", region: "global" });
    expect(where.country).toEqual({ not: "KR" });
    expect(where.views).toEqual({ gte: 50000 });
  });

  it("all region ORs the two floors", () => {
    const where = buildShortsWhere({ ...base, window: "24", region: "all" });
    expect(where.OR).toEqual([
      { country: "KR", views: { gte: 10000 } },
      { country: { not: "KR" }, views: { gte: 50000 } },
    ]);
  });

  it("window 48 widens publishedAt", () => {
    const w24 = buildShortsWhere({ ...base, window: "24", region: "kr" });
    const w48 = buildShortsWhere({ ...base, window: "48", region: "kr" });
    expect(w24.publishedAt).toEqual({ gte: new Date("2026-10-21T12:00:00.000Z") });
    expect(w48.publishedAt).toEqual({ gte: new Date("2026-10-20T12:00:00.000Z") });
  });
});
