import { describe, expect, it } from "vitest";
import {
  buildCampaignUtmLink,
  cleanGeneratedContentLabels,
  buildGenerationPrompt,
  enforceGeneratedSurfaceSafety,
  selectCampaignFormulaForViralMode,
  validateGenerationReadiness,
} from "@/app/api/generate/route";
import { selectViralIntentMode } from "@/lib/viral-intent-modes";
import {
  CAREER_TIMING_WEDGE_399,
  getActiveCampaign,
  parseBrandConfig,
  PRODUCT_GROWTH_BASELINE,
} from "@/types/brand";
import type { QualityProfileId } from "@/types/brand";
import type { QualityResult } from "@/lib/quality-gate";

describe("buildGenerationPrompt", () => {
  it("removes model output labels from generated content", () => {
    expect(cleanGeneratedContentLabels("**[본문]**\n\n이직할지 버틸지 모르겠다면")).toBe("이직할지 버틸지 모르겠다면");
    expect(cleanGeneratedContentLabels("**본문:**\n퇴사 고민이라면")).toBe("퇴사 고민이라면");
  });

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
      angleVariation: "오해 깨기",
      structureVariation: "질문으로 시작",
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
      angleVariation: "오해 깨기",
      structureVariation: "질문으로 시작",
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

  it("includes viral mode and success metric in generation prompt", () => {
    const config = parseBrandConfig(JSON.stringify({
      systemPrompt: "Write concise CosmicPath posts.",
      topics: ["연락 타이밍"],
      campaigns: [CAREER_TIMING_WEDGE_399],
      activeCampaignId: CAREER_TIMING_WEDGE_399.id,
      qualityProfile: "career_decision",
    }));
    const qualityProfile: QualityProfileId = "career_decision";
    const experiment = {
      formula: CAREER_TIMING_WEDGE_399.formulas[0],
      topic: "연락 타이밍",
      targetAudience: "연락을 고민하는 사람",
      situation: "답장을 보낼지 망설이는 상황",
      hookType: "질문형 훅",
      ctaType: "셀프체크",
      angleVariation: "A/B/C 분류",
      structureVariation: "체크박스형",
      qualityProfile,
      campaign: CAREER_TIMING_WEDGE_399,
      campaignFormulaId: CAREER_TIMING_WEDGE_399.formulas[0].id,
      shouldLink: false,
    };

    const prompt = buildGenerationPrompt(experiment, config, "growth memory", "viral memory");

    expect(prompt).toContain("[바이럴 의도 모드]");
    expect(prompt).toContain("self_classification");
    expect(prompt).toContain("성공 지표: saves");
    expect(prompt).toContain("댓글을 요구하지 않고");
  });

  it("bans reply-dependent CTA in every generation prompt", () => {
    const config = parseBrandConfig(JSON.stringify({
      systemPrompt: "Write concise CosmicPath posts.",
      topics: ["이직 타이밍"],
      campaigns: [CAREER_TIMING_WEDGE_399],
      activeCampaignId: CAREER_TIMING_WEDGE_399.id,
      qualityProfile: "career_decision",
    }));
    const qualityProfile: QualityProfileId = "career_decision";
    const experiment = {
      formula: CAREER_TIMING_WEDGE_399.formulas[0],
      topic: "이직 타이밍",
      targetAudience: "이직을 고민하는 사람",
      situation: "퇴사와 이직 사이에서 흔들리는 상황",
      hookType: "체크리스트형 훅",
      ctaType: "셀프체크",
      angleVariation: "A/B/C 분류",
      structureVariation: "번호 3개",
      qualityProfile,
      campaign: CAREER_TIMING_WEDGE_399,
      campaignFormulaId: CAREER_TIMING_WEDGE_399.formulas[0].id,
      shouldLink: false,
    };

    const prompt = buildGenerationPrompt(experiment, config, "growth memory", "viral memory");

    expect(prompt).toContain("개인 질문 접수, 답글 약속, 무료 풀이 약속 금지");
    expect(prompt).toContain("장문 사연 요청 금지");
    expect(prompt).toContain("개인별 검토를 암시하는 CTA 금지");
    expect(prompt).toContain("'댓글', '남겨', '답글', '상황 써줘', '같이 보자', '같이 봐요', '뭐가 걸렸어', '어디였어' 표현 금지");
    expect(prompt).toContain("글자 수 확인, 자수 체크, 초안, Threads 본문 같은 메타 텍스트를 절대 출력하지 않는다");
    expect(prompt).not.toContain("상황을 쓰면 분류해준다");
  });

  it("rejects generated meta text in the first comment before qualityPass storage", () => {
    const passingResult: QualityResult = {
      pass: true,
      score: 4,
      profile: "career_decision",
      reasons: [],
      careerDecisionType: "stay",
    };

    const result = enforceGeneratedSurfaceSafety(passingResult, {
      post: "이직 타이밍이 헷갈리면 A. 버팀형 B. 이동형 C. 준비형 중 가까운 쪽만 체크해.",
      firstComment: "Threads 본문\n자수 체크: 500자 이하 통과",
    });

    expect(result.pass).toBe(false);
    expect(result.reasons).toContain("generated meta text 포함");
  });

  it("keeps quiet contrarian prompts free of question-intake closing instructions", () => {
    const config = parseBrandConfig(JSON.stringify({
      systemPrompt: "Write concise CosmicPath posts.",
      topics: ["이직 타이밍"],
      campaigns: [CAREER_TIMING_WEDGE_399],
      activeCampaignId: CAREER_TIMING_WEDGE_399.id,
      qualityProfile: "career_decision",
    }));
    const qualityProfile: QualityProfileId = "career_decision";
    const quietMode = selectViralIntentMode(14);
    const experiment = {
      formula: {
        id: "quiet_contrarian",
        name: "조용한 반전형",
        weight: 2,
        instruction: "흔한 믿음을 차분하게 뒤집는다.",
      },
      topic: "이직 타이밍",
      targetAudience: "이직을 고민하는 사람",
      situation: "퇴사와 이직 사이에서 흔들리는 상황",
      hookType: "반전형 훅",
      ctaType: "저장 유도",
      qualityProfile,
      campaign: CAREER_TIMING_WEDGE_399,
      campaignFormulaId: quietMode.id,
      viralIntentMode: quietMode,
      shouldLink: false,
    };

    const prompt = buildGenerationPrompt(experiment, config, "growth memory", "viral memory");

    expect(quietMode.id).toBe("quiet_contrarian");
    expect(prompt).toContain("마지막은 저장, 프로필 확인, 또는 행동선 정리로 닫는다.");
    expect(prompt).not.toContain("마지막은 질문 접수");
    expect(prompt).not.toContain("질문 접수 또는 행동선");
  });

  it("keeps product and generic no-link campaign prompts free of comment-intake language", () => {
    const productConfig = parseBrandConfig(JSON.stringify({
      systemPrompt: "Write concise product posts.",
      topics: ["견적서 자동화"],
      campaigns: [PRODUCT_GROWTH_BASELINE],
      activeCampaignId: PRODUCT_GROWTH_BASELINE.id,
      qualityProfile: "product_growth",
    }));
    const productQualityProfile: QualityProfileId = "product_growth";
    const productExperiment = {
      formula: PRODUCT_GROWTH_BASELINE.formulas[0],
      topic: "견적서 자동화",
      targetAudience: "1인 프리랜서",
      situation: "견적서를 급하게 보내야 하는 상황",
      hookType: "질문형 훅",
      ctaType: "저장 유도",
      qualityProfile: productQualityProfile,
      campaign: PRODUCT_GROWTH_BASELINE,
      campaignFormulaId: PRODUCT_GROWTH_BASELINE.formulas[0].id,
      shouldLink: false,
    };
    const genericCampaign = {
      ...PRODUCT_GROWTH_BASELINE,
      id: "generic_campaign",
      name: "Generic campaign",
      qualityProfile: "saju_viral" as QualityProfileId,
    };
    const genericQualityProfile: QualityProfileId = "saju_viral";
    const genericExperiment = {
      ...productExperiment,
      qualityProfile: genericQualityProfile,
      campaign: genericCampaign,
      campaignFormulaId: genericCampaign.formulas[0]?.id ?? "direct_offer",
    };

    const productPrompt = buildGenerationPrompt(productExperiment, productConfig, "growth memory", "viral memory");
    const genericPrompt = buildGenerationPrompt(genericExperiment, productConfig, "growth memory", "viral memory");

    expect(productPrompt).toContain("이번 글은 링크 없이 저장/공유/프로필 방문만 유도");
    expect(genericPrompt).toContain("이번 글은 링크 없이 저장/공유/프로필 방문만 유도");
    expect(productPrompt).not.toContain("댓글/프로필 방문");
    expect(genericPrompt).not.toContain("댓글/프로필 방문");
  });

  it("keeps persisted campaign formula ids aligned with the 28-post viral mode matrix", () => {
    const counts = Array.from({ length: 28 }, (_, index) => {
      const viralIntentMode = selectViralIntentMode(index);
      return selectCampaignFormulaForViralMode(CAREER_TIMING_WEDGE_399.formulas, viralIntentMode).id;
    }).reduce<Record<string, number>>((result, formulaId) => {
      result[formulaId] = (result[formulaId] ?? 0) + 1;
      return result;
    }, {});

    expect(counts).toEqual({
      self_classification: 7,
      saveable_tool: 7,
      quiet_contrarian: 7,
      friend_share: 7,
    });
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
