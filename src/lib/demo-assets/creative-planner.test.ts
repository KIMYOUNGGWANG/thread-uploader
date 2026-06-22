import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { CaptureResult } from "./capture-runner";
import type { DemoAssetStyle } from "../../types/demo-asset";

// Mock Anthropic SDK before importing the module under test
vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = {
      create: vi.fn(),
    };
  },
}));

// Dynamic import after mocks are registered
const { generateCreativePlan, buildFallbackPlan } = await import("./creative-planner");

function makeMockCapture(overrides?: Partial<CaptureResult>): CaptureResult {
  return {
    screenshotInitialPath: "/tmp/test/screenshot_initial.png",
    screenshotFullPath: "/tmp/test/screenshot_full.png",
    sectionScreenshots: [
      "/tmp/test/section_main_0.png",
      "/tmp/test/section_section_1.png",
    ],
    textBlocks: [
      "Discover the perfect cocktail recipe in seconds",
      "Over 2000 recipes curated by top mixologists",
      "Track your home bar inventory automatically",
      "AI-powered drink recommendations",
    ],
    ctas: [
      { text: "Try Free", selector: "a.cta-button" },
      { text: "Download", selector: "a#download-link" },
    ],
    title: "BarShelf — Your Smart Home Bar",
    description: "Find your perfect drink with AI-powered recommendations and 2000+ recipes",
    actionLog: [],
    ...overrides,
  };
}

describe("creative-planner", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Ensure no API key so fallback path is used
    delete process.env.ANTHROPIC_API_KEY;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("buildFallbackPlan", () => {
    const styles: DemoAssetStyle[] = [
      "clean-product-demo",
      "problem-solution-demo",
      "feature-walkthrough",
      "social-proof-teaser",
    ];

    for (const style of styles) {
      it(`generates valid plan for style: ${style}`, () => {
        const capture = makeMockCapture();
        const plan = buildFallbackPlan("job-test-1", style, capture, {
          title: capture.title,
          description: capture.description,
          ctaText: capture.ctas[0].text,
          keyFeatures: capture.textBlocks.slice(0, 4),
          brandColors: { primary: "#6366F1", secondary: "#0F172A" },
        });

        expect(plan.jobId).toBe("job-test-1");
        expect(plan.style).toBe(style);
        expect(plan.width).toBe(1080);
        expect(plan.height).toBe(1920);
        expect(plan.fps).toBe(30);
        expect(plan.scenes.length).toBeGreaterThanOrEqual(4);
        expect(plan.totalDurationFrames).toBeGreaterThan(0);

        // Verify all scenes have required fields
        for (const scene of plan.scenes) {
          expect(scene.sceneId).toBeTruthy();
          expect(scene.durationFrames).toBeGreaterThan(0);
          expect(scene.layers.length).toBeGreaterThanOrEqual(1);
          expect(scene.transition).toBeTruthy();
        }

        // Verify color theme
        expect(plan.colorTheme.primary).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(plan.colorTheme.background).toMatch(/^#[0-9A-Fa-f]{6}$/);

        // Verify typography
        expect(plan.typography.headlineFont).toBeTruthy();
        expect(plan.typography.bodyFont).toBeTruthy();

        // Verify product info
        expect(plan.productInfo.title).toBe("BarShelf — Your Smart Home Bar");
        expect(plan.productInfo.ctaText).toBe("Try Free");
      });
    }

    it("uses product title in first scene of clean-product-demo", () => {
      const capture = makeMockCapture();
      const plan = buildFallbackPlan("job-test-2", "clean-product-demo", capture, {
        title: capture.title,
        description: capture.description,
        ctaText: "Try Free",
        keyFeatures: capture.textBlocks.slice(0, 4),
        brandColors: { primary: "#6366F1", secondary: "#0F172A" },
      });

      // First scene should contain a text layer with the product title
      const firstScene = plan.scenes[0];
      const textLayer = firstScene.layers.find((layer) => layer.type === "text");
      expect(textLayer).toBeDefined();
      expect(textLayer!.source).toContain("BarShelf");
    });

    it("includes CTA in last scene", () => {
      const capture = makeMockCapture();
      const plan = buildFallbackPlan("job-test-3", "clean-product-demo", capture, {
        title: capture.title,
        description: capture.description,
        ctaText: "Try Free",
        keyFeatures: capture.textBlocks.slice(0, 4),
        brandColors: { primary: "#6366F1", secondary: "#0F172A" },
      });

      const lastScene = plan.scenes[plan.scenes.length - 1];
      const ctaLayer = lastScene.layers.find((layer) => layer.type === "cta");
      expect(ctaLayer).toBeDefined();
      expect(ctaLayer!.source).toBe("Try Free");
    });

    it("falls back to defaults when capture has no text blocks", () => {
      const capture = makeMockCapture({
        textBlocks: [],
        ctas: [],
        title: "",
        description: "",
      });

      const plan = buildFallbackPlan("job-test-4", "social-proof-teaser", capture, {
        title: "Premium App",
        description: "",
        ctaText: "Try Now",
        keyFeatures: [],
        brandColors: { primary: "#6366F1", secondary: "#0F172A" },
      });

      expect(plan.scenes.length).toBeGreaterThanOrEqual(4);
      expect(plan.productInfo.title).toBe("Premium App");
      expect(plan.productInfo.ctaText).toBe("Try Now");
    });
  });

  describe("generateCreativePlan", () => {
    it("uses fallback when no ANTHROPIC_API_KEY is set", async () => {
      delete process.env.ANTHROPIC_API_KEY;
      const capture = makeMockCapture();

      const plan = await generateCreativePlan("job-test-5", "clean-product-demo", capture);

      expect(plan.jobId).toBe("job-test-5");
      expect(plan.style).toBe("clean-product-demo");
      expect(plan.scenes.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe("safe zone constraints", () => {
    it("ensures no text layer exceeds safe zone boundaries", () => {
      const capture = makeMockCapture();
      const plan = buildFallbackPlan("job-safezone", "clean-product-demo", capture, {
        title: capture.title,
        description: capture.description,
        ctaText: "Try Free",
        keyFeatures: capture.textBlocks,
        brandColors: { primary: "#6366F1", secondary: "#0F172A" },
      });

      for (const scene of plan.scenes) {
        for (const layer of scene.layers) {
          if (layer.type === "text" || layer.type === "cta") {
            // Top safe zone: 150px
            expect(layer.layout.y).toBeGreaterThanOrEqual(150);
            // Right safe zone: x + width should not exceed 1080 - 160 = 920
            expect(layer.layout.x + layer.layout.width).toBeLessThanOrEqual(920);
          }
        }
      }
    });

    it("truncates text to max length", () => {
      const longTitle = "이것은 매우 매우 매우 매우 매우 매우 긴 앱 제목이고 22자를 초과합니다";
      const capture = makeMockCapture({ title: longTitle });

      const plan = buildFallbackPlan("job-truncate", "clean-product-demo", capture, {
        title: longTitle,
        description: "",
        ctaText: "Try Free",
        keyFeatures: [],
        brandColors: { primary: "#6366F1", secondary: "#0F172A" },
      });

      // Check that text layer sources are max 22 chars
      const firstScene = plan.scenes[0];
      const textLayers = firstScene.layers.filter((layer) => layer.type === "text");
      for (const layer of textLayers) {
        expect(layer.source.length).toBeLessThanOrEqual(22);
      }
    });
  });

  describe("scene transitions", () => {
    it("uses style-appropriate transitions", () => {
      const capture = makeMockCapture();

      // Clean product demo should use 3d-flip transitions
      const cleanPlan = buildFallbackPlan("job-transitions-1", "clean-product-demo", capture, {
        title: capture.title,
        description: capture.description,
        ctaText: "Try",
        keyFeatures: capture.textBlocks,
        brandColors: { primary: "#6366F1", secondary: "#0F172A" },
      });
      expect(cleanPlan.scenes.some((s) => s.transition === "3d-flip")).toBe(true);

      // Social proof teaser should use whip-pan or glitch transitions
      const socialPlan = buildFallbackPlan("job-transitions-2", "social-proof-teaser", capture, {
        title: capture.title,
        description: capture.description,
        ctaText: "Try",
        keyFeatures: capture.textBlocks,
        brandColors: { primary: "#6366F1", secondary: "#0F172A" },
      });
      expect(
        socialPlan.scenes.some((s) => s.transition === "whip-pan" || s.transition === "glitch"),
      ).toBe(true);
    });
  });
});
