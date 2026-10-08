// render-spec-types.ts — Self-contained RenderSpec type definition for TikTok/Remotion rendering
import type { SajuCardData } from "./saju-types";

export type CardData = SajuCardData | { subText?: string; badge?: string; colorScheme?: string };
export interface RenderSpecScene {
  id: string;
  fromFrame: number;
  durationInFrames: number;
  visual: {
    type: "image" | "video" | "slide" | "capture" | "placeholder" | "saju-card" | "kinetic-card";
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
