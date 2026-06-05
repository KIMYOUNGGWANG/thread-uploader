import { describe, expect, it } from "vitest";
import { buildCreateProductConfig } from "@/app/api/brands/route";
import { buildAccountDiscoverySignals } from "@/lib/account-discovery";
import { buildProductAutoSetupDraft } from "@/lib/product-auto-setup";
import { PRODUCT_GROWTH_BASELINE } from "@/types/brand";

describe("buildCreateProductConfig", () => {
  it("defaults API-created products to product growth baseline", () => {
    const config = buildCreateProductConfig({}, "InvoiceFlow", "invoice-flow");

    expect(config.productProfile.productName).toBe("InvoiceFlow");
    expect(config.activeExperiment.id).toBe("invoice-flow");
    expect(config.activeExperiment.name).toBe("InvoiceFlow baseline growth loop");
    expect(config.qualityProfile).toBe("product_growth");
    expect(config.activeCampaignId).toBe("product_growth_baseline");
    expect(config.campaigns).toHaveLength(1);
    expect(config.campaigns[0]?.id).toBe("product_growth_baseline");
    expect(config.campaigns[0]?.qualityProfile).toBe("product_growth");
    expect(config.campaigns[0]?.utmCampaign).toContain("invoice");
    expect(config.tiktokVideo.enabled).toBe(false);
    expect(config.tiktokVideo.parentCampaignId).toBe("product_growth_baseline");
    expect(config.tiktokVideo.landingUrl).toBe("");
    expect(config.tiktokVideo.formats).toHaveLength(0);
  });

  it("preserves explicitly supplied campaigns", () => {
    const config = buildCreateProductConfig({
      campaigns: [{
        id: "career_timing_wedge_399",
        name: "커리어 타이밍 불안 wedge",
        mode: "landing-test",
        qualityProfile: "career_decision",
        landingUrl: "/career/uncertainty",
        utmSource: "threads",
        utmCampaign: "career_timing_wedge_399",
        utmContentTemplate: "{{postId}}",
        dailyPostTarget: 3,
        linkCadenceEvery: 3,
        linkPlacement: "firstComment",
        formulas: [],
        replyPlaybook: {},
      }],
      activeCampaignId: "career_timing_wedge_399",
      qualityProfile: "career_decision",
    }, "CosmicPath", "cosmicpath");

    expect(config.activeCampaignId).toBe("career_timing_wedge_399");
    expect(config.qualityProfile).toBe("career_decision");
    expect(config.campaigns[0]?.id).toBe("career_timing_wedge_399");
  });

  it("does not normalize empty product baseline landing URL to career default", () => {
    const config = buildCreateProductConfig({
      campaigns: [{
        ...PRODUCT_GROWTH_BASELINE,
        landingUrl: "",
        utmCampaign: "invoice-flow",
      }],
      activeCampaignId: PRODUCT_GROWTH_BASELINE.id,
      qualityProfile: "product_growth",
    }, "InvoiceFlow", "invoice-flow");

    expect(config.campaigns[0]?.id).toBe("product_growth_baseline");
    expect(config.campaigns[0]?.landingUrl).toBe("");
    expect(config.campaigns[0]?.qualityProfile).toBe("product_growth");
    expect(config.campaigns[0]?.utmCampaign).toContain("invoice");
    expect(config.campaigns[0]?.landingUrl).not.toBe("/career/uncertainty");
  });

  it("normalizes id-only product baseline campaigns with product growth defaults", () => {
    const config = buildCreateProductConfig({
      campaigns: [{
        id: PRODUCT_GROWTH_BASELINE.id,
        landingUrl: "",
      }],
      activeCampaignId: PRODUCT_GROWTH_BASELINE.id,
    }, "InvoiceFlow", "invoice-flow");

    expect(config.campaigns[0]?.id).toBe("product_growth_baseline");
    expect(config.campaigns[0]?.landingUrl).toBe("");
    expect(config.campaigns[0]?.qualityProfile).toBe("product_growth");
    expect(config.qualityProfile).toBe("product_growth");
    expect(config.campaigns[0]?.name).toBe("제품 성장 baseline");
    expect(config.campaigns[0]?.landingUrl).not.toBe("/career/uncertainty");

    const discoverySignals = buildAccountDiscoverySignals(config);
    expect(discoverySignals.mode).toBe("product");
    expect(discoverySignals.seedKeywords.join(" ")).not.toContain("이직 고민");
    expect(discoverySignals.seedKeywords.join(" ")).not.toContain("직업운");
  });

  it("preserves an approved auto-setup draft when creating a product", () => {
    const setup = buildProductAutoSetupDraft({
      productName: "InvoiceFlow",
      slug: "invoiceflow",
      oneLineDescription: "견적서 작성 시간을 줄이는 프리랜서 도구",
      targetCustomer: "1인 프리랜서",
      offerPromise: "견적서를 5분 안에 보내게 한다",
      landingUrl: "https://invoiceflow.app",
    }, { now: "2026-06-04T00:00:00.000Z" });

    const config = buildCreateProductConfig(setup.config, "InvoiceFlow", "invoiceflow");

    expect(config.systemPrompt).toContain("InvoiceFlow");
    expect(config.topics.length).toBeGreaterThan(0);
    expect(config.targets).toContain("1인 프리랜서");
    expect(config.situations.length).toBeGreaterThan(0);
    expect(config.formulas.length).toBeGreaterThan(0);
    expect(config.activeExperiment.durationDays).toBe(7);
    expect(config.campaigns[0]?.landingUrl).toBe("https://invoiceflow.app");
    expect(config.tiktokVideo.enabled).toBe(false);
  });
});
