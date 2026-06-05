import { describe, expect, it } from "vitest";
import {
  buildAccountDiscoverySignals,
  scoreAccountForDiscovery,
} from "@/lib/account-discovery";
import {
  CAREER_TIMING_WEDGE_399,
  parseBrandConfig,
  PRODUCT_GROWTH_BASELINE,
} from "@/types/brand";

function buildInvoiceFlowConfig() {
  return parseBrandConfig(JSON.stringify({
    topics: ["견적서 자동화"],
    targets: ["1인 프리랜서"],
    situations: ["급하게 견적서를 보내야 하는 상황"],
    productProfile: {
      productName: "InvoiceFlow",
      oneLineDescription: "견적서 작성 시간을 줄이는 프리랜서 도구",
      targetCustomer: "1인 프리랜서",
      offerPromise: "견적서를 5분 안에 보내게 한다",
      landingUrl: "/invoice",
      primaryChannel: "threads",
      primaryMetric: "views",
      conversionMetric: "signups",
      positioningNotes: "반복 견적 업무를 줄이는 생산성 도구",
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
}

describe("account discovery product mode", () => {
  it("builds product seed keywords without hardcoded career or saju terms", () => {
    const signals = buildAccountDiscoverySignals(buildInvoiceFlowConfig());
    const keywords = signals.seedKeywords.join(" ");
    const topics = signals.brandTopics.join(" ");

    expect(signals.mode).toBe("product");
    expect(keywords).toContain("InvoiceFlow");
    expect(keywords).toContain("견적서");
    expect(topics).toContain("1인 프리랜서");
    expect(`${keywords} ${topics}`).not.toContain("이직 고민");
    expect(`${keywords} ${topics}`).not.toContain("퇴사 고민");
    expect(`${keywords} ${topics}`).not.toContain("직업운");
    expect(`${keywords} ${topics}`).not.toContain("사주");
  });

  it("does not boost or categorize career/saju text for generic products", () => {
    const scored = scoreAccountForDiscovery(
      "career_timing_creator",
      [{
        id: "career_post",
        text: "이직 고민과 사주 직업운이 헷갈릴 때 커리어 타이밍을 봅니다.",
      }],
      buildInvoiceFlowConfig(),
      "career_timing_creator"
    );

    expect(scored.score).toBeLessThan(60);
    expect(scored.category).toBe("adjacent");
    expect(scored.reason).not.toContain("커리어 불안 신호");
    expect(scored.reason).not.toContain("사주/타이밍 언어");
  });

  it("scores generic product relevance from product profile and CTA signals", () => {
    const scored = scoreAccountForDiscovery(
      "invoice_operator",
      [{
        id: "invoice_post",
        text: "InvoiceFlow로 프리랜서 견적서 작성 시간을 줄이는 방법. 댓글로 견적 상황을 알려주세요.",
      }],
      buildInvoiceFlowConfig(),
      "InvoiceFlow"
    );

    expect(scored.score).toBeGreaterThanOrEqual(60);
    expect(scored.category).toBe("creator");
    expect(scored.reason).toContain("제품 프로필 겹침");
    expect(scored.reason).toContain("브랜드 토픽 겹침");
  });

  it("preserves CosmicPath career discovery behavior", () => {
    const careerConfig = parseBrandConfig(JSON.stringify({
      campaigns: [CAREER_TIMING_WEDGE_399],
      activeCampaignId: CAREER_TIMING_WEDGE_399.id,
      qualityProfile: "career_decision",
    }));
    const signals = buildAccountDiscoverySignals(careerConfig);
    const scored = scoreAccountForDiscovery(
      "career_oracle",
      [{
        id: "cosmicpath_post",
        text: "이직 고민과 직업운 타이밍이 흔들릴 때 댓글로 상황을 남겨주세요.",
      }],
      careerConfig,
      "이직 고민"
    );

    expect(signals.mode).toBe("career");
    expect(signals.seedKeywords.join(" ")).toContain("이직 고민");
    expect(scored.score).toBeGreaterThanOrEqual(60);
    expect(scored.category).toBe("competitor");
    expect(scored.reason).toContain("커리어 불안 신호");
    expect(scored.reason).toContain("사주/타이밍 언어");
  });
});
