import type { CarouselSlideData } from "@/lib/carousel-cards/templates";
import { buildCarouselSlideHtml, buildCarouselSlideSvg } from "@/lib/carousel-cards/renderer";
import type { TikTokRenderPlan } from "@/lib/tiktok-video-renderer";

export interface MultiFormatContentBundle {
  readonly postText: string;
  readonly topic: string;
  readonly hookType: string;
  readonly ctaType: string;
  readonly carouselSlides: readonly CarouselSlideData[];
  readonly carouselSvgs: readonly string[];
  readonly shortFormVideoPlan: TikTokRenderPlan;
}

export function buildMultiFormatContentBundle(input: {
  readonly postText: string;
  readonly topic?: string | null;
  readonly hookType?: string | null;
  readonly ctaType?: string | null;
  readonly targetAudience?: string | null;
}): MultiFormatContentBundle {
  const topic = input.topic || "Core Insight";
  const hookType = input.hookType || "Pattern Interrupt";
  const ctaType = input.ctaType || "Save & Share";
  const rawLines = input.postText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const title = rawLines[0] || topic;
  const bodyText = rawLines.slice(1, -1).join(" ") || input.postText;
  const ctaLine = rawLines[rawLines.length - 1] || "Save this post for later →";

  // Build 4 carousel slides (Cover, Problem/Insight, Solution, CTA)
  const carouselSlides: CarouselSlideData[] = [
    {
      archetype: "QUESTION_COVER",
      title,
      subtitle: input.targetAudience ? `For ${input.targetAudience}` : undefined,
      footerText: "Swipe to learn →",
    },
    {
      archetype: "BOLD_STAT",
      title: "The Core Problem",
      highlightText: topic,
      subtitle: bodyText.slice(0, 120) + (bodyText.length > 120 ? "..." : ""),
    },
    {
      archetype: "TAKEAWAYS",
      title: "Actionable Key Takeaways",
      items: rawLines.slice(1, 4).length > 0 ? rawLines.slice(1, 4) : ["Focus on core value", "Measure 7-day retention"],
    },
    {
      archetype: "CTA_SLIDE",
      title: "What is your take?",
      subtitle: ctaLine,
      footerText: "Follow for more insights",
    },
  ];

  const carouselSvgs = carouselSlides.map((slide, idx) =>
    buildCarouselSlideSvg(slide, idx, carouselSlides.length)
  );

  const shortFormVideoPlan: TikTokRenderPlan = {
    kicker: hookType,
    title,
    captions: [title, ...rawLines.slice(1, 3)],
    bodyLines: [bodyText.slice(0, 80), bodyText.slice(80, 160)].filter(Boolean),
    cta: ctaLine,
    hashtags: ["#Growth", "#SaaS", "#Viral"],
    durationSeconds: 15,
  };

  return {
    postText: input.postText,
    topic,
    hookType,
    ctaType,
    carouselSlides,
    carouselSvgs,
    shortFormVideoPlan,
  };
}
