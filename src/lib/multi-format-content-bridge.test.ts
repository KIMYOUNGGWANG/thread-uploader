import { describe, expect, it } from "vitest";
import { buildMultiFormatContentBundle } from "./multi-format-content-bridge";

describe("Multi-Format Content Bridge", () => {
  it("builds Threads post text, carousel slides, and short-form video plan from a single input", () => {
    const postText = `Stop wasting 80% of your marketing budget on paid ads.

1. Build a 7-day organic viral loop.
2. Convert text posts into Carousel Cards.
3. Repurpose into 9:16 vertical short-form videos.

Save & follow for more growth strategies.`;

    const bundle = buildMultiFormatContentBundle({
      postText,
      topic: "Organic Growth Loop",
      hookType: "Controversy Stunt",
      ctaType: "Save & Follow",
      targetAudience: "SaaS Founders",
    });

    expect(bundle.postText).toBe(postText);
    expect(bundle.carouselSlides).toHaveLength(4);
    expect(bundle.carouselSvgs).toHaveLength(4);
    expect(bundle.carouselSvgs[0]).toContain("Stop wasting 80% of your marketing budget");

    expect(bundle.shortFormVideoPlan.title).toContain("Stop wasting 80%");
    expect(bundle.shortFormVideoPlan.durationSeconds).toBe(15);
    expect(bundle.shortFormVideoPlan.hashtags).toContain("#Growth");
  });
});
