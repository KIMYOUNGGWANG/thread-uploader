import type { CarouselSlideData } from "@/lib/carousel-cards/templates";
import { buildCarouselSlideHtml, buildCarouselSlideSvg } from "@/lib/carousel-cards/renderer";

export interface MultiFormatContentBundle {
  readonly postText: string;
  readonly topic: string;
  readonly hookType: string;
  readonly ctaType: string;
  readonly carouselSlides: readonly CarouselSlideData[];
  readonly carouselSvgs: readonly string[];
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
  const isKorean = /[가-힣]/.test(input.postText);
  const defaultCta = isKorean ? "저장해두고 다음 선택 전에 다시 확인 →" : "Save this post for later →";
  const ctaLine = rawLines[rawLines.length - 1] || defaultCta;

  // Build 4 carousel slides (Cover, Problem/Insight, Solution, CTA)
  const carouselSlides: CarouselSlideData[] = [
    {
      archetype: "QUESTION_COVER",
      title,
      subtitle: input.targetAudience
        ? (isKorean ? `대상: ${input.targetAudience}` : `For ${input.targetAudience}`)
        : undefined,
      footerText: isKorean ? "넘겨서 확인 →" : "Swipe to learn →",
    },
    {
      archetype: "BOLD_STAT",
      title: isKorean ? "핵심 딜레마 / 관찰" : "The Core Problem",
      highlightText: topic,
      subtitle: bodyText.slice(0, 120) + (bodyText.length > 120 ? "..." : ""),
    },
    {
      archetype: "TAKEAWAYS",
      title: isKorean ? "행동 판정 체크포인트" : "Actionable Key Takeaways",
      items: rawLines.slice(1, 4).length > 0
        ? rawLines.slice(1, 4)
        : (isKorean ? ["현재 조건 정리", "선택지 좁히기"] : ["Focus on core value", "Measure 7-day retention"]),
    },
    {
      archetype: "CTA_SLIDE",
      title: isKorean ? "당신의 선택은 어느 쪽인가요?" : "What is your take?",
      subtitle: ctaLine,
      footerText: isKorean ? "프로필에서 판정 리포트 확인" : "Follow for more insights",
    },
  ];

  const carouselSvgs = carouselSlides.map((slide, idx) =>
    buildCarouselSlideSvg(slide, idx, carouselSlides.length)
  );

  return {
    postText: input.postText,
    topic,
    hookType,
    ctaType,
    carouselSlides,
    carouselSvgs,
  };
}
