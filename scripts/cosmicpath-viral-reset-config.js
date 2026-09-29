const CAMPAIGN_ID = "cosmicpath_viral_reset_v1";

const FORMULAS = [
  {
    id: "imagination_dilemma",
    name: "초저마찰 3지선다 딜레마",
    weight: 4,
    instruction: "상상 가능한 현실 딜레마를 열고 번호 1/2/3 중 하나를 즉시 고르게 한다.",
  },
  {
    id: "concept_hierarchy",
    name: "개념 서열 비교",
    weight: 4,
    instruction: "A보다 센 B보다 센 C 구조로 사주 개념의 서열을 두 단계 이상 비교한다.",
  },
  {
    id: "identity_profile",
    name: "기질 프로파일링",
    weight: 4,
    instruction: "구체적인 살, 일주, 글자를 첫 줄에 호명하고 강점과 맹점을 함께 짚는다.",
  },
  {
    id: "relationship_tension",
    name: "관계 궁합 텐션",
    weight: 3,
    instruction: "관계 키워드와 선명한 대비를 사용해 놓치면 안 되는 궁합과 피할 궁합을 비교한다.",
  },
];

function buildCosmicPathViralResetConfig(config, options = {}) {
  const campaigns = Array.isArray(config.campaigns) ? config.campaigns : [];
  const campaign = buildCampaign(config);
  const nextCampaigns = campaigns.some((item) => item && item.id === CAMPAIGN_ID)
    ? campaigns.map((item) => item && item.id === CAMPAIGN_ID ? campaign : item)
    : [...campaigns, campaign];

  return {
    ...config,
    qualityProfile: "saju_viral",
    campaigns: nextCampaigns,
    activeCampaignId: CAMPAIGN_ID,
    activeExperiment: {
      ...(isRecord(config.activeExperiment) ? config.activeExperiment : {}),
      id: CAMPAIGN_ID,
      name: "CosmicPath Viral Reset v1",
      hypothesis: "4:4:4:3 바이럴 구조와 5/15 링크 대조군이 조회 도달과 전환의 차이를 설명한다.",
      stage: "content",
      startedAt: options.startedAt ?? new Date().toISOString(),
      durationDays: 5,
      primaryMetric: "views",
      guardrailMetric: "quality_pass_rate",
      status: "active",
    },
  };
}

function buildCampaign(config) {
  const productProfile = isRecord(config.productProfile) ? config.productProfile : {};
  const landingUrl = text(productProfile.landingUrl) || text(config.websiteUrl);

  return {
    id: CAMPAIGN_ID,
    name: "CosmicPath Viral Reset v1",
    mode: "landing-test",
    qualityProfile: "saju_viral",
    landingUrl,
    utmSource: "threads",
    utmCampaign: CAMPAIGN_ID,
    utmContentTemplate: "{{postId}}",
    dailyPostTarget: 3,
    linkCadenceEvery: 3,
    linkPlacement: "firstComment",
    formulas: FORMULAS.map((formula) => ({ ...formula })),
    replyPlaybook: {
      stay: "지금은 결론보다 반복되는 패턴을 먼저 확인해봐.",
      move: "관계와 선택의 충돌 지점을 비교하면 다음 행동이 선명해져.",
      prepare: "저장해두고 같은 신호가 반복되는지 72시간 뒤 다시 확인해봐.",
      cta: "전체 판정 기준은 첫 댓글 링크에서 확인할 수 있어.",
    },
  };
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

module.exports = { CAMPAIGN_ID, buildCosmicPathViralResetConfig };
