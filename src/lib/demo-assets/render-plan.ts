import type { CreativePlan, SceneBeat, SceneLayer } from "./creative-planner";

// ---------------------------------------------------------------------------
// Render plan builder — converts a CreativePlan into Remotion-compatible props
// ---------------------------------------------------------------------------

/** Props that map directly to a Remotion <Composition> */
export interface RemotionRenderProps {
  compositionId: string;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  inputProps: RemotionInputProps;
}

export interface RemotionInputProps {
  jobId: string;
  style: string;
  colorTheme: {
    primary: string;
    secondary: string;
    background: string;
    textPrimary: string;
    textSecondary: string;
  };
  typography: {
    headlineFont: string;
    bodyFont: string;
  };
  productInfo: {
    title: string;
    description: string;
    ctaText: string;
  };
  sequences: RemotionSequence[];
}

export interface RemotionSequence {
  id: string;
  /** Start frame offset from composition start */
  from: number;
  durationInFrames: number;
  transition: {
    type: string;
    durationInFrames: number;
  };
  elements: RemotionElement[];
}

export interface RemotionElement {
  id: string;
  type: "background" | "device-mockup" | "headline" | "subtext" | "cta-button" | "overlay";
  /** Source: image path, text content, gradient spec, etc. */
  content: string;
  style: RemotionElementStyle;
  animation: {
    type: string;
    delay: number;
    duration: number;
    easing: string;
  };
}

export interface RemotionElementStyle {
  position: "absolute";
  left: number;
  top: number;
  width: number;
  height: number;
  zIndex: number;
  /** Additional CSS properties */
  extra?: Record<string, string | number>;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Converts a validated CreativePlan into Remotion-compatible render props.
 * One render props object is generated per output asset.
 */
export function buildRenderPlan(plan: CreativePlan): RemotionRenderProps {
  const sequences = buildSequences(plan);

  return {
    compositionId: `demo-${plan.style}-${plan.jobId}`,
    width: plan.width,
    height: plan.height,
    fps: plan.fps,
    durationInFrames: plan.totalDurationFrames,
    inputProps: {
      jobId: plan.jobId,
      style: plan.style,
      colorTheme: plan.colorTheme,
      typography: plan.typography,
      productInfo: plan.productInfo,
      sequences,
    },
  };
}

/**
 * Builds still-image render props from a creative plan.
 * Uses the first scene as a single-frame snapshot.
 */
export function buildImageRenderPlan(
  plan: CreativePlan,
  sceneIndex = 0,
): RemotionRenderProps {
  const targetScene = plan.scenes[Math.min(sceneIndex, plan.scenes.length - 1)];
  const elements = mapLayersToElements(targetScene, plan);

  return {
    compositionId: `demo-still-${plan.style}-${plan.jobId}`,
    width: plan.width,
    height: plan.height,
    fps: plan.fps,
    durationInFrames: 1, // Single frame for still images
    inputProps: {
      jobId: plan.jobId,
      style: plan.style,
      colorTheme: plan.colorTheme,
      typography: plan.typography,
      productInfo: plan.productInfo,
      sequences: [
        {
          id: `still_${sceneIndex}`,
          from: 0,
          durationInFrames: 1,
          transition: { type: "cut", durationInFrames: 0 },
          elements,
        },
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildSequences(plan: CreativePlan): RemotionSequence[] {
  let currentFrame = 0;
  const transitionOverlap = Math.round(0.3 * plan.fps); // 0.3s transition overlap

  return plan.scenes.map((scene, index) => {
    const from = Math.max(0, currentFrame);
    const elements = mapLayersToElements(scene, plan);

    const sequence: RemotionSequence = {
      id: scene.sceneId,
      from,
      durationInFrames: scene.durationFrames,
      transition: {
        type: scene.transition,
        durationInFrames: index < plan.scenes.length - 1 ? transitionOverlap : 0,
      },
      elements,
    };

    // Advance frame pointer, accounting for transition overlap
    currentFrame += scene.durationFrames - (index < plan.scenes.length - 1 ? transitionOverlap : 0);

    return sequence;
  });
}

function mapLayersToElements(scene: SceneBeat, plan: CreativePlan): RemotionElement[] {
  return scene.layers.map((layer, index) => ({
    id: `${scene.sceneId}_element_${index}`,
    type: mapLayerTypeToElementType(layer),
    content: layer.source,
    style: {
      position: "absolute" as const,
      left: layer.layout.x,
      top: layer.layout.y,
      width: layer.layout.width,
      height: layer.layout.height,
      zIndex: layer.layout.zIndex,
      extra: getExtraStyles(layer, plan),
    },
    animation: {
      type: layer.animation.type,
      delay: layer.animation.delayFrames,
      duration: layer.animation.durationFrames,
      easing: getEasing(layer.animation.type),
    },
  }));
}

function mapLayerTypeToElementType(
  layer: SceneLayer,
): RemotionElement["type"] {
  switch (layer.type) {
    case "background":
      return "background";
    case "device":
      return "device-mockup";
    case "text":
      // Determine if headline or subtext based on zIndex
      return layer.layout.zIndex >= 8 ? "headline" : "subtext";
    case "cta":
      return "cta-button";
    case "overlay":
      return "overlay";
    default:
      return "overlay";
  }
}

function getExtraStyles(
  layer: SceneLayer,
  plan: CreativePlan,
): Record<string, string | number> {
  const extras: Record<string, string | number> = {};

  switch (layer.type) {
    case "background": {
      const source = layer.source;
      if (source.startsWith("gradient:")) {
        const colors = source.replace("gradient:", "").split(",");
        extras.background = `linear-gradient(180deg, ${colors[0]} 0%, ${colors[1] || colors[0]} 100%)`;
      } else if (source.startsWith("split:")) {
        const colors = source.replace("split:", "").split(",");
        extras.background = `linear-gradient(180deg, ${colors[0]} 0%, ${colors[0]} 50%, ${colors[1] || colors[0]} 50%, ${colors[1] || colors[0]} 100%)`;
      } else if (source.startsWith("solid:")) {
        extras.backgroundColor = source.replace("solid:", "");
      } else {
        extras.backgroundColor = plan.colorTheme.background;
      }
      break;
    }
    case "device": {
      extras.borderRadius = 32;
      extras.overflow = "hidden";
      extras.boxShadow = "0 30px 80px rgba(0,0,0,0.5)";
      break;
    }
    case "text": {
      extras.color = plan.colorTheme.textPrimary;
      extras.fontFamily = layer.layout.zIndex >= 8
        ? plan.typography.headlineFont
        : plan.typography.bodyFont;
      extras.fontSize = layer.layout.zIndex >= 8 ? 48 : 24;
      extras.fontWeight = layer.layout.zIndex >= 8 ? 700 : 400;
      extras.textAlign = "center";
      break;
    }
    case "cta": {
      extras.backgroundColor = plan.colorTheme.primary;
      extras.color = "#FFFFFF";
      extras.borderRadius = 16;
      extras.fontSize = 20;
      extras.fontWeight = 600;
      extras.textAlign = "center";
      extras.display = "flex";
      extras.alignItems = "center";
      extras.justifyContent = "center";
      break;
    }
  }

  return extras;
}

function getEasing(animationType: string): string {
  switch (animationType) {
    case "spring-pop":
    case "scale-bounce":
      return "spring";
    case "whip-pan":
    case "glitch":
      return "ease-out";
    case "float":
      return "ease-in-out";
    default:
      return "ease-out";
  }
}
