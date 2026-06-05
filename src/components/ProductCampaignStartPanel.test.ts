import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProductCampaignStartPanel } from "@/components/ProductCampaignStartPanel";
import { PRODUCT_GROWTH_BASELINE } from "@/types/brand";
import type { ActiveExperiment, BrandFormula, ProductProfile } from "@/types/brand";

const readyProfile: ProductProfile = {
  productName: "InvoiceFlow",
  oneLineDescription: "견적서 작성 시간을 줄이는 프리랜서 도구",
  targetCustomer: "1인 프리랜서",
  offerPromise: "견적서를 5분 안에 보내게 한다",
  landingUrl: "https://invoiceflow.app",
  primaryChannel: "threads",
  primaryMetric: "views",
  conversionMetric: "signups",
  positioningNotes: "",
};

const readyExperiment: ActiveExperiment = {
  id: "invoiceflow",
  name: "InvoiceFlow 7-day evidence sprint",
  hypothesis: "1인 프리랜서가 견적서 자동화 메시지에 반응한다",
  stage: "content",
  startedAt: "2026-06-04T00:00:00.000Z",
  durationDays: 7,
  primaryMetric: "views",
  guardrailMetric: "quality_pass_rate",
  status: "active",
};

const formulas: BrandFormula[] = [{
  id: "product_problem_diagnosis",
  name: "고객 문제 진단형",
  weight: 3,
  instruction: "문제와 오퍼를 연결한다.",
}];

describe("ProductCampaignStartPanel", () => {
  it("renders an enabled start button when product setup is ready", () => {
    const markup = renderToStaticMarkup(React.createElement(ProductCampaignStartPanel, {
      brandId: "brand_1",
      productProfile: readyProfile,
      activeExperiment: readyExperiment,
      systemPrompt: "Write product posts.",
      topics: ["견적서 자동화"],
      formulas,
      campaigns: [{ ...PRODUCT_GROWTH_BASELINE, landingUrl: "https://invoiceflow.app" }],
      activeCampaignId: PRODUCT_GROWTH_BASELINE.id,
      readinessLabel: "세팅 준비도",
      startLabel: "7일 캠페인 시작",
    }));

    expect(markup).toContain("7일 캠페인 시작");
    expect(markup).toContain("저장된 설정 기준으로 캠페인을 시작할 수 있습니다.");
    expect(markup).not.toContain("disabled=");
  });

  it("renders a disabled start button when landing URL is malformed", () => {
    const markup = renderToStaticMarkup(React.createElement(ProductCampaignStartPanel, {
      brandId: "brand_1",
      productProfile: { ...readyProfile, landingUrl: "not-a-url" },
      activeExperiment: readyExperiment,
      systemPrompt: "Write product posts.",
      topics: ["견적서 자동화"],
      formulas,
      campaigns: [{ ...PRODUCT_GROWTH_BASELINE, landingUrl: "not-a-url" }],
      activeCampaignId: PRODUCT_GROWTH_BASELINE.id,
      readinessLabel: "세팅 준비도",
      startLabel: "7일 캠페인 시작",
    }));

    expect(markup).toContain("랜딩 URL 형식이 필요합니다.");
    expect(markup).toContain("disabled=");
  });

  it("renders a disabled start button when campaign landing URL is blank", () => {
    const markup = renderToStaticMarkup(React.createElement(ProductCampaignStartPanel, {
      brandId: "brand_1",
      productProfile: readyProfile,
      activeExperiment: readyExperiment,
      systemPrompt: "Write product posts.",
      topics: ["견적서 자동화"],
      formulas,
      campaigns: [{ ...PRODUCT_GROWTH_BASELINE, landingUrl: "" }],
      activeCampaignId: PRODUCT_GROWTH_BASELINE.id,
      readinessLabel: "세팅 준비도",
      startLabel: "7일 캠페인 시작",
    }));

    expect(markup).toContain("캠페인 랜딩 URL이 필요합니다.");
    expect(markup).toContain("disabled=");
  });
});
