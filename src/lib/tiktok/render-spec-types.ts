// render-spec-types.ts — Self-contained RenderSpec type definition for TikTok/Remotion rendering
import type { SajuCardData } from "./saju-types";

// ig_rank_10s: 제목 1줄 + 순위 텍스트가 순서대로 나타나는 정지 카드
export interface RankCardData {
  title: string;
  items: string[];
}

export interface PickCardOption {
  label: string;
  text: string;
}

// ig_pickcard_16s: 질문 1줄 + 카드 A/B/C, ctaAtSeconds 지점에 선택형 CTA
export interface PickCardData {
  question: string;
  cards: PickCardOption[];
  cta: string;
  ctaAtSeconds: number;
}

export type CardData =
  | SajuCardData
  | RankCardData
  | PickCardData
  | { subText?: string; badge?: string; colorScheme?: string };

export type RenderSpecVisualType =
  | "image"
  | "video"
  | "slide"
  | "capture"
  | "placeholder"
  | "saju-card"
  | "kinetic-card"
  | "rank-card"
  | "pick-card";

export interface RenderSpecScene {
  id: string;
  fromFrame: number;
  durationInFrames: number;
  visual: {
    type: RenderSpecVisualType;
    src: string;
    kenBurns?: boolean;
    cardData?: CardData;
  };
  onScreenText: string[];
  transitionOut?: string;
}

export interface RenderSpec {
  schemaVersion: "1.0";
  compositor: "remotion" | "mpt";
  composition: string;
  fps: number;
  dimensions: {
    width: number;
    height: number;
  };
  durationInFrames: number;
  audio: {
    narration?: string;
    music?: string;
    musicGainDb?: number;
  };
  scenes: RenderSpecScene[];
  captions: {
    file?: string;
    style: "tiktok" | "lower-third" | "none";
    fontFamily: string;
    maxWidthPct: number;
    safeArea: {
      topPct: number;
      bottomPct: number;
      leftPct: number;
      rightPct: number;
    };
  };
  background: {
    type: "color" | "image" | "video";
    src?: string;
  };
  seed: number;
}
