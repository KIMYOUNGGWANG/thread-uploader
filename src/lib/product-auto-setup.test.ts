import { describe, expect, it } from "vitest";
import { buildProductAutoSetupDraft } from "@/lib/product-auto-setup";

const FIXED_NOW = "2026-06-04T00:00:00.000Z";

describe("buildProductAutoSetupDraft", () => {
  it("derives a ready product-growth setup from useful product context", () => {
    const draft = buildProductAutoSetupDraft({
      productName: "InvoiceFlow",
      slug: "invoiceflow",
      oneLineDescription: "견적서 작성 시간을 줄이는 프리랜서 도구",
      targetCustomer: "1인 프리랜서",
      offerPromise: "견적서를 5분 안에 보내게 한다",
      landingUrl: "https://invoiceflow.app",
    }, { now: FIXED_NOW });

    expect(draft.readiness.status).toBe("ready");
    expect(draft.readiness.score).toBeGreaterThanOrEqual(80);
    expect(draft.readiness.canStartCampaign).toBe(true);
    expect(draft.config.productProfile.productName).toBe("InvoiceFlow");
    expect(draft.config.productProfile.targetCustomer).toBe("1인 프리랜서");
    expect(draft.config.systemPrompt).toContain("InvoiceFlow");
    expect(draft.config.topics.length).toBeGreaterThan(0);
    expect(draft.config.targets).toContain("1인 프리랜서");
    expect(draft.config.situations.length).toBeGreaterThan(0);
    expect(draft.config.formulas.length).toBeGreaterThan(0);
    expect(draft.config.qualityProfile).toBe("product_growth");
    expect(draft.config.activeCampaignId).toBe("product_growth_baseline");
    expect(draft.config.campaigns[0]?.qualityProfile).toBe("product_growth");
    expect(draft.config.campaigns[0]?.landingUrl).toBe("https://invoiceflow.app");
    expect(draft.config.activeExperiment.durationDays).toBe(7);
    expect(draft.config.activeExperiment.startedAt).toBe(FIXED_NOW);
    expect(draft.config.tiktokVideo.enabled).toBe(false);
  });

  it("keeps campaign start blocked and returns gaps for insufficient context", () => {
    const draft = buildProductAutoSetupDraft({
      productName: "InvoiceFlow",
      slug: "invoiceflow",
    }, { now: FIXED_NOW });

    expect(draft.readiness.status).toBe("needs_input");
    expect(draft.readiness.score).toBeLessThan(80);
    expect(draft.readiness.canStartCampaign).toBe(false);
    expect(draft.readiness.gaps.map((gap) => gap.field)).toEqual([
      "oneLineDescription",
      "targetCustomer",
      "offerPromise",
      "landingUrl",
    ]);
    expect(draft.config.campaigns[0]?.qualityProfile).toBe("product_growth");
    expect(draft.config.topics).toHaveLength(0);
  });

  it("treats malformed landing URLs as not ready", () => {
    const draft = buildProductAutoSetupDraft({
      productName: "InvoiceFlow",
      slug: "invoiceflow",
      oneLineDescription: "견적서 작성 시간을 줄이는 프리랜서 도구",
      targetCustomer: "1인 프리랜서",
      offerPromise: "견적서를 5분 안에 보내게 한다",
      landingUrl: "not-a-url",
    }, { now: FIXED_NOW });

    expect(draft.readiness.status).toBe("needs_input");
    expect(draft.readiness.score).toBeLessThan(80);
    expect(draft.readiness.canStartCampaign).toBe(false);
    expect(draft.readiness.gaps.map((gap) => gap.field)).toContain("landingUrl");
  });

  it("rejects protocol-relative landing URLs", () => {
    const draft = buildProductAutoSetupDraft({
      productName: "InvoiceFlow",
      slug: "invoiceflow",
      oneLineDescription: "견적서 작성 시간을 줄이는 프리랜서 도구",
      targetCustomer: "1인 프리랜서",
      offerPromise: "견적서를 5분 안에 보내게 한다",
      landingUrl: "//invoiceflow.app",
    }, { now: FIXED_NOW });

    expect(draft.readiness.status).toBe("needs_input");
    expect(draft.readiness.canStartCampaign).toBe(false);
    expect(draft.readiness.gaps.map((gap) => gap.field)).toContain("landingUrl");
  });
});
