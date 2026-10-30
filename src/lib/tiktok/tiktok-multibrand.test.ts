import { describe, it, expect } from "vitest";
import { generateTikTokScript } from "./tiktok-script-engine";
import { buildTikTokDraftCreateData, resolveTikTokEngine } from "./tiktok-draft-service";

describe("resolveTikTokEngine", () => {
  it("routes saju brands to the saju engine", () => {
    expect(resolveTikTokEngine("cosmicpath", "saju_viral")).toBe("saju");
    // cosmicpath-global sells saju products under an ecommerce profile
    expect(resolveTikTokEngine("cosmicpath-global", "ecommerce_d2c")).toBe("saju");
  });

  it("routes every other brand to the product engine", () => {
    expect(resolveTikTokEngine("catchdex", "product_growth")).toBe("product");
    expect(resolveTikTokEngine("ulw-qa-demo-assets", "career_decision")).toBe("product");
  });
});

describe("buildTikTokDraftCreateData engine", () => {
  const script = generateTikTokScript({ topic: "사주" });

  it("keeps saju campaign values by default", () => {
    const data = buildTikTokDraftCreateData("brand-1", script, "DRAFT");
    expect(data.campaignId).toBe("saju_tiktok_campaign");
    expect(data.qualityProfile).toBe("tiktok_saju_retention");
  });

  it("tags product drafts with the product campaign", () => {
    const data = buildTikTokDraftCreateData("brand-1", script, "DRAFT", "product");
    expect(data.campaignId).toBe("product_tiktok_campaign");
    expect(data.qualityProfile).toBe("tiktok_product_retention");
  });
});
