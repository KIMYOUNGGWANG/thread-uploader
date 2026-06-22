import { describe, it, expect } from "vitest";
import { runQualityGate } from "./quality-gate";
import type { CreativePlan, SceneBeat, SceneLayer } from "./creative-planner";

function makeMinimalPlan(overrides?: Partial<CreativePlan>): CreativePlan {
  const makeLayer = (type: SceneLayer["type"], source: string, y = 200): SceneLayer => ({
    type,
    source,
    animation: { type: "fade-in", delayFrames: 0, durationFrames: 18 },
    layout: { x: 60, y, width: 860, height: 120, zIndex: type === "text" ? 8 : 5 },
  });

  const scenes: SceneBeat[] = [
    {
      sceneId: "scene_0",
      durationFrames: 90,
      layers: [
        makeLayer("background", "solid:#0F172A", 0),
        makeLayer("device", "/tmp/screenshot.png", 500),
        makeLayer("text", "Hello Product", 200),
      ],
      transition: "3d-flip",
    },
    {
      sceneId: "scene_1",
      durationFrames: 75,
      layers: [
        makeLayer("background", "solid:#0F172A", 0),
        makeLayer("device", "/tmp/screenshot2.png", 500),
        makeLayer("text", "Feature One", 200),
      ],
      transition: "dissolve",
    },
    {
      sceneId: "scene_2",
      durationFrames: 75,
      layers: [
        makeLayer("background", "solid:#0F172A", 0),
        makeLayer("text", "Feature Two", 200),
      ],
      transition: "dissolve",
    },
    {
      sceneId: "scene_3",
      durationFrames: 90,
      layers: [
        makeLayer("background", "solid:#0F172A", 0),
        makeLayer("cta", "Try Now", 1350),
      ],
      transition: "cut",
    },
  ];

  return {
    jobId: "test-job",
    style: "clean-product-demo",
    width: 1080,
    height: 1920,
    fps: 30,
    totalDurationFrames: scenes.reduce((sum, s) => sum + s.durationFrames, 0),
    scenes,
    colorTheme: {
      primary: "#6366F1",
      secondary: "#0F172A",
      background: "#0B0805",
      textPrimary: "#FFFFFF",
      textSecondary: "#94A3B8",
    },
    typography: { headlineFont: "Playfair Display", bodyFont: "Inter" },
    productInfo: { title: "Test App", description: "A test app", ctaText: "Try Now" },
    ...overrides,
  };
}

describe("quality-gate", () => {
  it("passes a valid plan", () => {
    const plan = makeMinimalPlan();
    const result = runQualityGate(plan);
    expect(result.passed).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("fails when scenes are too few", () => {
    const plan = makeMinimalPlan({
      scenes: [makeMinimalPlan().scenes[0], makeMinimalPlan().scenes[1]],
      totalDurationFrames: 165,
    });
    const result = runQualityGate(plan);
    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.code === "TOO_FEW_SCENES")).toBe(true);
  });

  it("fails when total duration is too short", () => {
    const shortScenes = makeMinimalPlan().scenes.map((scene) => ({
      ...scene,
      durationFrames: 15,
    }));
    const plan = makeMinimalPlan({
      scenes: shortScenes,
      totalDurationFrames: 60,
    });
    const result = runQualityGate(plan);
    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.code === "TOO_SHORT")).toBe(true);
  });

  it("fails when a scene is too short", () => {
    const scenes = [...makeMinimalPlan().scenes];
    scenes[1] = { ...scenes[1], durationFrames: 10 };
    const plan = makeMinimalPlan({ scenes, totalDurationFrames: 265 });
    const result = runQualityGate(plan);
    expect(result.errors.some((e) => e.code === "SCENE_TOO_SHORT")).toBe(true);
  });

  it("warns when text is in top safe zone", () => {
    const scenes = [...makeMinimalPlan().scenes];
    const unsafeLayer: SceneLayer = {
      type: "text",
      source: "Top Text",
      animation: { type: "fade-in", delayFrames: 0, durationFrames: 18 },
      layout: { x: 60, y: 50, width: 860, height: 80, zIndex: 8 },
    };
    scenes[0] = { ...scenes[0], layers: [...scenes[0].layers, unsafeLayer] };
    const plan = makeMinimalPlan({ scenes });
    const result = runQualityGate(plan);
    expect(result.warnings.some((w) => w.code === "TEXT_IN_TOP_SAFE_ZONE")).toBe(true);
  });

  it("fails when text line is too long for Korean", () => {
    const longKoreanText = "가나다라마바사아자차카타파하가나다라마바사아자차";
    const scenes = [...makeMinimalPlan().scenes];
    const longLayer: SceneLayer = {
      type: "text",
      source: longKoreanText,
      animation: { type: "fade-in", delayFrames: 0, durationFrames: 18 },
      layout: { x: 60, y: 200, width: 860, height: 120, zIndex: 8 },
    };
    scenes[0] = { ...scenes[0], layers: [scenes[0].layers[0], longLayer] };
    const plan = makeMinimalPlan({ scenes });
    const result = runQualityGate(plan);
    expect(result.errors.some((e) => e.code === "TEXT_LINE_TOO_LONG")).toBe(true);
  });

  it("fails when device layer has empty source", () => {
    const scenes = [...makeMinimalPlan().scenes];
    const emptyDevice: SceneLayer = {
      type: "device",
      source: "",
      animation: { type: "fade-in", delayFrames: 0, durationFrames: 18 },
      layout: { x: 200, y: 500, width: 680, height: 1000, zIndex: 5 },
    };
    scenes[0] = { ...scenes[0], layers: [scenes[0].layers[0], emptyDevice] };
    const plan = makeMinimalPlan({ scenes });
    const result = runQualityGate(plan);
    expect(result.errors.some((e) => e.code === "MISSING_MEDIA_REFERENCE")).toBe(true);
  });

  it("warns when no CTA layer exists", () => {
    const scenes = makeMinimalPlan().scenes.map((scene) => ({
      ...scene,
      layers: scene.layers.filter((layer) => layer.type !== "cta"),
    }));
    const plan = makeMinimalPlan({ scenes });
    const result = runQualityGate(plan);
    expect(result.warnings.some((w) => w.code === "NO_CTA")).toBe(true);
  });
});
