import { describe, expect, it } from "vitest";
import {
  CAREER_TIMING_WEDGE_399,
  getActiveCampaign,
  parseBrandConfig,
  PRODUCT_GROWTH_BASELINE,
} from "@/types/brand";

describe("parseBrandConfig", () => {
  it("preserves existing campaign quality profile and TikTok defaults", () => {
    const rawConfig = "{}";

    const config = parseBrandConfig(rawConfig);

    expect(config.campaigns).toHaveLength(1);
    expect(config.campaigns.at(0)?.id).toBe(CAREER_TIMING_WEDGE_399.id);
    expect(config.activeCampaignId).toBe(CAREER_TIMING_WEDGE_399.id);
    expect(config.qualityProfile).toBe("career_decision");
    expect(config.tiktokVideo.parentCampaignId).toBe(CAREER_TIMING_WEDGE_399.id);
    expect(config.tiktokVideo.qualityProfile).toBe("tiktok_career_timing");
  });

  it("normalizes empty config to product profile and active experiment", () => {
    const config = parseBrandConfig("{}");

    expect(config.productProfile.productName).toBe("Untitled Product");
    expect(config.productProfile.primaryChannel).toBe("threads");
    expect(config.productProfile.primaryMetric).toBe("views");
    expect(config.productProfile.conversionMetric).toBe("conversions");
    expect(config.activeExperiment.id).toBe("baseline_growth_loop");
    expect(config.activeExperiment.status).toBe("active");
  });

  it("normalizes malformed product profile safely", () => {
    const rawConfig = JSON.stringify({
      productProfile: {
        productName: "",
        oneLineDescription: 42,
        primaryMetric: "",
      },
      activeExperiment: {
        id: "",
        durationDays: -20,
        status: "paused",
      },
    });

    const config = parseBrandConfig(rawConfig);

    expect(config.productProfile.productName).toBe("Untitled Product");
    expect(config.productProfile.oneLineDescription).toBe("");
    expect(config.productProfile.primaryMetric).toBe("views");
    expect(config.activeExperiment.id).toBe("baseline_growth_loop");
    expect(config.activeExperiment.durationDays).toBe(7);
    expect(config.activeExperiment.status).toBe("paused");
  });

  it("returns null for an explicitly missing campaign", () => {
    const config = parseBrandConfig("{}");

    expect(getActiveCampaign(config, "missing_campaign")).toBeNull();
    expect(getActiveCampaign(config)?.id).toBe(CAREER_TIMING_WEDGE_399.id);
  });

  it("preserves disabled TikTok config without career defaults", () => {
    const config = parseBrandConfig(JSON.stringify({
      tiktokVideo: {
        enabled: false,
        parentCampaignId: "product_growth_baseline",
        landingUrl: "",
        formats: [],
      },
    }));

    expect(config.tiktokVideo.enabled).toBe(false);
    expect(config.tiktokVideo.parentCampaignId).toBe("product_growth_baseline");
    expect(config.tiktokVideo.landingUrl).toBe("");
    expect(config.tiktokVideo.formats).toHaveLength(0);
  });

  it("uses the active campaign quality profile when top-level quality profile is missing", () => {
    const config = parseBrandConfig(JSON.stringify({
      campaigns: [{
        id: PRODUCT_GROWTH_BASELINE.id,
        landingUrl: "",
      }],
      activeCampaignId: PRODUCT_GROWTH_BASELINE.id,
    }));

    expect(config.activeCampaignId).toBe(PRODUCT_GROWTH_BASELINE.id);
    expect(config.campaigns[0]?.qualityProfile).toBe("product_growth");
    expect(config.qualityProfile).toBe("product_growth");
  });

  it("normalizes legacy comment diagnosis formulas into low-touch self classification", () => {
    const config = parseBrandConfig(JSON.stringify({
      campaigns: [{
        ...CAREER_TIMING_WEDGE_399,
        formulas: [{
          id: "comment_diagnosis",
          name: "댓글 진단형",
          weight: 3,
          instruction: "댓글에 현재 상황을 쓰면 분류해준다.",
        }],
      }],
      activeCampaignId: CAREER_TIMING_WEDGE_399.id,
    }));

    expect(config.campaigns[0]?.formulas[0]?.id).toBe("self_classification");
    expect(config.campaigns[0]?.formulas[0]?.instruction).toContain("A/B/C");
    expect(config.campaigns[0]?.formulas[0]?.instruction).not.toMatch(/분류해준|답글|진단해준/);
  });

  it("defaults CosmicPath campaign formulas to self classification and saveable tools", () => {
    const formulaIds = CAREER_TIMING_WEDGE_399.formulas.map((formula) => formula.id);
    const formulaText = CAREER_TIMING_WEDGE_399.formulas.map((formula) => formula.instruction).join("\n");

    expect(formulaIds).toContain("self_classification");
    expect(formulaIds).toContain("saveable_tool");
    expect(formulaText).toContain("A/B/C");
    expect(formulaText).toContain("저장");
    expect(formulaText).not.toMatch(/분류해준|상황을 쓰면|답글|진단해준/);
  });

  it("ignores legacy TikTok formats when TikTok is disabled", () => {
    const config = parseBrandConfig(JSON.stringify({
      tiktokVideo: {
        enabled: false,
        parentCampaignId: "product_growth_baseline",
        landingUrl: "",
        formats: [{
          id: "career_timing_diagnosis",
          name: "커리어 타이밍 진단형",
          weight: 3,
          instruction: "legacy career format",
        }],
      },
    }));

    expect(config.tiktokVideo.enabled).toBe(false);
    expect(config.tiktokVideo.parentCampaignId).toBe("product_growth_baseline");
    expect(config.tiktokVideo.landingUrl).toBe("");
    expect(config.tiktokVideo.formats).toHaveLength(0);
  });
});
