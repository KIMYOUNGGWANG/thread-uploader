import { describe, expect, it } from "vitest";
import {
  isValidDemoAssetJobStatus,
  normalizeDemoAssetStyle,
  normalizeDemoAssetJobConfig,
  DEFAULT_RENDER_TARGET,
} from "./demo-asset";

describe("demo-asset type validators and normalizers", () => {
  describe("isValidDemoAssetJobStatus", () => {
    it("approves valid statuses", () => {
      expect(isValidDemoAssetJobStatus("QUEUED")).toBe(true);
      expect(isValidDemoAssetJobStatus("CAPTURING")).toBe(true);
      expect(isValidDemoAssetJobStatus("PLANNING")).toBe(true);
      expect(isValidDemoAssetJobStatus("RENDERING")).toBe(true);
      expect(isValidDemoAssetJobStatus("READY")).toBe(true);
      expect(isValidDemoAssetJobStatus("FAILED_CAPTURE")).toBe(true);
    });

    it("rejects invalid statuses", () => {
      expect(isValidDemoAssetJobStatus("INVALID_STATUS")).toBe(false);
      expect(isValidDemoAssetJobStatus("")).toBe(false);
      expect(isValidDemoAssetJobStatus(null)).toBe(false);
      expect(isValidDemoAssetJobStatus(undefined)).toBe(false);
      expect(isValidDemoAssetJobStatus(123)).toBe(false);
    });
  });

  describe("normalizeDemoAssetStyle", () => {
    it("passes valid styles through", () => {
      expect(normalizeDemoAssetStyle("clean-product-demo")).toBe("clean-product-demo");
      expect(normalizeDemoAssetStyle("problem-solution-demo")).toBe("problem-solution-demo");
      expect(normalizeDemoAssetStyle("feature-walkthrough")).toBe("feature-walkthrough");
      expect(normalizeDemoAssetStyle("social-proof-teaser")).toBe("social-proof-teaser");
    });

    it("falls back to clean-product-demo for invalid styles", () => {
      expect(normalizeDemoAssetStyle("unknown-style")).toBe("clean-product-demo");
      expect(normalizeDemoAssetStyle(null)).toBe("clean-product-demo");
      expect(normalizeDemoAssetStyle(undefined)).toBe("clean-product-demo");
    });
  });

  describe("normalizeDemoAssetJobConfig", () => {
    it("handles happy path config", () => {
      const config = normalizeDemoAssetJobConfig({
        brandId: "brand_123",
        productUrl: "https://example.com",
        style: "problem-solution-demo",
        videoCount: 2,
        imageCount: 4,
      });

      expect(config).toEqual({
        brandId: "brand_123",
        productUrl: "https://example.com",
        productContext: undefined,
        style: "problem-solution-demo",
        videoCount: 2,
        imageCount: 4,
      });
    });

    it("clamps counts to 1-5 videos and 1-12 images", () => {
      const configUnder = normalizeDemoAssetJobConfig({
        brandId: "brand_123",
        productUrl: "https://example.com",
        videoCount: 0,
        imageCount: 0,
      });

      expect(configUnder.videoCount).toBe(1);
      expect(configUnder.imageCount).toBe(1);

      const configOver = normalizeDemoAssetJobConfig({
        brandId: "brand_123",
        productUrl: "https://example.com",
        videoCount: 10,
        imageCount: 20,
      });

      expect(configOver.videoCount).toBe(5);
      expect(configOver.imageCount).toBe(12);
    });

    it("uses default counts when missing or invalid", () => {
      const configMissing = normalizeDemoAssetJobConfig({
        brandId: "brand_123",
        productUrl: "https://example.com",
      });

      expect(configMissing.videoCount).toBe(3);
      expect(configMissing.imageCount).toBe(6);

      const configInvalid = normalizeDemoAssetJobConfig({
        brandId: "brand_123",
        productUrl: "https://example.com",
        videoCount: "invalid",
        imageCount: {},
      });

      expect(configInvalid.videoCount).toBe(3);
      expect(configInvalid.imageCount).toBe(6);
    });

    it("preserves productContext if provided as string", () => {
      const contextString = JSON.stringify({ title: "Custom Title" });
      const config = normalizeDemoAssetJobConfig({
        brandId: "brand_123",
        productUrl: "https://example.com",
        productContext: contextString,
      });

      expect(config.productContext).toBe(contextString);
    });
  });

  describe("DEFAULT_RENDER_TARGET", () => {
    it("has 1080x1920 dimensions and mp4 format", () => {
      expect(DEFAULT_RENDER_TARGET.width).toBe(1080);
      expect(DEFAULT_RENDER_TARGET.height).toBe(1920);
      expect(DEFAULT_RENDER_TARGET.fps).toBe(30);
      expect(DEFAULT_RENDER_TARGET.videoFormat).toBe("mp4");
      expect(DEFAULT_RENDER_TARGET.imageFormat).toBe("png");
    });
  });
});
