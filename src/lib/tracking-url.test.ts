import { describe, it, expect } from "vitest";
import { buildTrackedUrl, parseTrackingParams, tagBrandLinks } from "./tracking-url";

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

const BRAND_URLS = ["https://www.cosmicpath.app/start?entry=decision", "https://www.cosmicpath.app/start"];

describe("tagBrandLinks", () => {
  it("adds pid to brand links while keeping existing params and trailing punctuation", () => {
    const text = "지금 확인 https://www.cosmicpath.app/start?entry=career_lyra.\n또는 https://cosmicpath.app?utm_source=threads";
    expect(tagBrandLinks(text, "post123", BRAND_URLS)).toBe(
      "지금 확인 https://www.cosmicpath.app/start?entry=career_lyra&pid=post123.\n또는 https://cosmicpath.app/?utm_source=threads&pid=post123"
    );
  });

  it("stops the link at adjacent Korean text", () => {
    expect(tagBrandLinks("https://www.cosmicpath.app/start에서 확인", "p1", BRAND_URLS))
      .toBe("https://www.cosmicpath.app/start?pid=p1에서 확인");
  });

  it("leaves other hosts, tagged links, and brands without urls untouched", () => {
    const text = "https://example.com/a https://www.cosmicpath.app/start?pid=old";
    expect(tagBrandLinks(text, "p1", BRAND_URLS)).toBe(text);
    expect(tagBrandLinks("https://www.cosmicpath.app/start", "p1", [""])).toBe("https://www.cosmicpath.app/start");
  });
});
