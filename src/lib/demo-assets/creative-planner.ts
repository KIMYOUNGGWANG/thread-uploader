import Anthropic from "@anthropic-ai/sdk";
import type { CaptureResult } from "./capture-runner";
import type { DemoAssetStyle } from "../../types/demo-asset";
import { DEFAULT_RENDER_TARGET } from "../../types/demo-asset";

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

/** A single scene (beat) in a video or image creative */
export interface SceneBeat {
  /** Unique scene identifier */
  sceneId: string;
  /** Duration in frames (at 30fps) */
  durationFrames: number;
  /** Layer definitions */
  layers: SceneLayer[];
  /** Transition effect to next scene */
  transition: TransitionEffect;
}

export interface SceneLayer {
  type: "background" | "device" | "text" | "overlay" | "cta";
  /** Source: capture artifact path, inline text, or gradient spec */
  source: string;
  /** Entry animation */
  animation: AnimationSpec;
  /** Position & sizing within 1080x1920 */
  layout: LayoutSpec;
}

export interface AnimationSpec {
  type: "none" | "fade-in" | "slide-up" | "slide-left" | "scale-bounce" | "spring-pop" | "whip-pan" | "glitch" | "float" | "chat-bubble";
  /** Delay in frames before animation starts */
  delayFrames: number;
  /** Duration of the animation in frames */
  durationFrames: number;
}

export interface LayoutSpec {
  x: number;
  y: number;
  width: number;
  height: number;
  /** CSS-like z-index */
  zIndex: number;
}

export type TransitionEffect =
  | "cut"
  | "dissolve"
  | "slide-left"
  | "slide-right"
  | "3d-flip"
  | "whip-pan"
  | "glitch"
  | "zoom-focus";

/** Full creative plan for one asset */
export interface CreativePlan {
  jobId: string;
  style: DemoAssetStyle;
  width: number;
  height: number;
  fps: number;
  totalDurationFrames: number;
  scenes: SceneBeat[];
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
}

// ---------------------------------------------------------------------------
// Anthropic client (lazy, optional)
// ---------------------------------------------------------------------------

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function generateCreativePlan(
  jobId: string,
  style: DemoAssetStyle,
  captureResult: CaptureResult,
  productContext?: string,
): Promise<CreativePlan> {
  const baseInfo = extractProductInfo(captureResult);

  // Try AI planner first
  if (anthropic) {
    try {
      return await generateWithAI(jobId, style, captureResult, baseInfo, productContext);
    } catch (error) {
      console.warn(`[creative-planner] AI planner failed, falling back to deterministic: ${error}`);
    }
  }

  // Deterministic fallback
  return buildFallbackPlan(jobId, style, captureResult, baseInfo);
}

// ---------------------------------------------------------------------------
// Product info extraction from capture evidence
// ---------------------------------------------------------------------------

interface ExtractedProductInfo {
  title: string;
  description: string;
  ctaText: string;
  keyFeatures: string[];
  brandColors: { primary: string; secondary: string };
}

function extractProductInfo(capture: CaptureResult): ExtractedProductInfo {
  const title = capture.title || "Premium App";
  const description = capture.description || "";

  // Pick best CTA
  const ctaText = capture.ctas.length > 0
    ? capture.ctas[0].text
    : "Try Now";

  // Extract key features from text blocks (top 4 most meaningful)
  const keyFeatures = capture.textBlocks
    .filter((block) => block.length >= 15 && block.length <= 200)
    .slice(0, 4);

  // Default brand colors (Slate Dark + Indigo)
  const brandColors = { primary: "#6366F1", secondary: "#0F172A" };

  return { title, description, ctaText, keyFeatures, brandColors };
}

// ---------------------------------------------------------------------------
// AI-based planner (Anthropic Claude)
// ---------------------------------------------------------------------------

async function generateWithAI(
  jobId: string,
  style: DemoAssetStyle,
  capture: CaptureResult,
  info: ExtractedProductInfo,
  productContext?: string,
): Promise<CreativePlan> {
  const prompt = buildAIPrompt(style, capture, info, productContext);

  const message = await anthropic!.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    temperature: 0.7,
    system: `You are a creative director for mobile app promotional videos. You generate structured JSON scene-beat plans for Remotion-based 9:16 vertical video rendering. Follow the safe zone rules: top margin 150px, bottom margin 350px, right margin 160px. Max text per line: 22 Korean chars or 30 English chars. Max 2 lines per subtitle.`,
    messages: [{ role: "user", content: prompt }],
  });

  const rawText = (message.content[0] as { text: string }).text.trim();
  const parsed = parseAIResponse(rawText);

  return assembleCreativePlan(jobId, style, capture, info, parsed);
}

function buildAIPrompt(
  style: DemoAssetStyle,
  capture: CaptureResult,
  info: ExtractedProductInfo,
  productContext?: string,
): string {
  const styleDescriptions: Record<DemoAssetStyle, string> = {
    "clean-product-demo": "Minimalist Premium Dark style with glassmorphism, floating device, 3D perspective, ambient glow background. Serif headlines. Transitions: 3D flip, Z-axis push.",
    "problem-solution-demo": "Interactive Split-Screen / Storytelling style. Top half: problem statement with illustration text. Bottom half: device mockup showing solution. Chat bubble animations. Dissolve transitions.",
    "feature-walkthrough": "Bento Grid & Features style (Apple keynote). 3-4 compartment grid with screenshots and animated stats. Bold sans-serif. Camera pan & zoom transitions.",
    "social-proof-teaser": "Kinetic Typography & Fast Cuts for social viral. Full-screen zoomed captures, huge bold dynamic captions, neon highlights. Whip-pan and glitch transitions.",
    "both": "Do not use directly. Used as orchestrator config only.",
  };

  return [
    `## Video Style: ${style}`,
    styleDescriptions[style],
    "",
    `## Product Info`,
    `- Title: ${info.title}`,
    `- Description: ${info.description}`,
    `- CTA: ${info.ctaText}`,
    `- Key Features: ${info.keyFeatures.join(" | ")}`,
    productContext ? `- Additional Context: ${productContext}` : "",
    "",
    `## Available Screenshots`,
    `- Initial viewport: screenshot_initial.png`,
    `- Full page: screenshot_full.png`,
    `- Section screenshots: ${capture.sectionScreenshots.length} available`,
    "",
    `## Instructions`,
    `Generate a JSON object with these fields:`,
    `- "scenes": Array of 4-6 scene objects, each with:`,
    `  - "headline": Main text to show (max 22 Korean chars)`,
    `  - "subtext": Optional secondary text`,
    `  - "screenshotKey": Which screenshot to show ("initial", "full", "section_0", "section_1", etc.)`,
    `  - "animationStyle": One of "fade-in", "slide-up", "scale-bounce", "spring-pop", "whip-pan", "glitch", "chat-bubble"`,
    `  - "transition": One of "cut", "dissolve", "slide-left", "3d-flip", "whip-pan", "glitch", "zoom-focus"`,
    `  - "durationSeconds": Duration (1.5 to 4 seconds)`,
    `  - "layerType": "intro" | "feature" | "demo" | "cta"`,
    `- "suggestedColors": { "primary": hex, "secondary": hex, "background": hex }`,
    `- "suggestedFonts": { "headline": font name, "body": font name }`,
    "",
    `Respond with ONLY the JSON object. No explanation.`,
  ].join("\n");
}

interface AISceneResponse {
  scenes: Array<{
    headline: string;
    subtext?: string;
    screenshotKey: string;
    animationStyle: string;
    transition: string;
    durationSeconds: number;
    layerType: string;
  }>;
  suggestedColors?: {
    primary?: string;
    secondary?: string;
    background?: string;
  };
  suggestedFonts?: {
    headline?: string;
    body?: string;
  };
}

function parseAIResponse(raw: string): AISceneResponse {
  // Extract JSON from potentially markdown-wrapped response
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("AI_RESPONSE_NO_JSON");
  }

  const parsed = JSON.parse(jsonMatch[0]) as AISceneResponse;

  if (!Array.isArray(parsed.scenes) || parsed.scenes.length === 0) {
    throw new Error("AI_RESPONSE_EMPTY_SCENES");
  }

  return parsed;
}

function assembleCreativePlan(
  jobId: string,
  style: DemoAssetStyle,
  capture: CaptureResult,
  info: ExtractedProductInfo,
  aiResponse: AISceneResponse,
): CreativePlan {
  const { fps } = DEFAULT_RENDER_TARGET;

  const scenes: SceneBeat[] = aiResponse.scenes.map((scene, index) => {
    const durationFrames = Math.round((scene.durationSeconds || 2.5) * fps);
    const screenshotPath = resolveScreenshotPath(scene.screenshotKey, capture);

    return {
      sceneId: `scene_${index}`,
      durationFrames,
      layers: buildLayersForScene(style, scene, screenshotPath, info, index),
      transition: validateTransition(scene.transition),
    };
  });

  const totalDurationFrames = scenes.reduce((sum, scene) => sum + scene.durationFrames, 0);

  const colors = aiResponse.suggestedColors;
  const fonts = aiResponse.suggestedFonts;

  return {
    jobId,
    style,
    width: DEFAULT_RENDER_TARGET.width,
    height: DEFAULT_RENDER_TARGET.height,
    fps,
    totalDurationFrames,
    scenes,
    colorTheme: {
      primary: colors?.primary || info.brandColors.primary,
      secondary: colors?.secondary || info.brandColors.secondary,
      background: colors?.background || "#0F172A",
      textPrimary: "#FFFFFF",
      textSecondary: "#94A3B8",
    },
    typography: {
      headlineFont: fonts?.headline || getDefaultFont(style, "headline"),
      bodyFont: fonts?.body || getDefaultFont(style, "body"),
    },
    productInfo: {
      title: info.title,
      description: info.description,
      ctaText: info.ctaText,
    },
  };
}

// ---------------------------------------------------------------------------
// Deterministic fallback planner
// ---------------------------------------------------------------------------

export function buildFallbackPlan(
  jobId: string,
  style: DemoAssetStyle,
  capture: CaptureResult,
  info: ExtractedProductInfo,
): CreativePlan {
  const { fps } = DEFAULT_RENDER_TARGET;
  const styleTemplates = getFallbackTemplate(style);

  const scenes: SceneBeat[] = styleTemplates.map((template, index) => {
    const screenshotPath = resolveScreenshotPath(template.screenshotKey, capture);
    const headline = template.useProductTitle
      ? getSafeText(info.title, true)
      : template.useFeature && info.keyFeatures[index - 1]
        ? getSafeText(info.keyFeatures[index - 1], true)
        : template.fallbackText;

    const subtext = template.useDescription
      ? getSafeText(info.description, false)
      : template.subtextTemplate
        ? getSafeText(template.subtextTemplate.replace("{cta}", info.ctaText), false)
        : "";

    const layers: SceneLayer[] = [
      // Background layer
      {
        type: "background",
        source: getBackgroundSpec(style),
        animation: { type: "none", delayFrames: 0, durationFrames: 0 },
        layout: { x: 0, y: 0, width: 1080, height: 1920, zIndex: 0 },
      },
    ];

    // Device / screenshot layer
    if (screenshotPath) {
      layers.push({
        type: "device",
        source: screenshotPath,
        animation: {
          type: template.deviceAnimation,
          delayFrames: template.deviceDelay,
          durationFrames: Math.round(0.8 * fps),
        },
        layout: getDeviceLayout(style, template.screenshotKey),
      });
    }

    // Text headline layer
    if (headline) {
      layers.push({
        type: "text",
        source: headline,
        animation: {
          type: template.textAnimation,
          delayFrames: template.textDelay,
          durationFrames: Math.round(0.6 * fps),
        },
        layout: getTextLayout(style, "headline"),
      });
    }

    // Subtext layer
    if (subtext) {
      layers.push({
        type: "text",
        source: subtext,
        animation: {
          type: "fade-in",
          delayFrames: template.textDelay + Math.round(0.3 * fps),
          durationFrames: Math.round(0.5 * fps),
        },
        layout: getTextLayout(style, "subtext"),
      });
    }

    // CTA layer (last scene only)
    if (template.showCta) {
      layers.push({
        type: "cta",
        source: info.ctaText,
        animation: {
          type: "scale-bounce",
          delayFrames: Math.round(0.5 * fps),
          durationFrames: Math.round(0.4 * fps),
        },
        layout: {
          x: 240,
          y: 1350,
          width: 600,
          height: 80,
          zIndex: 10,
        },
      });
    }

    return {
      sceneId: `scene_${index}`,
      durationFrames: Math.round(template.durationSeconds * fps),
      layers,
      transition: template.transition,
    };
  });

  const totalDurationFrames = scenes.reduce((sum, scene) => sum + scene.durationFrames, 0);

  return {
    jobId,
    style,
    width: DEFAULT_RENDER_TARGET.width,
    height: DEFAULT_RENDER_TARGET.height,
    fps,
    totalDurationFrames,
    scenes,
    colorTheme: {
      primary: info.brandColors.primary,
      secondary: info.brandColors.secondary,
      background: getDefaultBackground(style),
      textPrimary: "#FFFFFF",
      textSecondary: "#94A3B8",
    },
    typography: {
      headlineFont: getDefaultFont(style, "headline"),
      bodyFont: getDefaultFont(style, "body"),
    },
    productInfo: {
      title: info.title,
      description: info.description,
      ctaText: info.ctaText,
    },
  };
}

// ---------------------------------------------------------------------------
// Style-specific fallback templates
// ---------------------------------------------------------------------------

interface FallbackSceneTemplate {
  screenshotKey: string;
  durationSeconds: number;
  useProductTitle: boolean;
  useFeature: boolean;
  useDescription: boolean;
  fallbackText: string;
  subtextTemplate?: string;
  deviceAnimation: AnimationSpec["type"];
  deviceDelay: number;
  textAnimation: AnimationSpec["type"];
  textDelay: number;
  transition: TransitionEffect;
  showCta: boolean;
}

function getFallbackTemplate(style: DemoAssetStyle): FallbackSceneTemplate[] {
  switch (style) {
    case "clean-product-demo":
      return [
        {
          screenshotKey: "initial",
          durationSeconds: 3,
          useProductTitle: true,
          useFeature: false,
          useDescription: true,
          fallbackText: "Premium Experience",
          deviceAnimation: "float",
          deviceDelay: 5,
          textAnimation: "slide-up",
          textDelay: 0,
          transition: "3d-flip",
          showCta: false,
        },
        {
          screenshotKey: "section_0",
          durationSeconds: 2.5,
          useProductTitle: false,
          useFeature: true,
          useDescription: false,
          fallbackText: "Discover Features",
          deviceAnimation: "scale-bounce",
          deviceDelay: 0,
          textAnimation: "fade-in",
          textDelay: 8,
          transition: "3d-flip",
          showCta: false,
        },
        {
          screenshotKey: "section_1",
          durationSeconds: 2.5,
          useProductTitle: false,
          useFeature: true,
          useDescription: false,
          fallbackText: "Elegant Design",
          deviceAnimation: "scale-bounce",
          deviceDelay: 0,
          textAnimation: "fade-in",
          textDelay: 8,
          transition: "dissolve",
          showCta: false,
        },
        {
          screenshotKey: "full",
          durationSeconds: 3,
          useProductTitle: true,
          useFeature: false,
          useDescription: false,
          fallbackText: "Get Started",
          subtextTemplate: "{cta}",
          deviceAnimation: "float",
          deviceDelay: 0,
          textAnimation: "scale-bounce",
          textDelay: 5,
          transition: "cut",
          showCta: true,
        },
      ];

    case "problem-solution-demo":
      return [
        {
          screenshotKey: "none",
          durationSeconds: 2.5,
          useProductTitle: false,
          useFeature: false,
          useDescription: false,
          fallbackText: "Have this problem?",
          subtextTemplate: "We all struggle with this...",
          deviceAnimation: "none",
          deviceDelay: 0,
          textAnimation: "chat-bubble",
          textDelay: 0,
          transition: "dissolve",
          showCta: false,
        },
        {
          screenshotKey: "initial",
          durationSeconds: 3,
          useProductTitle: true,
          useFeature: false,
          useDescription: true,
          fallbackText: "The Solution",
          deviceAnimation: "slide-up",
          deviceDelay: 10,
          textAnimation: "chat-bubble",
          textDelay: 0,
          transition: "slide-left",
          showCta: false,
        },
        {
          screenshotKey: "section_0",
          durationSeconds: 2.5,
          useProductTitle: false,
          useFeature: true,
          useDescription: false,
          fallbackText: "See how it works",
          deviceAnimation: "slide-up",
          deviceDelay: 0,
          textAnimation: "chat-bubble",
          textDelay: 5,
          transition: "dissolve",
          showCta: false,
        },
        {
          screenshotKey: "full",
          durationSeconds: 2.5,
          useProductTitle: true,
          useFeature: false,
          useDescription: false,
          fallbackText: "Your solution awaits",
          subtextTemplate: "{cta}",
          deviceAnimation: "slide-up",
          deviceDelay: 0,
          textAnimation: "fade-in",
          textDelay: 5,
          transition: "cut",
          showCta: true,
        },
      ];

    case "feature-walkthrough":
      return [
        {
          screenshotKey: "initial",
          durationSeconds: 2,
          useProductTitle: true,
          useFeature: false,
          useDescription: false,
          fallbackText: "Meet the App",
          deviceAnimation: "spring-pop",
          deviceDelay: 0,
          textAnimation: "spring-pop",
          textDelay: 0,
          transition: "zoom-focus",
          showCta: false,
        },
        {
          screenshotKey: "section_0",
          durationSeconds: 2.5,
          useProductTitle: false,
          useFeature: true,
          useDescription: false,
          fallbackText: "Feature 1",
          deviceAnimation: "spring-pop",
          deviceDelay: 0,
          textAnimation: "spring-pop",
          textDelay: 5,
          transition: "zoom-focus",
          showCta: false,
        },
        {
          screenshotKey: "section_1",
          durationSeconds: 2.5,
          useProductTitle: false,
          useFeature: true,
          useDescription: false,
          fallbackText: "Feature 2",
          deviceAnimation: "spring-pop",
          deviceDelay: 0,
          textAnimation: "spring-pop",
          textDelay: 5,
          transition: "zoom-focus",
          showCta: false,
        },
        {
          screenshotKey: "section_2",
          durationSeconds: 2.5,
          useProductTitle: false,
          useFeature: true,
          useDescription: false,
          fallbackText: "Feature 3",
          deviceAnimation: "spring-pop",
          deviceDelay: 0,
          textAnimation: "spring-pop",
          textDelay: 5,
          transition: "zoom-focus",
          showCta: false,
        },
        {
          screenshotKey: "full",
          durationSeconds: 2,
          useProductTitle: true,
          useFeature: false,
          useDescription: false,
          fallbackText: "Get it now",
          subtextTemplate: "{cta}",
          deviceAnimation: "scale-bounce",
          deviceDelay: 0,
          textAnimation: "scale-bounce",
          textDelay: 5,
          transition: "cut",
          showCta: true,
        },
      ];

    case "social-proof-teaser":
      return [
        {
          screenshotKey: "initial",
          durationSeconds: 1.5,
          useProductTitle: false,
          useFeature: false,
          useDescription: false,
          fallbackText: "THIS APP...",
          deviceAnimation: "whip-pan",
          deviceDelay: 0,
          textAnimation: "glitch",
          textDelay: 0,
          transition: "whip-pan",
          showCta: false,
        },
        {
          screenshotKey: "section_0",
          durationSeconds: 1.5,
          useProductTitle: false,
          useFeature: true,
          useDescription: false,
          fallbackText: "CHANGES EVERYTHING",
          deviceAnimation: "whip-pan",
          deviceDelay: 0,
          textAnimation: "glitch",
          textDelay: 0,
          transition: "glitch",
          showCta: false,
        },
        {
          screenshotKey: "section_1",
          durationSeconds: 1.5,
          useProductTitle: false,
          useFeature: true,
          useDescription: false,
          fallbackText: "NO CAP",
          deviceAnimation: "whip-pan",
          deviceDelay: 0,
          textAnimation: "glitch",
          textDelay: 0,
          transition: "whip-pan",
          showCta: false,
        },
        {
          screenshotKey: "full",
          durationSeconds: 2,
          useProductTitle: true,
          useFeature: false,
          useDescription: false,
          fallbackText: "DOWNLOAD NOW",
          subtextTemplate: "{cta}",
          deviceAnimation: "scale-bounce",
          deviceDelay: 0,
          textAnimation: "scale-bounce",
          textDelay: 0,
          transition: "cut",
          showCta: true,
        },
      ];

    default:
      return getFallbackTemplate("clean-product-demo");
  }
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function resolveScreenshotPath(key: string, capture: CaptureResult): string {
  const ensureFileProtocol = (p: string) => {
    if (!p) return "";
    if (p.startsWith("http://") || p.startsWith("https://") || p.startsWith("file://")) {
      return p;
    }
    return `file://${p}`;
  };

  switch (key) {
    case "initial":
      return ensureFileProtocol(capture.screenshotInitialPath);
    case "full":
      return ensureFileProtocol(capture.screenshotFullPath);
    case "none":
      return "";
    default: {
      // section_0, section_1, section_2, etc.
      const match = key.match(/^section_(\d+)$/);
      if (match) {
        const index = parseInt(match[1], 10);
        return ensureFileProtocol(capture.sectionScreenshots[index] || capture.screenshotInitialPath);
      }
      return ensureFileProtocol(capture.screenshotInitialPath);
    }
  }
}

function buildLayersForScene(
  style: DemoAssetStyle,
  scene: AISceneResponse["scenes"][number],
  screenshotPath: string,
  info: ExtractedProductInfo,
  index: number,
): SceneLayer[] {
  const fps = DEFAULT_RENDER_TARGET.fps;
  const layers: SceneLayer[] = [
    {
      type: "background",
      source: getBackgroundSpec(style),
      animation: { type: "none", delayFrames: 0, durationFrames: 0 },
      layout: { x: 0, y: 0, width: 1080, height: 1920, zIndex: 0 },
    },
  ];

  if (screenshotPath) {
    layers.push({
      type: "device",
      source: screenshotPath,
      animation: {
        type: validateAnimation(scene.animationStyle),
        delayFrames: Math.round(0.2 * fps),
        durationFrames: Math.round(0.8 * fps),
      },
      layout: getDeviceLayout(style, scene.screenshotKey),
    });
  }

  if (scene.headline) {
    layers.push({
      type: "text",
      source: getSafeText(scene.headline, true),
      animation: {
        type: validateAnimation(scene.animationStyle),
        delayFrames: 0,
        durationFrames: Math.round(0.6 * fps),
      },
      layout: getTextLayout(style, "headline"),
    });
  }

  if (scene.subtext) {
    layers.push({
      type: "text",
      source: getSafeText(scene.subtext, false),
      animation: {
        type: "fade-in",
        delayFrames: Math.round(0.3 * fps),
        durationFrames: Math.round(0.5 * fps),
      },
      layout: getTextLayout(style, "subtext"),
    });
  }

  // Add CTA on last scene
  if (scene.layerType === "cta") {
    layers.push({
      type: "cta",
      source: info.ctaText,
      animation: {
        type: "scale-bounce",
        delayFrames: Math.round(0.5 * fps),
        durationFrames: Math.round(0.4 * fps),
      },
      layout: { x: 240, y: 1350, width: 600, height: 80, zIndex: 10 },
    });
  }

  return layers;
}

function validateTransition(transition: string): TransitionEffect {
  const valid: TransitionEffect[] = ["cut", "dissolve", "slide-left", "slide-right", "3d-flip", "whip-pan", "glitch", "zoom-focus"];
  return valid.includes(transition as TransitionEffect)
    ? (transition as TransitionEffect)
    : "dissolve";
}

function validateAnimation(animation: string): AnimationSpec["type"] {
  const valid: AnimationSpec["type"][] = ["none", "fade-in", "slide-up", "slide-left", "scale-bounce", "spring-pop", "whip-pan", "glitch", "float", "chat-bubble"];
  return valid.includes(animation as AnimationSpec["type"])
    ? (animation as AnimationSpec["type"])
    : "fade-in";
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1) + "…";
}

function getSafeText(text: string, isHeadline = false): string {
  if (!text) return "";
  const cleanText = text.replace(/\s+/g, " ").trim();
  const koreanCharCount = (cleanText.match(/[\uAC00-\uD7AF]/g) || []).length;
  const isKorean = koreanCharCount > cleanText.length * 0.3;
  
  if (isHeadline) {
    return truncateText(cleanText, 22);
  } else {
    const maxChars = isKorean ? 22 : 30;
    if (cleanText.length <= maxChars) {
      return cleanText;
    }
    
    const words = cleanText.split(" ");
    let line1 = "";
    let line2 = "";
    
    for (const word of words) {
      if (line2 === "") {
        const potential = line1 ? `${line1} ${word}` : word;
        if (potential.length <= maxChars) {
          line1 = potential;
        } else {
          line2 = word;
        }
      } else {
        const potential = `${line2} ${word}`;
        if (potential.length <= maxChars) {
          line2 = potential;
        } else {
          line2 = truncateText(potential, maxChars);
          break;
        }
      }
    }
    
    return line2 ? `${line1}\n${line2}` : line1;
  }
}

function getBackgroundSpec(style: DemoAssetStyle): string {
  switch (style) {
    case "clean-product-demo":
      return "gradient:#0B0805,#14100D";
    case "problem-solution-demo":
      return "split:#1E293B,#0F172A";
    case "feature-walkthrough":
      return "solid:#0E1117";
    case "social-proof-teaser":
      return "solid:#000000";
    default:
      return "solid:#0F172A";
  }
}

function getDefaultBackground(style: DemoAssetStyle): string {
  switch (style) {
    case "clean-product-demo":
      return "#0B0805";
    case "problem-solution-demo":
      return "#1E293B";
    case "feature-walkthrough":
      return "#0E1117";
    case "social-proof-teaser":
      return "#000000";
    default:
      return "#0F172A";
  }
}

function getDefaultFont(style: DemoAssetStyle, role: "headline" | "body"): string {
  const fonts: Record<DemoAssetStyle, { headline: string; body: string }> = {
    "clean-product-demo": { headline: "Playfair Display", body: "Inter" },
    "problem-solution-demo": { headline: "Nunito", body: "Nunito" },
    "feature-walkthrough": { headline: "Inter", body: "Inter" },
    "social-proof-teaser": { headline: "Impact", body: "Inter" },
    "both": { headline: "Inter", body: "Inter" },
  };
  return fonts[style]?.[role] || "Inter";
}

function getDeviceLayout(style: DemoAssetStyle, screenshotKey: string): LayoutSpec {
  switch (style) {
    case "clean-product-demo":
      return { x: 200, y: 500, width: 680, height: 1000, zIndex: 5 };
    case "problem-solution-demo":
      return { x: 140, y: 960, width: 800, height: 850, zIndex: 5 };
    case "feature-walkthrough":
      return { x: 60, y: 200, width: 960, height: 700, zIndex: 5 };
    case "social-proof-teaser":
      return { x: 0, y: 200, width: 1080, height: 1200, zIndex: 5 };
    default:
      return { x: 200, y: 500, width: 680, height: 1000, zIndex: 5 };
  }
}

function getTextLayout(style: DemoAssetStyle, role: "headline" | "subtext"): LayoutSpec {
  if (role === "headline") {
    switch (style) {
      case "clean-product-demo":
        return { x: 60, y: 200, width: 860, height: 120, zIndex: 8 };
      case "problem-solution-demo":
        return { x: 60, y: 200, width: 860, height: 120, zIndex: 8 };
      case "feature-walkthrough":
        return { x: 60, y: 160, width: 860, height: 100, zIndex: 8 };
      case "social-proof-teaser":
        return { x: 60, y: 800, width: 860, height: 200, zIndex: 8 };
      default:
        return { x: 60, y: 200, width: 860, height: 120, zIndex: 8 };
    }
  }
  // subtext
  return { x: 60, y: 340, width: 860, height: 80, zIndex: 7 };
}
