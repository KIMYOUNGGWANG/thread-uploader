// 타래로그(네이버 블로그 말투 초안 도구) 제품 프로필·첫 실험 설정.
// setup-taraelog-brand.mjs가 이 값을 DB brandConfig에 넣는다. 실험 근거와 판정 기준은
// docs/experiments/2026-11-04-taraelog-launch-probe.md에 사전 등록돼 있다.

const TARAELOG_SLUG = "taraelog";
const TARAELOG_NAME = "타래로그";
const LANDING_URL = "https://taraelog.taraetool.workers.dev/";
const CAMPAIGN_ID = "taraelog_launch_probe_v1";

// 페이지가 "안 된다"고 밝힌 것들. 글이 이걸 약속하면 랜딩과 말이 어긋난다.
const FORBIDDEN_PROMISES = [
  "상위노출 보장",
  "상위노출 됩니다",
  "네이버 공식",
  "자동 발행",
  "자동으로 발행",
  "임시저장함에 자동으로",
  "사진도 알아서",
  "100% 무료",
];

const SYSTEM_PROMPT = [
  "너는 1인 개발자가 만든 '타래로그'를 Threads에 알리는 운영자다.",
  "타래로그는 내가 예전에 쓴 네이버 블로그 공개 글을 읽고 말투(어미, 인사·맺음말, 문단 길이, 사진 간격)를 정리한 뒤, 그 말투로 새 글 초안을 써 주는 무료 도구다.",
  "사실은 사용자가 적은 메모만 쓰고, 모르는 경험·가격·맛·효과는 [직접 채우기] 빈칸으로 남긴다. 이게 가장 큰 차별점이다.",
  "사용자는 [제목 복사]·[본문 복사]로 네이버 글쓰기에 붙여넣고 저장·발행·사진 첨부는 직접 한다.",
  "가입비·구독은 없지만 글 생성에는 사용자의 구글 Gemini 무료 API 키가 필요하다. 이 조건을 숨기지 않는다.",
  "네이버와 관계없는 개인 도구다. 상위노출을 약속하지 않는다.",
  "블로그를 꾸준히 쓰는 사람이 옆에서 말하듯 반말·짧은 문장으로 쓴다. 지어낸 1인칭 사용 후기나 숫자 성과는 쓰지 않는다.",
].join("\n");

const FORMULAS = [
  {
    id: "quiet_contrarian",
    name: "AI 블로그 글이 티 나는 진짜 이유",
    weight: 3,
    instruction: "'AI 글은 문장이 어색해서 티 난다'는 통념을 차분하게 뒤집는다. 티가 나는 진짜 이유는 남의 말투와 지어낸 경험이라는 점을 짚고, 내 말투와 내가 아는 사실만 쓰면 달라진다는 기준으로 닫는다.",
  },
  {
    id: "saveable_tool",
    name: "내 블로그 말투 점검표",
    weight: 3,
    instruction: "내 블로그 말투를 스스로 점검하는 3-4칸 표를 만든다(자주 쓰는 어미, 첫 인사·맺음말, 문단 길이, 사진 넣는 간격 중 고른다). 저장해 두고 다음 글 쓸 때 꺼내 보게 한다.",
  },
  {
    id: "self_classification",
    name: "블로그 글 막히는 지점 자기분류",
    weight: 2,
    instruction: "블로그 글을 쓸 때 막히는 지점을 A 첫 문단, B 사진 사이 문장, C 마무리·태그 중에서 고르게 한다. 고른 유형마다 바로 해 볼 수 있는 기준 한 줄을 준다.",
  },
  {
    id: "friend_share",
    name: "블로거 옆자리 관찰 썰",
    weight: 2,
    instruction: "체험단·가게 후기를 몰아 쓰는 블로거 지인 옆에서 본 장면(빈 화면, 지난 글 다시 읽기, 말투가 매번 달라지는 고민)을 관찰하듯 묘사한다. 지어낸 1인칭 경험담은 쓰지 않는다.",
  },
];

const PRODUCT_PROFILE = {
  productName: TARAELOG_NAME,
  oneLineDescription: "예전에 쓴 내 네이버 블로그 글을 읽고, 내 말투 그대로 새 글 초안을 써 주는 무료 도구",
  targetCustomer: "네이버 블로그를 꾸준히 쓰는 개인 블로거, 체험단·가게 후기를 자주 쓰는 사람, 여러 블로그를 운영하는 사람",
  offerPromise: "블로그 아이디로 지난 글을 가져와 말투를 정리하고, 주제와 메모만 주면 내 말투 초안을 쓴다. 모르는 사실은 지어내지 않고 빈칸으로 남긴다.",
  landingUrl: LANDING_URL,
  primaryChannel: "threads",
  primaryMetric: "link_clicks",
  conversionMetric: "signups",
  positioningNotes: [
    "차별점: '내 말투'와 '사실은 내가'(모르는 내용은 [직접 채우기] 빈칸). 일반 AI 글쓰기 도구와 비교할 때 이 두 가지로 말한다.",
    "조건을 숨기지 않는다: 가입비·구독 0원, 대신 구글 Gemini 무료 API 키가 필요하다. 저장·발행·사진은 사용자가 직접 한다.",
    "금지: 상위노출 약속, 네이버 공식 서비스처럼 보이는 표현, 자동 발행·자동 임시저장 약속.",
  ].join("\n"),
};

function buildCampaign() {
  return {
    id: CAMPAIGN_ID,
    name: "타래로그 첫 7일 퍼널 탐색",
    mode: "landing-test",
    qualityProfile: "product_growth",
    landingUrl: LANDING_URL,
    utmSource: "threads",
    utmCampaign: CAMPAIGN_ID,
    utmContentTemplate: "{{postId}}",
    // warming 등급의 하루 발행 한도(2)와 맞춘다. 7일이면 약 14편, 그중 링크 글은 약 7편이다.
    dailyPostTarget: 2,
    linkCadenceEvery: 2,
    // 글마다 pid가 붙은 링크가 있어야 클릭·가입을 글 단위로 잴 수 있다. 프로필 링크는 pid를 못 싣는다.
    linkPlacement: "firstComment",
    perPostLinks: true,
    formulas: FORMULAS.map((formula) => ({ ...formula })),
    replyPlaybook: {
      stay: "지금 쓰는 방식이 편하면 그대로 가도 돼. 다만 지난 글 말투를 한 번 정리해 두면 다음 글이 덜 흔들려.",
      move: "말투 맞추느라 지난 글 다시 읽는 시간이 길다면, 그 부분은 도구한테 넘겨도 돼.",
      prepare: "바로 쓰기 부담되면 최근 글 5편만 골라서 어미랑 맺음말부터 적어 봐.",
      cta: "내 말투로 초안 써 보는 건 첫 댓글 링크에서 무료로 돼. 구글 Gemini 무료 키만 있으면 돼.",
    },
  };
}

function buildActiveExperiment(startedAt, status) {
  return {
    id: CAMPAIGN_ID,
    name: "타래로그 첫 7일 퍼널 탐색",
    hypothesis: "네이버 블로거에게 '내 말투 + 지어내지 않음' 메시지는 링크 클릭을 만들지만, 클릭 대비 가입은 가입·Gemini 키 단계에서 막힌다.",
    stage: "content",
    startedAt,
    durationDays: 7,
    primaryMetric: "link_clicks",
    guardrailMetric: "quality_pass_rate",
    status,
  };
}

// 기존 brandConfig(새 브랜드면 {})에 타래로그 설정을 덮어쓴다. 저장돼 있던 다른 캠페인과 모르는 키는 그대로 둔다.
// 실험은 startedAt이 있어야 active다. Threads 계정을 연결하기 전에는 시작 시각 없이 paused로 둔다.
function buildTaraelogBrandConfig(config = {}, options = {}) {
  const current = isRecord(config) ? config : {};
  const startedAt = typeof options.startedAt === "string" ? options.startedAt : "";
  const campaign = buildCampaign();
  const campaigns = Array.isArray(current.campaigns) ? current.campaigns : [];
  const nextCampaigns = campaigns.some((item) => isRecord(item) && item.id === CAMPAIGN_ID)
    ? campaigns.map((item) => (isRecord(item) && item.id === CAMPAIGN_ID ? campaign : item))
    : [...campaigns, campaign];
  const currentViral = isRecord(current.viralDiscovery) ? current.viralDiscovery : {};

  return {
    ...current,
    systemPrompt: SYSTEM_PROMPT,
    websiteUrl: LANDING_URL,
    topics: [
      "지난 글과 말투가 달라지는 블로그 글",
      "AI로 쓴 블로그 글이 티 나는 이유",
      "체험단·가게 후기를 몰아서 쓸 때 막히는 지점",
      "블로그 글 첫 문단과 맺음말 습관",
      "사진 사이에 넣을 문장이 안 떠오를 때",
      "모르는 정보를 지어내지 않고 초안 쓰기",
      "여러 블로그를 운영할 때 말투 관리",
    ],
    targets: [
      "네이버 블로그를 꾸준히 쓰는 직장인",
      "체험단·협찬 후기를 자주 쓰는 블로거",
      "가게·상품 소개 글을 직접 쓰는 자영업자",
      "블로그를 두 개 이상 운영하는 사람",
    ],
    situations: [
      "후기 마감이 몰려서 글 세 편을 하루에 써야 할 때",
      "AI로 쓴 초안이 내 블로그 글 같지 않을 때",
      "지난 글을 다시 읽으며 말투를 맞추느라 시간이 걸릴 때",
      "사진은 다 찍었는데 본문 첫 줄이 안 써질 때",
    ],
    viralDiscovery: {
      ...currentViral,
      keywords: ["네이버 블로그", "블로그 글쓰기", "블로그 체험단", "블로그 말투", "AI 블로그 글"],
      excludedTerms: ["상위노출 대행", "블로그 대여", "블로그 매입"],
    },
    voiceProfile: {
      tone: "conversational",
      perspective: "블로그를 꾸준히 쓰는 운영자가 옆에서 말하는 시점",
      sentenceLength: "short_punchy",
      paragraphStyle: "single_line_breath",
      admissionStyle: "되는 것과 안 되는 것을 같이 말한다",
      forbiddenPhrases: [...FORBIDDEN_PROMISES],
    },
    threadsTopicTag: "블로그",
    qualityProfile: "product_growth",
    productProfile: { ...PRODUCT_PROFILE },
    campaigns: nextCampaigns,
    activeCampaignId: CAMPAIGN_ID,
    activeExperiment: buildActiveExperiment(startedAt, startedAt ? "active" : "paused"),
    // 새 Threads 계정 기준. newbie(하루 1편)는 7일에 7편뿐이라 판단 근거가 너무 적고,
    // established(하루 5편)는 새 계정에 과하다. 발행 cron은 이 값으로 하루 한도를 정한다.
    accountTrustTier: options.accountTrustTier ?? "warming",
  };
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

module.exports = {
  TARAELOG_SLUG,
  TARAELOG_NAME,
  LANDING_URL,
  CAMPAIGN_ID,
  FORBIDDEN_PROMISES,
  buildTaraelogBrandConfig,
};
