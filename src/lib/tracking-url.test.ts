import { describe, it, expect } from "vitest";
import { buildTrackedUrl, parseTrackingParams } from "./tracking-url";

describe("Tracking URL Attribution", () => {
  it("builds a full tracking URL with pid, fid, and track", () => {
    const url = buildTrackedUrl("https://www.cosmicpath.app/start", {
      postId: "post_123",
      formulaId: "fact_bomb_incumbent_attack",
      track: "track_b",
    });

    expect(url).toContain("https://www.cosmicpath.app/start?");
    expect(url).toContain("ref=threads");
    expect(url).toContain("pid=post_123");
    expect(url).toContain("fid=fact_bomb_incumbent_attack");
    expect(url).toContain("track=track_b");
  });

  it("parses tracking params accurately from a full URL", () => {
    const fullUrl = "https://www.cosmicpath.app/start?ref=threads&pid=post_999&fid=lotto_zero_friction&track=track_a";
    const parsed = parseTrackingParams(fullUrl);

    expect(parsed.postId).toBe("post_999");
    expect(parsed.formulaId).toBe("lotto_zero_friction");
    expect(parsed.track).toBe("track_a");
    expect(parsed.source).toBe("threads");
  });

  it("handles relative urls or search query strings gracefully", () => {
    const parsed = parseTrackingParams("?pid=post_abc&fid=sal_hierarchy_ego");
    expect(parsed.postId).toBe("post_abc");
    expect(parsed.formulaId).toBe("sal_hierarchy_ego");
  });
});
