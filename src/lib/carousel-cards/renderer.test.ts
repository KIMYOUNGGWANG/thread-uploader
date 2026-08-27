import { describe, expect, it } from "vitest";
import { buildCarouselSlideHtml, buildCarouselSlideSvg } from "./renderer";
import type { CarouselSlideData } from "./templates";
import { CAROUSEL_ARCHETYPES, DEFAULT_CAROUSEL_THEME } from "./templates";

describe("Carousel Cards Templates & Renderer", () => {
  it("defines 10 carousel archetypes", () => {
    expect(CAROUSEL_ARCHETYPES).toHaveLength(10);
    const ids = CAROUSEL_ARCHETYPES.map((a) => a.id);
    expect(ids).toContain("QUESTION_COVER");
    expect(ids).toContain("BOLD_STAT");
    expect(ids).toContain("CTA_SLIDE");
  });

  it("builds clean HTML for a carousel slide", () => {
    const slide: CarouselSlideData = {
      archetype: "BOLD_STAT",
      title: "92% of users quit SaaS within 7 days",
      subtitle: "Here is how to fix user retention with micro-experiments.",
      highlightText: "+45% Retention Boost",
      items: ["Focus on activation", "Send 1-on-1 welcome notes", "Track 7-day metric"],
    };

    const html = buildCarouselSlideHtml(slide, 0, 5, DEFAULT_CAROUSEL_THEME);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("92% of users quit SaaS within 7 days");
    expect(html).toContain("+45% Retention Boost");
    expect(html).toContain("Focus on activation");
    expect(html).toContain("1 / 5");
  });

  it("builds valid SVG markup for a carousel slide", () => {
    const slide: CarouselSlideData = {
      archetype: "QUESTION_COVER",
      title: "Are you making this Threads mistake?",
      subtitle: "Stop posting without a CTA.",
      footerText: "Swipe to see the fix →",
    };

    const svg = buildCarouselSlideSvg(slide, 1, 4, DEFAULT_CAROUSEL_THEME);
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain("Are you making this Threads mistake?");
    expect(svg).toContain("2 / 4");
    expect(svg).toContain("Swipe to see the fix →");
  });
});
