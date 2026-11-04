import { describe, expect, it } from "vitest";
import { COSMICPATH_RADAR_KEYWORDS, planRadarSeed } from "@/lib/reference-radar-seed";
import { parseBrandConfig } from "@/types/brand";

const discovery = (viralDiscovery: object = {}) => parseBrandConfig(JSON.stringify({ viralDiscovery })).viralDiscovery;

describe("planRadarSeed", () => {
  it("fills empty keywords and handle", () => {
    expect(planRadarSeed(discovery(), "cosmicpath.app")).toEqual({ keywords: [...COSMICPATH_RADAR_KEYWORDS], ownHandle: "cosmicpath.app" });
  });

  it("never overwrites an operator's keywords or handle", () => {
    expect(planRadarSeed(discovery({ keywords: ["타로"], ownHandle: "me" }), "cosmicpath.app")).toEqual({});
  });

  it("leaves the handle out when the lookup failed", () => {
    expect(planRadarSeed(discovery(), undefined)).toEqual({ keywords: [...COSMICPATH_RADAR_KEYWORDS] });
  });
});
