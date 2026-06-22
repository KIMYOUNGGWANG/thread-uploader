import { describe, it, expect, afterEach } from "vitest";
import { renderVideo, renderImage } from "./renderer";
import fs from "fs/promises";
import path from "path";
import type { RemotionRenderProps } from "./render-plan";

const TEST_OUTPUT_DIR = path.join(process.cwd(), ".data/test-render-output");

function makeTestRenderProps(overrides?: Partial<RemotionRenderProps>): RemotionRenderProps {
  return {
    compositionId: "demo-clean-product-demo-test",
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 255,
    inputProps: {
      jobId: "test-job",
      style: "clean-product-demo",
      colorTheme: {
        primary: "#6366F1",
        secondary: "#0F172A",
        background: "#0B0805",
        textPrimary: "#FFFFFF",
        textSecondary: "#94A3B8",
      },
      typography: { headlineFont: "Playfair Display", bodyFont: "Inter" },
      productInfo: { title: "Test App", description: "Test", ctaText: "Try Now" },
      sequences: [
        {
          id: "scene_0",
          from: 0,
          durationInFrames: 90,
          transition: { type: "3d-flip", durationInFrames: 9 },
          elements: [
            {
              id: "el_0",
              type: "background",
              content: "solid:#0F172A",
              style: { position: "absolute", left: 0, top: 0, width: 1080, height: 1920, zIndex: 0 },
              animation: { type: "none", delay: 0, duration: 0, easing: "ease-out" },
            },
          ],
        },
      ],
    },
    ...overrides,
  };
}

afterEach(async () => {
  try {
    await fs.rm(TEST_OUTPUT_DIR, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
});

describe("renderer", () => {
  describe("renderVideo", () => {
    it("creates an MP4 output file", async () => {
      const props = makeTestRenderProps();
      const result = await renderVideo(props, TEST_OUTPUT_DIR, 0);

      expect(result.outputPath).toContain(".mp4");
      expect(result.fileSize).toBeGreaterThan(1000); // Binary video file should be larger
      expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);

      // Verify file exists
      const stat = await fs.stat(result.outputPath);
      expect(stat.size).toBe(result.fileSize);
    }, 45000); // Extend timeout as bundling & rendering takes some time

    it("creates unique files for different indices", async () => {
      const props = makeTestRenderProps();
      const result0 = await renderVideo(props, TEST_OUTPUT_DIR, 0);
      const result1 = await renderVideo(props, TEST_OUTPUT_DIR, 1);

      expect(result0.outputPath).not.toBe(result1.outputPath);
    }, 45000);
  });

  describe("renderImage", () => {
    it("creates a PNG output file", async () => {
      const props = makeTestRenderProps({ durationInFrames: 1 });
      const result = await renderImage(props, TEST_OUTPUT_DIR, 0);

      expect(result.outputPath).toContain(".png");
      expect(result.fileSize).toBeGreaterThan(1000); // Binary image file should be larger
      expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
    }, 45000);

    it("includes style in filename", async () => {
      const props = makeTestRenderProps();
      const result = await renderImage(props, TEST_OUTPUT_DIR, 0);

      expect(result.outputPath).toContain("clean-product-demo");
    }, 45000);
  });
});
