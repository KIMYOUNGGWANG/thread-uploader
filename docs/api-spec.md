# API Spec — Portfolio Growth OS

- **Version**: v2.1 (Internal Product Portfolio Growth)
- **Updated**: 2026-06-04
- **Base URL**: `/api`

---

## Primary Flow & Actors

This is an internal operator workspace for promoting owned products. The API and database still use the legacy `Brand` model and `brandId` parameter, but the user-facing concept is a product profile with an active experiment.

```
[Portfolio Operator]
  → 회원가입/로그인
  → 제품 생성 (legacy Brand row + Threads token 연결)
  → Product Profile 입력
  → Active Experiment 설정 (7-day evidence sprint)
  → product_growth 또는 제품별 quality profile 설정
  → AI Account Discovery로 관련 공개 계정 후보 발견
  → 후보 계정 watch/ignore 승인
  → watched 계정 공개 글 구조 학습
  → 캠페인 콘텐츠 생성 (product context + experiment hypothesis + link cadence)
  → PENDING 큐 확인
  → [Cron] 각 제품 FIFO 자동 발행
  → 참여 유형별 안내 플레이북으로 수동 보완
  → UTM/성과/수동 전환 입력
  → 캠페인 성과 학습 및 Portfolio Overview next action 갱신
  → 다음 제품 또는 다음 실험으로 이동
```

---

## Authentication

- **Method**: email + password → httpOnly 쿠키 세션 (`auth_session` 쿠키에 userId 저장)
- **scrypt**: 비밀번호 해싱 (`crypto.scrypt`, per-user salt)
- **Cron 예외**: `Authorization: Bearer <CRON_SECRET>` 헤더 or `?secret=` 쿼리

### Auth Endpoints

| Method | Path | Description |
|:-------|:-----|:------------|
| `POST` | `/api/auth/register` | 신규 유저 등록 |
| `POST` | `/api/auth/login` | 로그인 → 쿠키 발급 |
| `POST` | `/api/auth/logout` | 쿠키 삭제 |
| `GET` | `/api/auth/me` | 현재 유저 정보 |

```typescript
// POST /api/auth/register
interface RegisterRequest {
  email: string;
  password: string; // min 8자
  name?: string;
}
interface RegisterResponse {
  success: true;
  userId: string;
}

// POST /api/auth/login
interface LoginRequest {
  email: string;
  password: string;
}
interface LoginResponse {
  success: true;
  user: { id: string; email: string; name: string | null };
}

// GET /api/auth/me
interface MeResponse {
  id: string;
  email: string;
  name: string | null;
}
```

---

## Product API (Legacy Brand Endpoints)

| Method | Path | Description | Auth |
|:-------|:-----|:------------|:-----|
| `GET` | `/api/brands` | 내 제품 목록 | Required |
| `POST` | `/api/brands` | 제품 생성 | Required |
| `GET` | `/api/brands/[id]` | 제품 상세 | Required + Owner |
| `PATCH` | `/api/brands/[id]` | 제품 수정 | Required + Owner |
| `DELETE` | `/api/brands/[id]` | 제품 삭제 | Required + Owner |

```typescript
type ProductPrimaryChannel = "threads" | "tiktok" | "manual";
type ExperimentStage = "content" | "landing" | "conversion";
type ExperimentStatus = "active" | "paused" | "completed";

interface ProductProfile {
  productName: string;
  oneLineDescription: string;
  targetCustomer: string;
  offerPromise: string;
  landingUrl: string;
  positioningNotes: string;
  primaryChannel: ProductPrimaryChannel;
  primaryMetric: string;
  conversionMetric: string;
}

interface ActiveExperiment {
  id: string;
  name: string;
  hypothesis: string;
  stage: ExperimentStage;
  startedAt: string;
  durationDays: number;
  primaryMetric: string;
  guardrailMetric: string;
  status: ExperimentStatus;
}

interface BrandConfig {
  systemPrompt: string;         // AI 생성 시스템 프롬프트
  topics: string[];             // 콘텐츠 주제 목록
  targets: string[];            // 타겟 독자 목록
  situations: string[];         // 상황/맥락 목록
  websiteUrl: string;           // UTM 링크 베이스 URL
  formulas: Array<{             // 콘텐츠 공식
    id: string;
    name: string;
    weight: number;
    instruction: string;
  }>;
  hookTypes?: string[];          // 실험할 첫 문장/각도 유형
  ctaTypes?: string[];           // 실험할 CTA 유형
  qualityRules?: {              // 품질 게이트 설정 (선택)
    minLength?: number;
    requiredTerms?: string[];
  };
  trendingTopics?: string[];
  viralDiscovery?: ViralDiscoveryConfig;
  campaigns?: CampaignConfig[];
  activeCampaignId?: string;
  qualityProfile?: QualityProfileId;
  tiktokVideo?: TikTokVideoConfig;
  productProfile: ProductProfile;
  activeExperiment: ActiveExperiment;
}

type QualityProfileId = "saju_viral" | "career_decision" | "product_growth";
type CampaignFormulaId = "self_classification" | "saveable_tool" | "quiet_contrarian" | "friend_share";
type CareerDecisionType = "stay" | "move" | "prepare";
type TikTokVideoFormatId =
  | "career_timing_diagnosis"
  | "self_classification"
  | "saveable_tool"
  | "quiet_contrarian"
  | "friend_share"
  | "saju_myth_busting"
  | "landing_teaser";

interface TikTokVideoConfig {
  enabled: boolean;
  parentCampaignId: string;       // default career_timing_wedge_399
  defaultDurationSeconds: number; // default 25
  landingUrl: string;             // /career/uncertainty
  qualityProfile: "tiktok_career_timing";
  formats: Array<{
    id: TikTokVideoFormatId;
    weight: number;
    instruction: string;
  }>;
}

interface CampaignConfig {
  id: string;                     // career_timing_wedge_399
  name: string;
  mode: "viral-content" | "landing-test";
  qualityProfile: QualityProfileId;
  landingUrl: string;             // /career/uncertainty
  utmSource: "threads";
  utmCampaign: string;            // career_timing_wedge_399
  utmContentTemplate: "{{postId}}";
  dailyPostTarget: number;        // default 3
  linkCadenceEvery: number;       // default 3, only 1 linked post per 3
  linkPlacement: "firstComment";
  formulas: Array<{
    id: CampaignFormulaId;
    name: string;
    weight: number;
    instruction: string;
  }>;
  replyPlaybook: {
    stay: string;
    move: string;
    prepare: string;
    cta: string;
  };
}

interface ViralDiscoveryConfig {
  keywords: string[];            // Threads keyword_search 입력
  competitorHandles: string[];   // Threads public profile posts 입력, @ 없이 저장
  excludedTerms: string[];       // 저장 전 제외할 단어/문구
  maxExamplesPerRun: number;     // default 15, hard max 50
  minViralScore: number;         // default 0
  adapters: Array<{
    id: "owned_posts" | "threads_keyword" | "threads_profile" | "manual";
    enabled: boolean;
  }>;
}

interface BrandResponse {
  id: string;
  name: string;
  slug: string;
  threadsUserId: string;
  tokenExpiry: string;
  brandConfig: BrandConfig;
  formulaWeights: Record<string, number>;
  createdAt: string;
  updatedAt: string;
}

// POST /api/brands
interface CreateBrandRequest {
  name: string;
  slug: string;           // URL-safe, unique
  accessToken: string;    // Threads API token
  threadsUserId: string;  // Threads user ID
  tokenExpiry: string;    // ISO datetime
  brandConfig: BrandConfig;
}

// PATCH /api/brands/[id]
interface UpdateBrandRequest {
  name?: string;
  accessToken?: string;
  threadsUserId?: string;
  tokenExpiry?: string;
  brandConfig?: Partial<BrandConfig>;
  formulaWeights?: Record<string, number>;
}
```

`productProfile` and `activeExperiment` are normalized on read/write. Missing or malformed values fall back to safe defaults, so older Brand rows remain readable.

---

## AI Account Discovery API

The account discovery engine finds related public Threads accounts, scores them against the current product profile, and only learns from accounts that the Portfolio Operator explicitly watches.

### Data Contracts

```typescript
type DiscoveredAccountStatus = "candidate" | "watched" | "ignored";
type DiscoveredAccountCategory = "career" | "saju" | "creator" | "competitor" | "adjacent" | "unknown";

interface DiscoveredAccountResponse {
  id: string;
  brandId: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  profileUrl: string | null;
  status: DiscoveredAccountStatus;
  category: DiscoveredAccountCategory;
  relevanceScore: number;
  reason: string;
  source: "keyword_search" | "manual" | "profile_expand";
  sourceKeyword: string | null;
  lastDiscoveredAt: string;
  lastScannedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DiscoveredAccountPostResponse {
  id: string;
  accountId: string;
  sourceKey: string;
  permalink: string | null;
  content: string;
  publishedAt: string | null;
  hookType: string | null;
  topic: string | null;
  emotionalDriver: string | null;
  structureType: string | null;
  ctaType: string | null;
  patternSummary: string | null;
  relevanceScore: number;
  createdAt: string;
}

interface AccountPatternResponse {
  id: string;
  brandId: string;
  accountId: string | null;
  dimension: "hook" | "topic" | "emotion" | "structure" | "cta";
  value: string;
  sourceCount: number;
  confidence: number;
  recommendation: string;
}
```

### Endpoints

| Method | Path | Description |
|:-------|:-----|:------------|
| `GET` | `/api/accounts?brandId=xxx&status=candidate` | 계정 후보/watchlist 조회 |
| `POST` | `/api/accounts/discover` | seed keywords로 관련 계정 후보 발견 |
| `PATCH` | `/api/accounts/[id]` | `watch` 또는 `ignore` 상태 변경 |
| `POST` | `/api/accounts/analyze` | watched 계정 공개 글 수집 및 패턴 학습 |

```typescript
interface DiscoverAccountsRequest {
  brandId: string;
  keywords?: string[];
  handles?: string[];       // @handle or threads.net/@handle seed fallback
  limit?: number;          // default 20, max 50
  minScore?: number;       // default 60
}

interface DiscoverAccountsResponse {
  success: true;
  discovered: number;
  saved: number;
  candidates: DiscoveredAccountResponse[];
  errors: ViralSourceError[];
}

interface UpdateDiscoveredAccountRequest {
  status: "watched" | "ignored" | "candidate";
}

interface AnalyzeAccountsRequest {
  brandId: string;
  accountIds?: string[];   // default all watched accounts
  limit?: number;          // default 10, max 50 posts per account
}

interface AnalyzeAccountsResponse {
  success: true;
  scannedAccounts: number;
  savedPosts: number;
  learnedPatterns: number;
  recommendations: string[];
  errors: ViralSourceError[];
}
```

If Threads `keyword_search` is blocked by Meta app permissions, discovery returns source errors and may find zero keyword candidates. Operators can pass `handles` or configure `viralDiscovery.competitorHandles`; these seed handles are saved as manual candidates so the Brand Owner can choose `watch` or `ignore` before any learning occurs.

### Scoring

Initial MVP scoring is deterministic and explainable:

- target/topic overlap: 30
- product/topic overlap: 25
- domain-specific language from the product profile: 15
- comment/share CTA structure: 15
- brand safety / excluded term check: 15

AI classification may later refine category and reason, but the first implementation should keep the score auditable.

### Guardrails

- Only `watched` accounts can feed recurring account learning.
- `ignored` accounts are excluded from future learning even if rediscovered.
- The system stores public post structure, not private or unauthorized account insights.
- Generation receives account-level patterns as guidance only; it must not copy exact wording from discovered accounts.

---

## Posts API (Per-brand)

모든 포스트 엔드포인트는 `brandId` 쿼리 파라미터 또는 body 필드 필요.

| Method | Path | Description |
|:-------|:-----|:------------|
| `GET` | `/api/posts?brandId=xxx` | 브랜드 포스트 목록 |
| `POST` | `/api/posts` | 포스트 배열 생성 |
| `PATCH` | `/api/posts/[id]` | 포스트 수정 |
| `DELETE` | `/api/posts/[id]` | 포스트 삭제 |
| `DELETE` | `/api/posts/reset?brandId=xxx` | PENDING 전체 삭제 |
| `POST` | `/api/posts/[id]/publish` | 즉시 발행 |

`qualityPass === false` queued posts are review-only and must not be published by `/api/posts/[id]/publish` or cron publish. `POST /api/posts/upload` is a legacy raw Threads upload route outside the product-growth queue; do not use it for quality-gated product experiments until it is guarded separately.

```typescript
// POST /api/posts
interface CreatePostsRequest {
  brandId: string;
  posts: ParsedPost[];
  insertAtFront?: boolean;
}

interface ParsedPost {
  content: string;
  images: string[];
  scheduledAt: string | null;
  firstComment?: string;
}

interface PostResponse {
  id: string;
  brandId: string;
  content: string;
  imageUrls: string[];
  scheduledAt: string;
  status: "PENDING" | "PUBLISHED" | "FAILED";
  threadsId: string | null;
  publishedAt: string | null;
  createdAt: string;
  errorLog: string | null;
  firstComment: string | null;
  formulaId: string | null;
  topic: string | null;
  targetAudience: string | null;
  situation: string | null;
  hookType: string | null;
  ctaType: string | null;
  qualityScore: number | null;
  qualityProfile: QualityProfileId | null;
  qualityPass: boolean | null;
  qualityReasons: string[];
  campaignId: string | null;
  campaignFormulaId: CampaignFormulaId | null;
  careerDecisionType: CareerDecisionType | null;
  linkUrl: string | null;
  utmContent: string | null;
  clicks: number | null;
  conversions: number | null;
  manualPaidConversions: number | null;
  performanceScore: number | null;
  performanceTier: "learning" | "promising" | "strong" | "breakout" | null;
}
```

---

## AI Generate API (Per-brand)

| Method | Path | Description |
|:-------|:-----|:------------|
| `POST` | `/api/generate` | AI 콘텐츠 생성 → PENDING 큐 저장 |
| `POST` | `/api/generate/optimize` | 성과 기반 공식 가중치 최적화 |

```typescript
// POST /api/generate
interface GenerateRequest {
  brandId: string;
  count?: number;         // 1..300, default 30
  insertAtFront?: boolean;
  campaignId?: string;    // default activeCampaignId
}

interface GenerateResponse {
  success: true;
  count: number;
  linkedCount?: number;
  campaignId?: string;
}

// POST /api/generate/optimize
interface OptimizeRequest {
  brandId: string;
}

interface OptimizeResponse {
  success: true;
  analysedPosts: number;
  evaluatedFormulas: number;
  ranking: { formulaId: string; count: number; avgScore: number }[];
  changes: { boosted: string[]; reduced: string[] };
  newWeights: Record<string, number>;
  appliedAt: string;
}
```

---

## Campaign Engine Contract

### Active Campaign

Campaigns are still channel-specific experiments attached to a product profile. The existing CosmicPath career wedge remains a valid preset, but it is no longer the only operating model.

```typescript
const CAREER_TIMING_WEDGE_399: CampaignConfig = {
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
  formulas: [
    {
      id: "self_classification",
      name: "자기분류 셀프체크형",
      weight: 3,
      instruction: "A/B/C 또는 버팀형/이동형/준비형 중 가까운 선택지를 본문 안에서 혼자 체크하게 만든다. 운영자 추가 개입 없이도 참여가 완결되어야 한다.",
    },
    {
      id: "saveable_tool",
      name: "저장형 판단 도구",
      weight: 2,
      instruction: "이직, 퇴사, 번아웃 판단 전에 저장해두고 다시 볼 3-4칸 체크리스트나 판정표로 작성한다.",
    },
    {
      id: "friend_share",
      name: "친구 공유형",
      weight: 2,
      instruction: "이직, 퇴사, 번아웃을 고민하는 친구에게 보내주고 싶게 만드는 공유 유도형 구조로 작성한다.",
    },
  ],
  replyPlaybook: {
    stay: "지금은 옮기기보다 버티면서 조건을 정리할 타이밍으로 보여요.",
    move: "이미 버틸 이유보다 옮겨야 할 신호가 더 커 보여요.",
    prepare: "바로 움직이기보다 2~4주 준비 기간을 먼저 잡는 쪽이 좋아 보여요.",
    cta: "자세히 보려면 첫 댓글 링크에서 커리어 타이밍을 확인해보세요.",
  },
};
```

For a new owned product, the default campaign should use the product profile and active experiment:

```typescript
const PRODUCT_GROWTH_BASELINE: CampaignConfig = {
  id: "product_growth_baseline",
  name: "제품 성장 baseline",
  mode: "landing-test",
  qualityProfile: "product_growth",
  landingUrl: "{{productProfile.landingUrl}}",
  utmSource: "threads",
  utmCampaign: "{{activeExperiment.id}}",
  utmContentTemplate: "{{postId}}",
  dailyPostTarget: 3,
  linkCadenceEvery: 3,
  linkPlacement: "firstComment",
  formulas: [
    {
      id: "self_classification",
      name: "고객 문제 진단형",
      weight: 3,
      instruction: "타깃 고객이 A/B/C 중 가까운 문제 유형만 고르게 만든다. 운영자 추가 개입 없이도 참여가 완결되어야 한다.",
    },
    {
      id: "saveable_tool",
      name: "저장형 판단 도구",
      weight: 2,
      instruction: "제품 사용 전후 차이를 저장 가능한 체크리스트나 순서표로 보여준다.",
    },
    {
      id: "friend_share",
      name: "상황 공유형",
      weight: 2,
      instruction: "같은 문제를 겪는 사람에게 공유하고 싶게 만드는 제품 문제/오퍼 구조로 작성한다.",
    },
  ],
  replyPlaybook: {
    stay: "A/B/C 중 가까운 문제 유형을 먼저 고르면 다음 행동선을 줄이기 쉽습니다.",
    move: "그 문제라면 지금 쓰는 방식보다 제품으로 줄일 수 있는 시간이 클 수 있어요.",
    prepare: "바로 바꾸기 어렵다면 가장 자주 반복되는 작업 하나부터 적어보세요.",
    cta: "자세히 확인하려면 링크에서 제품 흐름을 먼저 확인해보세요.",
  },
};
```

### Link Cadence

- In each campaign batch, only 1 of every 3 posts receives a landing link.
- Links are placed in `firstComment`, not the main body.
- For 21 generated posts, exactly 7 should include links.
- UTM format:

```text
/career/uncertainty?utm_source=threads&utm_campaign=career_timing_wedge_399&utm_content={{postId}}
```

If `postId` is unavailable before insert, the system must either:

- create posts first, then update linked `firstComment` with the real post id, or
- create a stable post token and store it as `utmContent`.

### Quality Gate Profiles

```typescript
interface QualityResult {
  pass: boolean;
  score: number;
  profile: QualityProfileId;
  reasons: string[];
  careerDecisionType?: CareerDecisionType;
}
```

`saju_viral` keeps the existing astrology/saju viral checks but should not be the default for `career_timing_wedge_399`.

`career_decision` must pass all core checks:

- First line contains career anxiety: `이직`, `퇴사`, `버틸지`, `옮길지`, `번아웃`, or equivalent.
- Comment prompt exists.
- The post can be classified as one of:
  - `stay` / 버팀형
  - `move` / 이동형
  - `prepare` / 준비형
- Generic self-help phrasing is rejected, including patterns like:
  - "좋은 일이 올 거예요"
  - "스스로를 믿으세요"
  - "작은 변화가 큰 기적을"
  - "포기하지 마세요"

Saju-specific terms are optional in this profile. The post should retain CosmicPath language through timing, 흐름, 성향, 결정 패턴, or 운의 리듬 rather than forced astrology jargon.

`product_growth` must pass product-specific checks:

- The post references the product name, product category, target customer, offer promise, or product-specific keywords.
- The first line is not generic motivation or a content-farm hook.
- A clear action exists: self-check, save, share, profile visit, click, try, join, request, or check the landing URL.
- The content can stand alone for a non-CosmicPath product.
- Generic filler such as "좋은 일이 올 거예요" or "스스로를 믿으세요" fails.

Quality gate failures are allowed to remain visible in the queue for review and editing, but `/api/posts/[id]/publish` and cron publish must reject them. The legacy raw `/api/posts/upload` route is outside this product-growth boundary.

### Campaign Summary

| Method | Path | Description |
|:-------|:-----|:------------|
| `GET` | `/api/campaigns/summary?brandId=xxx&campaignId=yyy` | campaign dashboard summary |
| `PATCH` | `/api/posts/[id]/campaign-metrics` | clicks/conversions/manual paid conversion 입력 |

```typescript
interface CampaignSummaryResponse {
  brandId: string;
  campaignId: string;
  productProfile: ProductProfile;
  activeExperiment: ActiveExperiment;
  primaryMetric: {
    name: string;
    value: number;
  };
  conversionMetric: {
    name: string;
    value: number;
  };
  evidenceState: "learning" | "measuring";
  nextAction: string;
  todayScheduled: Array<{
    id: string;
    content: string;
    scheduledAt: string;
    publishedAt: string | null;
    createdAt: string;
    status: "PENDING" | "PUBLISHED" | "FAILED";
    firstComment: string | null;
    linkUrl: string | null;
    utmContent: string | null;
    qualityProfile: QualityProfileId | null;
    campaignFormulaId: CampaignFormulaId | null;
    qualityPass: boolean | null;
    qualityReasons: string[];
    careerDecisionType: CareerDecisionType | null;
    views: number;
    replies: number;
    reposts: number;
    clicks: number;
    conversions: number;
    manualPaidConversions: number;
    performanceScore: number;
    performanceTier: "learning" | "promising" | "strong" | "breakout";
  }>;
  linkRatio: {
    linked: number;
    total: number;
    percent: number;
  };
  quality: {
    passed: number;
    failed: number;
    unknown: number;
    total: number;
  };
  metrics: {
    views: number;
    replies: number;
    reposts: number;
    clicks: number;
    conversions: number;
    manualPaidConversions: number;
  };
  scoreWeights: {
    replies: 40;
    reposts: 25;
    views: 20;
    clicksConversions: 15;
  };
}

interface UpdateCampaignMetricsRequest {
  clicks?: number;
  conversions?: number;
  manualPaidConversions?: number;
}
```

### Reply Playbook

No automatic replies or DMs are allowed. The dashboard may display copy-ready templates only.

Template groups:

- `stay`: 버팀형 답변
- `move`: 이동형 답변
- `prepare`: 준비형 답변
- `cta`: first-comment/landing CTA 답변

---

## TikTok Video Experiment Engine Contract

This existing module generates, scores, and browser-renders TikTok-ready video drafts for a product profile. CosmicPath career timing remains the current preset. It does **not** upload, publish, comment, DM, scrape private data, or control a browser session.

### Data Contracts

```typescript
type TikTokVideoDraftStatus = "DRAFT" | "APPROVED" | "UPLOADED_MANUAL" | "ARCHIVED";
type TikTokQualityProfileId = "tiktok_career_timing";

interface TikTokVideoDraftResponse {
  id: string;
  brandId: string;
  campaignId: string;
  formatId: TikTokVideoFormatId;
  status: TikTokVideoDraftStatus;
  title: string;
  spokenHook: string;             // intended 0-2s hook
  script: string;                 // 15-35s spoken script
  sceneBeats: Array<{
    startSecond: number;
    endSecond: number;
    visualDirection: string;
    narration: string;
  }>;
  captionOverlays: string[];
  onScreenText: string[];
  hashtags: string[];
  cta: string;
  landingUrl: string | null;
  utmContent: string | null;
  qualityProfile: TikTokQualityProfileId;
  qualityPass: boolean;
  qualityScore: number;
  qualityReasons: string[];
  durationSeconds: number;
  renderTarget: {
    format: "webm";
    width: 1080;
    height: 1920;
    fps: 30;
  };
  createdAt: string;
  updatedAt: string;
}

interface TikTokVideoMetricResponse {
  draftId: string;
  measuredAt: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  profileClicks: number;
  landingClicks: number;
  conversions: number;
  performanceScore: number;
}
```

### Endpoints

| Method | Path | Description |
|:-------|:-----|:------------|
| `GET` | `/api/tiktok/videos?brandId=xxx&status=DRAFT` | TikTok draft 목록 조회 |
| `POST` | `/api/tiktok/videos/generate` | AI로 TikTok 영상 draft/spec 생성 |
| `PATCH` | `/api/tiktok/videos/[id]` | draft 상태, title, script/spec 편집 |
| `PATCH` | `/api/tiktok/videos/[id]/metrics` | 수동 TikTok 성과 입력 |
| `GET` | `/api/tiktok/summary?brandId=xxx&campaignId=yyy` | TikTok Video Lab summary |

```typescript
interface GenerateTikTokVideosRequest {
  brandId: string;
  campaignId?: string;            // default active campaign
  count?: number;                 // default 7, max 30
  formatIds?: TikTokVideoFormatId[];
}

interface GenerateTikTokVideosResponse {
  success: true;
  count: number;
  drafts: TikTokVideoDraftResponse[];
  quality: {
    passed: number;
    failed: number;
  };
}

interface UpdateTikTokVideoDraftRequest {
  status?: TikTokVideoDraftStatus;
  title?: string;
  spokenHook?: string;
  script?: string;
  sceneBeats?: TikTokVideoDraftResponse["sceneBeats"];
  captionOverlays?: string[];
  onScreenText?: string[];
  hashtags?: string[];
  cta?: string;
}

interface UpdateTikTokVideoMetricsRequest {
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  profileClicks?: number;
  landingClicks?: number;
  conversions?: number;
  measuredAt?: string;
}

interface TikTokSummaryResponse {
  brandId: string;
  campaignId: string;
  totals: {
    drafts: number;
    approved: number;
    manualUploads: number;
    qualityPassed: number;
    qualityFailed: number;
  };
  topFormats: Array<{
    formatId: TikTokVideoFormatId;
    count: number;
    avgPerformanceScore: number;
  }>;
  recommendations: string[];
  recentDrafts: TikTokVideoDraftResponse[];
}
```

### Quality Gate

`tiktok_career_timing` must check:

- 0-2초 안에 spoken hook이 있다.
- 첫 hook이나 첫 caption에 커리어 불안이 있다: `이직`, `퇴사`, `버틸지`, `옮길지`, `번아웃`, `커리어`, `일`, `회사`.
- CosmicPath language exists through timing, 흐름, 성향, 결정 패턴, 운의 리듬, or 사주/타로/점성술 language.
- One clear self-check, save, share, or profile CTA exists.
- The draft is classifiable as `stay`, `move`, or `prepare` when using `career_timing_diagnosis` or `self_classification`.
- Generic self-help phrases fail.
- Medical, legal, financial certainty and guaranteed fortune claims fail.

`qualityPass=false` drafts may be edited or archived, but cannot move to `APPROVED`.

### Performance Score

Initial TikTok score is manual-metrics based:

- comments: 35%
- shares: 20%
- saves: 20%
- views: 15%
- profileClicks + landingClicks + conversions: 10%

The score stays separate from Threads `performanceScore` until cross-channel learning is explicitly planned.

### Auth, Error, Empty-State Behavior

- All `/api/tiktok/*` endpoints require `auth_session` and brand ownership.
- Generate returns partial success if some drafts fail quality but others pass.
- Empty state returns `drafts: 0` and recommendations to generate a first batch.
- Status update to `APPROVED` fails with `400` when `qualityPass=false`.
- Metrics update accepts missing fields as zero and recomputes score.
- No TikTok OAuth or external API token is required in this MVP.
- Browser-side render creates a 9:16 WebM file from the approved/draft spec without server FFmpeg.

### Non-Goals

- No TikTok upload, draft upload, or Direct Post integration in this cycle.
- No Selenium/Playwright cookie uploader.
- No TikTok comments, DMs, likes, follows, or engagement automation.
- No TikTok private analytics or scraping.
- No server-side MP4/Remotion/FFmpeg render pipeline in this cycle.

---

## Growth Learning API

| Method | Path | Description |
|:-------|:-----|:------------|
| `GET` | `/api/growth?brandId=xxx` | 브랜드 성장 학습 리포트 조회 |
| `POST` | `/api/growth/learn` | 수집된 메트릭으로 growthMemory 재학습 |

```typescript
interface GrowthPattern {
  dimension: "formula" | "hook" | "topic" | "target" | "cta";
  value: string;
  count: number;
  avgScore: number;
  avgViews: number;
  avgLikes: number;
  avgReplies: number;
  avgReposts: number;
}

interface GrowthMemory {
  version: 1;
  updatedAt: string;
  sampleSize: number;
  avgScore: number;
  winners: GrowthPattern[];
  weakSignals: GrowthPattern[];
  recommendations: string[];
}

interface GrowthReportResponse {
  brandId: string;
  sampleSize: number;
  memory: GrowthMemory;
  topPatterns: GrowthPattern[];
  weakPatterns: GrowthPattern[];
}
```

---

## Viral Discovery API

| Method | Path | Description |
|:-------|:-----|:------------|
| `GET` | `/api/viral?brandId=xxx` | 브랜드 바이럴 레퍼런스/패턴 리포트 조회 |
| `POST` | `/api/viral/discover` | 저장된 소스, 요청 override, 수동 입력에서 바이럴 후보 저장 |
| `POST` | `/api/viral/learn` | 저장된 레퍼런스로 viralMemory 및 ViralPattern 재학습 |

```typescript
type ViralAdapterId = "owned_posts" | "threads_keyword" | "threads_profile" | "manual";

interface ViralPatternSummary {
  dimension: "hook" | "topic" | "emotion" | "structure" | "cta";
  value: string;
  count: number;
  avgViralScore: number;
  confidence: number;
  exampleIds: string[];
  recommendation: string;
}

interface ViralMemory {
  version: 1;
  updatedAt: string;
  sampleSize: number;
  avgViralScore: number;
  sourceMix: Record<string, number>;
  topPatterns: ViralPatternSummary[];
  recommendations: string[];
}

interface ViralDiscoverRequest {
  brandId: string;
  useSavedSources?: boolean;      // default true
  keywords?: string[];            // request-level override/addition
  handles?: string[];             // request-level override/addition
  includeOwnPosts?: boolean;      // default follows saved adapter setting
  manualExamples?: Array<{
    content: string;
    authorUsername?: string;
    permalink?: string;
    views?: number;
    likes?: number;
    replies?: number;
    reposts?: number;
    quotes?: number;
    shares?: number;
  }>;
  limit?: number;
}

interface ViralDiscoverResponse {
  success: true;
  brandId: string;
  discovered: number;
  saved: number;
  errors: Array<{
    adapter: ViralAdapterId;
    source: string;
    message: string;
  }>;
  sampleSize: number;
  memory: ViralMemory;
  topPatterns: Array<{
    id: string;
    dimension: string;
    value: string;
    sourceCount: number;
    avgViralScore: number;
    confidence: number;
    recommendation: string;
    exampleIds: string[];
  }>;
}

interface ViralAdapterResult {
  adapter: ViralAdapterId;
  sourceKey: string;
  authorUsername: string | null;
  permalink: string | null;
  content: string;
  publishedAt: string | null;
  metrics: {
    views?: number;
    likes?: number;
    replies?: number;
    reposts?: number;
    quotes?: number;
    shares?: number;
  };
  raw: Record<string, unknown>;
}
```

### Auth, Error, Empty-State Behavior

- All `/api/viral/*` user endpoints require `auth_session` and brand ownership.
- Cron `/api/cron/viral` requires `CRON_SECRET` when configured.
- `POST /api/viral/discover` returns partial success when one source fails and another source saves examples.
- Empty saved sources fall back to owned posts and brand topics; if no candidates exist, response is `success: true`, `saved: 0`, `sampleSize: 0`.
- External reference content is used for pattern extraction only; generation must not copy source text verbatim.

### Non-Goals

- No auto-commenting, DM, or engagement automation.
- No TikTok discovery, upload, or publishing provider implementation inside the viral discovery cycle.
- No conversion tracking or paid attribution in this cycle.

---

## Cron API

| Method | Path | Description |
|:-------|:-----|:------------|
| `GET` | `/api/cron/publish` | 모든 active 제품 순회 → 각 1개 FIFO 발행 |
| `GET` | `/api/cron/refresh-token` | 모든 제품의 Threads 토큰 상태 확인 및 갱신 |
| `GET` | `/api/cron/learn` | 모든 제품 growthMemory 재학습 |
| `GET` | `/api/cron/viral` | 모든 제품 viral discovery + viralMemory 재학습 |

```typescript
interface CronPublishResponse {
  published: Array<{
    brandId: string;
    brandName: string;
    postId: string;
    threadsId: string;
  }>;
  skipped: Array<{
    brandId: string;
    brandName: string;
    reason: "no_pending" | "quality_blocked" | "publish_failed";
  }>;
}
```

---

## Analytics API

| Method | Path | Description |
|:-------|:-----|:------------|
| `GET` | `/api/analytics?brandId=xxx` | 제품별 공식 성과 요약 |

```typescript
interface AnalyticsResponse {
  brandId: string;
  total: number;
  evaluated: number;
  byFormula: FormulaStats[];
  topFormula: FormulaStats | null;
  bottomFormula: FormulaStats | null;
  collectedAt: string;
}
```

---

## Database Schema (Prisma)

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String   // bcrypt hash
  name      String?
  createdAt DateTime @default(now())
  brands    Brand[]
}

model Brand {
  id             String   @id @default(cuid())
  name           String
  slug           String   @unique
  accessToken    String
  threadsUserId  String
  tokenExpiry    DateTime
  updatedAt      DateTime @updatedAt
  createdAt      DateTime @default(now())
  formulaWeights String   @default("{}")  // JSON
  brandConfig    String   @default("{}")  // JSON: BrandConfig
  growthMemory   String   @default("{}")  // JSON: GrowthMemory
  viralMemory    String   @default("{}")  // JSON: ViralMemory
  ownerId        String
  owner          User     @relation(fields: [ownerId], references: [id])
  posts          Post[]
  viralExamples  ViralExample[]
  viralPatterns  ViralPattern[]
}

model Post {
  id           String    @id @default(cuid())
  brandId      String
  brand        Brand     @relation(fields: [brandId], references: [id])
  content      String
  imageUrls    String    @default("[]")
  scheduledAt  DateTime
  status       String    @default("PENDING")
  threadsId    String?
  createdAt    DateTime  @default(now())
  errorLog     String?
  firstComment String?
  formulaId    String?
  topic        String?
  targetAudience String?
  situation    String?
  hookType     String?
  ctaType      String?
  qualityScore Int?
  views        Int?
  likes        Int?
  replies      Int?
  reposts      Int?
  metricsAt    DateTime?
  performanceScore Int?
  performanceTier  String?
  learnedAt    DateTime?
}

model ViralExample {
  id              String    @id @default(cuid())
  brandId         String
  brand           Brand     @relation(fields: [brandId], references: [id], onDelete: Cascade)
  source          String
  sourceKey       String
  authorUsername  String?
  permalink       String?
  content         String
  publishedAt     DateTime?
  discoveredAt    DateTime  @default(now())
  views           Int?
  likes           Int?
  replies         Int?
  reposts         Int?
  quotes          Int?
  shares          Int?
  engagementRate  Float?
  velocityScore   Int?
  viralScore      Int       @default(0)
  hookType        String?
  topic           String?
  emotionalDriver String?
  structureType   String?
  ctaType         String?
  patternSummary  String?
  keyTakeaway     String?
  rawMetrics      String    @default("{}")

  @@unique([brandId, source, sourceKey])
}

model ViralPattern {
  id              String   @id @default(cuid())
  brandId         String
  brand           Brand    @relation(fields: [brandId], references: [id], onDelete: Cascade)
  dimension       String
  value           String
  sourceCount     Int
  avgViralScore   Int
  confidence      Int
  exampleIds      String   @default("[]")
  recommendation  String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([brandId, dimension, value])
}

model TikTokVideoDraft {
  id              String   @id @default(cuid())
  brandId         String
  brand           Brand    @relation(fields: [brandId], references: [id], onDelete: Cascade)
  campaignId      String
  formatId        String
  status          String   @default("DRAFT")
  title           String
  spokenHook      String
  script          String
  sceneBeats      String   @default("[]")
  captionOverlays String   @default("[]")
  onScreenText    String   @default("[]")
  hashtags        String   @default("[]")
  cta             String
  landingUrl      String?
  utmContent      String?
  qualityProfile  String   @default("tiktok_career_timing")
  qualityPass     Boolean  @default(false)
  qualityScore    Int      @default(0)
  qualityReasons  String   @default("[]")
  durationSeconds Int      @default(25)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  metrics         TikTokVideoMetric[]

  @@index([brandId, campaignId])
  @@index([brandId, status])
  @@index([brandId, createdAt])
}

model TikTokVideoMetric {
  id               String   @id @default(cuid())
  draftId          String
  draft            TikTokVideoDraft @relation(fields: [draftId], references: [id], onDelete: Cascade)
  measuredAt       DateTime @default(now())
  views            Int      @default(0)
  likes            Int      @default(0)
  comments         Int      @default(0)
  shares           Int      @default(0)
  saves            Int      @default(0)
  profileClicks    Int      @default(0)
  landingClicks    Int      @default(0)
  conversions      Int      @default(0)
  performanceScore Int      @default(0)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@index([draftId, measuredAt])
}

// Settings 테이블은 Brand로 완전 대체 (마이그레이션 후 제거)
```

---

## Migration Plan

1. `User` 생성 → 환경변수 `ADMIN_EMAIL`, `ADMIN_PASSWORD`로 첫 유저 시드
2. `Brand` 생성 → 현재 `Settings` 레코드를 "CosmicPath" 브랜드로 복사
3. `Post.brandId` 추가 → 기존 모든 Post에 CosmicPath brandId 할당
4. `Settings` 테이블 유지 (하위 호환) → 이후 사이클에서 제거

---

## Error Codes

| Code | Meaning | When |
|:-----|:--------|:-----|
| `400` | Bad Request | 입력값 검증 실패 |
| `401` | Unauthorized | 미로그인 or Cron secret 불일치 |
| `403` | Forbidden | 다른 유저의 브랜드 접근 |
| `404` | Not Found | 잘못된 ID |
| `409` | Conflict | slug 중복 |
| `500` | Server Error | DB / Threads API 오류 |

---

## Account Intelligence Contract

2시간 간격 계정 분석은 `AccountInsight` 스냅샷으로 저장한다. 목적은 완전 실시간 자동 판단이 아니라, 최근 48시간의 성과를 읽고 운영자가 바로 할 일을 제안하는 것이다.

| Method | Path | Description |
|:-------|:-----|:------------|
| `GET` | `/api/account-intelligence?brandId=xxx` | 최신 계정 분석과 최근 히스토리 조회 |
| `POST` | `/api/account-intelligence/run` | 현재 브랜드 계정 분석 수동 실행 |
| `GET` | `/api/cron/account-intelligence` | 전체 브랜드 2시간 간격 계정 분석 cron |

```typescript
type AccountInsightActionType =
  | "reply_now"
  | "boost_format"
  | "reduce_format"
  | "link_ratio_warning"
  | "quality_warning"
  | "watch_post";

interface AccountInsightAction {
  id: string;
  type: AccountInsightActionType;
  priority: "high" | "medium" | "low";
  title: string;
  detail: string;
  postId?: string;
  campaignId?: string;
  formulaId?: string;
  score?: number;
}

interface AccountInsightMetrics {
  windowHours: number;            // default 48
  totalPosts: number;
  publishedPosts: number;
  pendingPosts: number;
  linkedPosts: number;
  qualityFailedPosts: number;
  totalViews: number;
  totalReplies: number;
  totalReposts: number;
  totalClicks: number;
  totalConversions: number;
  avgPerformanceScore: number;
  metricsRefresh: {
    attempted: number;
    updated: number;
    failed: number;
  };
}

interface AccountInsightSnapshot {
  id: string;
  brandId: string;
  generatedAt: string;
  windowStart: string;
  windowEnd: string;
  source: "cron" | "manual";
  summary: string;
  actions: AccountInsightAction[];
  metrics: AccountInsightMetrics;
}
```

Cron recommendation:

```bash
0 */2 * * * curl -H "Authorization: Bearer $CRON_SECRET" \
  https://<app>/api/cron/account-intelligence
```

---

## Non-goals

- X/Instagram 외부 플랫폼 연동
- TikTok upload/publish 외부 API 연동
- 공개 API / 3rd party webhook
- 브랜드 간 콘텐츠 공유
- 초단위 실시간 알림/자동 판단

> [!IMPORTANT]
> 코드와 계약이 어긋나면 ship 게이트에서 먼저 문서를 갱신하거나 구현을 되돌려야 한다.
