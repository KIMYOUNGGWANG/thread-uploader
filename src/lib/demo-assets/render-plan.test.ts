import { describe, it, expect } from "vitest";
import { buildRenderPlan, buildImageRenderPlan } from "./render-plan";
import type { CreativePlan, SceneBeat, SceneLayer } from "./creative-planner";

function makeTestPlan(): CreativePlan {
  const makeLayer = (type: SceneLayer["type"], source: string, y = 200): SceneLayer => ({
    type,
    source,
    animation: { type: "fade-in", delayFrames: 0, durationFrames: 18 },
    layout: { x: 60, y, width: 860, height: 120, zIndex: type === "text" ? 8 : type === "cta" ? 10 : 5 },
  });

  const scenes: SceneBeat[] = [
    {
      sceneId: "scene_0",
      durationFrames: 90,
      layers: [
        makeLayer("background", "gradient:#0B0805,#14100D", 0),
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
      durationFrames: 90,
      layers: [
        makeLayer("background", "solid:#0F172A", 0),
        makeLayer("cta", "Try Now", 1350),
      ],
      transition: "cut",
    },
  ];

  return {
    jobId: "render-test-job",
    style: "clean-product-demo",
    width: 1080,
    height: 1920,
    fps: 30,
    totalDurationFrames: 255,
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
  };
}

describe("render-plan", () => {
  describe("buildRenderPlan", () => {
    it("produces valid Remotion render props", () => {
      const plan = makeTestPlan();
      const props = buildRenderPlan(plan);

      expect(props.compositionId).toContain("demo-clean-product-demo-render-test-job");
      expect(props.width).toBe(1080);
      expect(props.height).toBe(1920);
      expect(props.fps).toBe(30);
      expect(props.durationInFrames).toBe(255);
    });

    it("maps all scenes to sequences", () => {
      const plan = makeTestPlan();
      const props = buildRenderPlan(plan);

      expect(props.inputProps.sequences).toHaveLength(3);
      expect(props.inputProps.sequences[0].id).toBe("scene_0");
      expect(props.inputProps.sequences[1].id).toBe("scene_1");
      expect(props.inputProps.sequences[2].id).toBe("scene_2");
    });

    it("maps layers to elements with correct types", () => {
      const plan = makeTestPlan();
      const props = buildRenderPlan(plan);

      const firstSequence = props.inputProps.sequences[0];
      expect(firstSequence.elements).toHaveLength(3);

      const types = firstSequence.elements.map((e) => e.type);
      expect(types).toContain("background");
      expect(types).toContain("device-mockup");
      expect(types).toContain("headline");
    });

    it("computes transition overlaps between sequences", () => {
      const plan = makeTestPlan();
      const props = buildRenderPlan(plan);

      // First sequence starts at 0
      expect(props.inputProps.sequences[0].from).toBe(0);

      // Subsequent sequences should have overlap-adjusted start frames
      const secondFrom = props.inputProps.sequences[1].from;
      expect(secondFrom).toBeLessThan(90); // 90 is scene_0 duration
      expect(secondFrom).toBeGreaterThan(0);
    });

    it("last sequence has no transition", () => {
      const plan = makeTestPlan();
      const props = buildRenderPlan(plan);

      const lastSequence = props.inputProps.sequences[props.inputProps.sequences.length - 1];
      expect(lastSequence.transition.durationInFrames).toBe(0);
    });

    it("background gradient is expanded to CSS", () => {
      const plan = makeTestPlan();
      const props = buildRenderPlan(plan);

      const bgElement = props.inputProps.sequences[0].elements.find((e) => e.type === "background");
      expect(bgElement).toBeDefined();
      expect(bgElement!.style.extra?.background).toContain("linear-gradient");
    });

    it("device mockup gets rounded border and shadow", () => {
      const plan = makeTestPlan();
      const props = buildRenderPlan(plan);

      const deviceElement = props.inputProps.sequences[0].elements.find(
        (e) => e.type === "device-mockup",
      );
      expect(deviceElement).toBeDefined();
      expect(deviceElement!.style.extra?.borderRadius).toBe(32);
      expect(deviceElement!.style.extra?.boxShadow).toContain("rgba");
    });

    it("CTA button gets primary brand color", () => {
      const plan = makeTestPlan();
      const props = buildRenderPlan(plan);

      const lastSequence = props.inputProps.sequences[2];
      const ctaElement = lastSequence.elements.find((e) => e.type === "cta-button");
      expect(ctaElement).toBeDefined();
      expect(ctaElement!.style.extra?.backgroundColor).toBe("#6366F1");
    });

    it("preserves product info and color theme", () => {
      const plan = makeTestPlan();
      const props = buildRenderPlan(plan);

      expect(props.inputProps.productInfo.title).toBe("Test App");
      expect(props.inputProps.colorTheme.primary).toBe("#6366F1");
      expect(props.inputProps.typography.headlineFont).toBe("Playfair Display");
    });
  });

  describe("buildImageRenderPlan", () => {
    it("produces single-frame render props", () => {
      const plan = makeTestPlan();
      const props = buildImageRenderPlan(plan);

      expect(props.durationInFrames).toBe(1);
      expect(props.inputProps.sequences).toHaveLength(1);
      expect(props.compositionId).toContain("demo-still");
    });

    it("uses specified scene index", () => {
      const plan = makeTestPlan();
      const props = buildImageRenderPlan(plan, 1);

      expect(props.inputProps.sequences[0].id).toBe("still_1");
    });

    it("clamps out-of-range scene index to last scene", () => {
      const plan = makeTestPlan();
      const props = buildImageRenderPlan(plan, 999);

      // Should use the last scene's elements
      expect(props.inputProps.sequences[0].elements.length).toBeGreaterThan(0);
    });
  });
});
