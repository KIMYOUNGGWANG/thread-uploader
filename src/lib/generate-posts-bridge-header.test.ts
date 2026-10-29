import { describe, expect, it } from "vitest";
import { firstCommentBridgeHeader } from "./generate-posts";
import { parseBrandConfig } from "@/types/brand";

function config(overrides: Record<string, unknown>) {
  return parseBrandConfig(JSON.stringify(overrides));
}

describe("firstCommentBridgeHeader", () => {
  it("keeps the CosmicPath report headers on CosmicPath brands", () => {
    expect(firstCommentBridgeHeader("cosmicpath", config({ qualityProfile: "saju_viral" }), undefined)).toContain("5대 계산 엔진");
    expect(firstCommentBridgeHeader("cosmicpath-global", config({ qualityProfile: "ecommerce_d2c" }), undefined)).toContain("cosmicpath.app");
  });

  it("never puts the CosmicPath header on another brand, English or Korean", () => {
    const english = config({ qualityProfile: "ecommerce_d2c", productProfile: { productName: "Catch" } });
    expect(firstCommentBridgeHeader("catchdex-global", english, "product_growth_baseline")).toBe("");
    const korean = config({ qualityProfile: "product_growth", productProfile: { productName: "catch" } });
    expect(firstCommentBridgeHeader("catchdex", korean, "product_growth_baseline")).toBe("");
  });
});
