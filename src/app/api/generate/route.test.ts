import { describe, expect, it } from "vitest";
import {
  buildCampaignUtmLink,
  buildGenerationPrompt,
  validateGenerationReadiness,
} from "@/app/api/generate/route";
import { getActiveCampaign, parseBrandConfig, PRODUCT_GROWTH_BASELINE } from "@/types/brand";
import type { QualityProfileId } from "@/types/brand";

describe("buildGenerationPrompt", () => {
  it("includes product profile and active experiment context", () => {
    const config = parseBrandConfig(JSON.stringify({
      productProfile: {
        productName: "InvoiceFlow",
        oneLineDescription: "견적서 작성 시간을 줄이는 프리랜서 도구",
        targetCustomer: "1인 프리랜서",
        offerPromise: "견적서를 5분 안에 보내게 한다",
        landingUrl: "/invoice",
        primaryChannel: "threads",
        primaryMetric: "views",
        conversionMetric: "signups",
        positioningNotes: "실무 시간을 아껴주는 조용한 생산성 도구",
      },
      activeExperiment: {
        id: "invoice_speed_test",
        name: "Invoice speed test",
        hypothesis: "견적서 시간 절약 메시지가 가입을 만든다",
        stage: "content",
        startedAt: "2026-06-04T00:00:00.000Z",
        durationDays: 7,
        primaryMetric: "views",
        guardrailMetric: "quality_pass_rate",
        status: "active",
      },
    }));
    const qualityProfile: QualityProfileId = "product_growth";
    const experiment = {
      formula: {
        id: "direct_offer",
        name: "Direct offer",
        weight: 1,
        instruction: "제품 문제와 오퍼를 직접 연결한다.",
      },
      topic: "견적서 자동화",
      targetAudience: "1인 프리랜서",
      situation: "견적서를 급하게 보내야 하는 상황",
      hookType: "질문형 훅",
      ctaType: "랜딩 확인",
      qualityProfile,
      campaign: null,
      campaignFormulaId: null,
      shouldLink: true,
    };

    const prompt = buildGenerationPrompt(experiment, config, "growth memory", "viral memory");

    expect(prompt).toContain("제품명: InvoiceFlow");
    expect(prompt).toContain("타깃 고객: 1인 프리랜서");
    expect(prompt).toContain("오퍼 약속: 견적서를 5분 안에 보내게 한다");
    expect(prompt).toContain("핵심 지표: views");
    expect(prompt).toContain("실험명: Invoice speed test");
    expect(prompt).toContain("가설: 견적서 시간 절약 메시지가 가입을 만든다");
    expect(prompt).toContain("가드레일: quality_pass_rate");
  });

  it("does not inject CosmicPath career wedge guidance for product growth campaigns", () => {
    const config = parseBrandConfig(JSON.stringify({
      productProfile: {
        productName: "InvoiceFlow",
        oneLineDescription: "견적서 작성 시간을 줄이는 프리랜서 도구",
        targetCustomer: "1인 프리랜서",
        offerPromise: "견적서를 5분 안에 보내게 한다",
        landingUrl: "/invoice",
        primaryChannel: "threads",
        primaryMetric: "views",
        conversionMetric: "signups",
        positioningNotes: "실무 시간을 아껴주는 조용한 생산성 도구",
      },
      activeExperiment: {
        id: "invoice_speed_test",
        name: "Invoice speed test",
        hypothesis: "견적서 시간 절약 메시지가 가입을 만든다",
        stage: "content",
        startedAt: "2026-06-04T00:00:00.000Z",
        durationDays: 7,
        primaryMetric: "views",
        guardrailMetric: "quality_pass_rate",
        status: "active",
      },
      campaigns: [PRODUCT_GROWTH_BASELINE],
      activeCampaignId: PRODUCT_GROWTH_BASELINE.id,
      qualityProfile: "product_growth",
    }));
    const qualityProfile: QualityProfileId = "product_growth";
    const experiment = {
      formula: PRODUCT_GROWTH_BASELINE.formulas[0],
      topic: "견적서 자동화",
      targetAudience: "1인 프리랜서",
      situation: "견적서를 급하게 보내야 하는 상황",
      hookType: "질문형 훅",
      ctaType: "랜딩 확인",
      qualityProfile,
      campaign: PRODUCT_GROWTH_BASELINE,
      campaignFormulaId: PRODUCT_GROWTH_BASELINE.formulas[0].id,
      shouldLink: true,
    };

    const prompt = buildGenerationPrompt(experiment, config, "growth memory", "viral memory");

    expect(prompt).toContain("[제품 성장 필수 조건]");
    expect(prompt).toContain("제품명: InvoiceFlow");
    expect(prompt).not.toContain("[커리어 wedge 필수 조건]");
    expect(prompt).not.toContain("CosmicPath");
    expect(prompt).not.toContain("이직/퇴사");
  });

  it("reports missing formula, prompt, and topic readiness errors before generation", () => {
    const readyProductConfig = parseBrandConfig(JSON.stringify({
      systemPrompt: "Write concise product posts.",
      topics: ["견적서 자동화"],
      campaigns: [PRODUCT_GROWTH_BASELINE],
      activeCampaignId: PRODUCT_GROWTH_BASELINE.id,
      qualityProfile: "product_growth",
    }));
    const noFormulaConfig = {
      ...readyProductConfig,
      formulas: [],
      campaigns: [],
      activeCampaignId: "",
    };
    const noPromptConfig = parseBrandConfig(JSON.stringify({
      systemPrompt: "",
      topics: ["견적서 자동화"],
      campaigns: [PRODUCT_GROWTH_BASELINE],
      activeCampaignId: PRODUCT_GROWTH_BASELINE.id,
      qualityProfile: "product_growth",
    }));
    const noTopicsConfig = parseBrandConfig(JSON.stringify({
      systemPrompt: "Write concise product posts.",
      topics: [],
      trendingTopics: [],
      campaigns: [PRODUCT_GROWTH_BASELINE],
      activeCampaignId: PRODUCT_GROWTH_BASELINE.id,
      qualityProfile: "product_growth",
    }));

    expect(validateGenerationReadiness(noFormulaConfig, null)).toContain("공식이 설정되지 않았습니다");
    expect(validateGenerationReadiness(noPromptConfig, getActiveCampaign(noPromptConfig))).toContain("시스템 프롬프트");
    expect(validateGenerationReadiness(noTopicsConfig, getActiveCampaign(noTopicsConfig))).toContain("토픽이 없습니다");
  });

  it("requires approval and complete product setup before product-growth generation", () => {
    const productCampaign = {
      ...PRODUCT_GROWTH_BASELINE,
      landingUrl: "https://invoiceflow.app",
      utmCampaign: "invoiceflow",
    };
    const completeConfig = parseBrandConfig(JSON.stringify({
      systemPrompt: "Write concise product posts.",
      topics: ["견적서 자동화"],
      campaigns: [productCampaign],
      activeCampaignId: productCampaign.id,
      qualityProfile: "product_growth",
      productProfile: {
        productName: "InvoiceFlow",
        oneLineDescription: "견적서 작성 시간을 줄이는 프리랜서 도구",
        targetCustomer: "1인 프리랜서",
        offerPromise: "견적서를 5분 안에 보내게 한다",
        landingUrl: "https://invoiceflow.app",
        primaryChannel: "threads",
        primaryMetric: "views",
        conversionMetric: "signups",
        positioningNotes: "",
      },
      activeExperiment: {
        id: "invoiceflow",
        name: "InvoiceFlow 7-day evidence sprint",
        hypothesis: "1인 프리랜서가 견적서 자동화 메시지에 반응한다",
        stage: "content",
        startedAt: "2026-06-04T00:00:00.000Z",
        durationDays: 7,
        primaryMetric: "views",
        guardrailMetric: "quality_pass_rate",
        status: "active",
      },
    }));
    const activeCampaign = getActiveCampaign(completeConfig);

    expect(validateGenerationReadiness(completeConfig, activeCampaign)).toContain("캠페인 시작 승인");
    expect(validateGenerationReadiness(completeConfig, activeCampaign, {}, true)).toBeNull();

    const malformedConfig = parseBrandConfig(JSON.stringify({
      ...completeConfig,
      productProfile: {
        ...completeConfig.productProfile,
        landingUrl: "not-a-url",
      },
    }));

    expect(validateGenerationReadiness(malformedConfig, getActiveCampaign(malformedConfig), {}, true)).toContain("랜딩 URL");
  });

  it("preserves campaign UTM source, campaign, and post content values", () => {
    const campaign = {
      ...PRODUCT_GROWTH_BASELINE,
      landingUrl: "/invoice",
      utmCampaign: "invoice_speed_test",
    };

    const link = buildCampaignUtmLink("invoiceflow.app", campaign, "post_123");

    expect(link?.utmContent).toBe("post_123");
    expect(link?.url).toBe("https://invoiceflow.app/invoice?utm_source=threads&utm_campaign=invoice_speed_test&utm_content=post_123");
  });
});
