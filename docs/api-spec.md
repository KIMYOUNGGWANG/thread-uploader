# API Spec — Portfolio Growth OS

- **Version**: v2.1 (Internal Product Portfolio Growth)
- **Updated**: 2026-10-13
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
- **Cron 예외**: `Authorization: Bearer <CRON_SECRET>` 헤더만 허용 (`?secret=` 쿼리는 거부)

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
    id: "owned_posts" | "threads_keyword" | "threads_profile" | "manual" | "youtube_shorts";
    enabled: boolean;
  }>;
  youtube: {
    keywords: string[];
    channelHandles: string[];
    regions: Array<"KR" | "GLOBAL">;
    maxDurationSec: number;
    minViews: { kr: number; global: number };
  };
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

### Instagram 연결 (1단계: 릴스 교차 발행)

| Method | Path | Description | Auth |
|:-------|:-----|:------------|:-----|
| `GET` | `/api/oauth/instagram/start?brandId=` | `brandId` 필수(없으면 400), `INSTAGRAM_APP_ID` 미설정이면 500. 소유 제품 검증 후 `instagram_oauth` 쿠키(httpOnly, 10분, `brandId:state`)를 심고 Instagram 인가 화면(scope `instagram_business_basic,instagram_business_content_publish`)으로 302 | Required + Owner |
| `GET` | `/api/oauth/instagram/callback` | `state`·`code` 검증(불일치 400). 단기 토큰 → 장기 토큰 교환 후 `Brand.instagramAccessToken`(암호화)·`instagramUserId`·`instagramUsername`·`instagramTokenExpiry` 저장, `instagramConnectedAt`은 최초 연결 시각 유지. 바이오 링크 기준 글(`Post.status="ANCHOR"`)을 한 번만 만들어 `brandConfig.instagram.bioAnchorPostId`에 저장. 성공 시 `/brands/[slug]/settings?instagram=connected`, 실패 시 `/brands?instagram=connection_failed`로 302 | Required + Owner |

```typescript
interface InstagramConfig {            // brandConfig.instagram (항상 존재, 기본값 채워짐)
  captionSuffix: string;               // 릴스 캡션 끝에 붙는 꼬리말
  carouselDailyCap: number;            // ≥1
  publishHoursKst: number[];           // 0-23
  bioAnchorPostId?: string;            // 바이오 링크 클릭/전환이 귀속되는 Post.id
}
```

- 설정 화면(`/brands/[slug]/settings` 기본 정보 탭)이 연결 버튼, `@username`·토큰 만료일, 만료 시 "재연결 필요", 캡션 꼬리말 편집, 바이오 링크(`buildInstagramBioLink`: `/start?pid=<anchorId>&utm_source=instagram&utm_campaign=instagram_bio…`) 복사, "인스타 합계: 클릭 N · 전환 N"(기준 글의 `clicks`/`conversions`, 없으면 0)을 보여준다. 액세스 토큰은 클라이언트로 내려가지 않는다.

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

`qualityPass === false` queued posts are review-only and must not be published by `/api/posts/[id]/publish` or cron publish. The legacy raw `POST /api/posts/upload` route was removed (2026-10-08); all publishing goes through `/api/posts/[id]/publish` or `/api/cron/publish`.

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

## Additional Endpoints (코드 기준 보충)

위 섹션에 없던 라우트를 `src/app/api/**/route.ts`에서 뽑아 정리했다. 설명은 해당 라우트 코드에서 확인한 동작만 적었다.

**Auth 열**
- 프록시(`src/proxy.ts`)는 `PUBLIC_PATHS`(`/api/cron`, `/api/oauth`, `/api/cards`, `/api/webhooks`, `/api/products/auto-setup` 등) 밖의 `/api/*`에 `auth_session` 쿠키를 요구한다.
- `Required` = 로그인 세션. `+ Brand Owner` / `+ Post Owner` = 소유자만(슈퍼 관리자 예외, 아니면 `403`/`404`).
- `Cron Secret` = `Authorization: Bearer <CRON_SECRET>`. 프로덕션에서 `CRON_SECRET`이 없으면 전부 `401`이다.
- `Public` = 인증 없음.

### Brand / Channel

| Method | Path | Description | Auth |
|:-------|:-----|:------------|:-----|
| `GET` | `/api/brands/[id]/health` | 저장된 계정 건강 상태(`accountHealth`) 조회 | Required + Brand Owner |
| `PATCH` | `/api/brands/[id]/health` | 운영자가 건강 상태를 직접 지정 `{ status: HEALTHY \| WARNING \| SHADOWBAN_SUSPECTED \| RECOVERY, reason? }`. `SHADOWBAN_SUSPECTED`는 발행을 `WARMUP_ONLY` 모드로 바꾼다 | Required + Brand Owner |
| `POST` | `/api/brands/[id]/health` | 최근 발행 글의 조회수로 섀도밴 여부를 재평가해 저장. 직전 평가 후 1분 안이면 이전 결과를 돌려준다(`?force=true` 또는 `{ force: true }`로 건너뜀) | Required + Brand Owner |
| `POST` | `/api/brands/[id]/voice` | `{ samples?, useTopPosts? }`로 브랜드 말투(voice) 추출. `useTopPosts`는 과거 고성과 글 5개를 쓴다 | Required + Brand Owner |
| `PUT` | `/api/brands/[id]/distribution` | `brandConfig.distribution`을 통째로 교체(다른 키는 그대로) | Required + Brand Owner |
| `PATCH` | `/api/channel-accounts/[id]` | `{ enabled: boolean }` 해당 채널로의 업로드 일시중지/재개 | Required + Brand Owner |
| `DELETE` | `/api/channel-accounts/[id]` | 채널 토큰(YouTube/TikTok/X) 삭제. 업로드 이력은 남는다 | Required + Brand Owner |
| `POST` | `/api/channel-uploads/[id]` | `{ action: "cancel" \| "retry" \| "ack_public" }` | Required + Brand Owner |
| `POST` | `/api/video-drafts/[id]/schedule` | `{ action: "cancel" \| "resume" \| "publish_now" }` | Required + Brand Owner |
| `PATCH` | `/api/video-drafts/[id]/verdict` | `{ verdict: "good" \| "bad" }`. `COMPLETED` 영상만 가능(아니면 `409`), 소유자가 아니면 `404` | Required + Brand Owner |
| `GET` | `/api/oauth/threads/start?brandId=xxx` | Threads OAuth 시작 | Brand Owner (라우트가 직접 검사) |
| `GET` | `/api/oauth/threads/callback?state=&code=` | `code`를 토큰으로 교환해 브랜드에 저장 | Brand Owner (라우트가 직접 검사) |
| `GET` | `/api/oauth/[platform]/start?brandId=xxx` | `platform`은 `youtube`, `tiktok`, `x`. 플랫폼 동의 화면으로 보낸다 | Brand Owner (라우트가 직접 검사) |
| `GET` | `/api/oauth/[platform]/callback` | 같은 세 플랫폼. 암호화한 토큰을 브랜드의 `ChannelAccount`에 저장 | Brand Owner (라우트가 직접 검사) |

### Content

| Method | Path | Description | Auth |
|:-------|:-----|:------------|:-----|
| `POST` | `/api/command` | 한 줄 명령 → 계획 → 초안. `{ text }`만 보내면 계획만 돌려주고 부작용이 없다. `{ plan, approved: true }`면 가설을 활성 실험에 기록하고 초안을 큐에 넣는다 | Required + Brand Owner |
| `POST` | `/api/generate/review-pipeline` | `{ brandId, count?: 1-5 (기본 3) }`. 트렌드 수집 → 글마다 초안 3개 → 톤 채점으로 1개 선택 → `NEEDS_REVIEW`로 저장. 글 길이 실험이 진행 중이면 `409` | Required + Brand Owner |
| `POST` | `/api/posts/[id]/remediate` | 5D 알고리즘 점수나 게이트에 걸린 글을 자동 교정. 점수와 콘텐츠 게이트(영문은 자연스러움 판정 포함)를 모두 통과해야 통과 처리한다 | Required + Post Owner |
| `GET` | `/api/interactions?brandId=xxx` | 최근 발행 글 5개의 댓글을 불러와 답글 초안을 만든다 | Required + Brand Owner |
| `POST` | `/api/interactions` | `{ brandId, replyToThreadsId, replyText }` 답글 게시(재시도 포함) 후 해당 `ThreadReply`를 `PUBLISHED`로 표시 | Required + Brand Owner |
| `GET` | `/api/news/rss?query=&limit=` | 뉴스 RSS 헤드라인 조회 | Required |
| `GET` | `/api/cards/[id]?slide=&format=` | 카드뉴스 슬라이드 이미지 렌더. `format=jpg`면 JPEG(인스타 게시용). 카드 우선 브랜드는 저장된 슬라이드, 그 외는 본문 파서를 쓴다 | Public |
| `POST` | `/api/products/auto-setup` | 입력으로 제품 자동 세팅 초안을 만들어 돌려준다(저장 없음) | Public |

### Viral References

| Method | Path | Description | Auth |
|:-------|:-----|:------------|:-----|
| `GET` | `/api/viral/references?brandId=xxx` | 검토용 레퍼런스 목록 `{ references }` | Required + Brand Owner |
| `PATCH` | `/api/viral/references/[id]` | `{ brandId, decision: "approved" \| "rejected" \| null }`. 생성 소스 승인/제외, `null`이면 되돌리기 | Required + Brand Owner |
| `POST` | `/api/viral/references/manual` | `{ brandId, content, kind: "story" \| "info", linkUrl?, sourceUrl? }`. 결과 `status`는 `created`(`postId`) / `dropped`(`reasons`) / `duplicate`. 입력 오류는 `400`/`422` | Required + Brand Owner |
| `POST` | `/api/viral/references/[id]/draft` | 레퍼런스에서 바로 초안 생성. 상태 충돌 `409`, 품질 미달 `422` | Required + Brand Owner |

### Cron (표에 없던 것)

모두 `Cron Secret`이고 별도 표기가 없으면 `GET`이다. `apply` 파라미터가 있는 것은 기본이 미리보기(또는 dry-run)이고 `apply`를 줘야 쓴다.

| Method | Path | Description |
|:-------|:-----|:------------|
| `GET` | `/api/cron/apply-topic-plan?brand=slug&apply=true` | 코드 검토를 거친 주제 목록(`src/lib/topic-plans.ts`)을 `brandConfig.topics`에 쓴다. `apply=true`일 때만 쓰고, 이전 목록은 `previousTopics`에 남겨 되돌릴 수 있다 |
| `GET` | `/api/cron/channel-metrics` | 최근 14일 안에 올라간 채널 업로드의 조회·좋아요·댓글 수집 |
| `GET` | `/api/cron/distribute?brands=slug,slug&schedule=false` | 취소 유예가 끝난 업로드를 큐에 넣고(영상 → YouTube/Instagram/TikTok, 카드뉴스 → Instagram, 발행된 Threads 글 → X), 시간 한도 안에서 기한이 된 업로드를 전부 실행 |
| `GET` | `/api/cron/fetch-metrics` | Threads 글 지표 수집. 한 번도 측정 안 된 글은 최대 60일치까지 채우고, 호출당 고정 배치만 처리한다 |
| `GET` | `/api/cron/post-metrics-report?brand=slug&days=N&full=` | 최근 발행 글과 저장된 지표의 읽기 전용 리포트. 저장소가 공개라서 워크플로가 출력을 암호화한다 |
| `GET` | `/api/cron/regate-pending?brand=slug&status=NEEDS_REVIEW&apply=true` | 대기 글(`status`를 주면 `NEEDS_REVIEW`)을 가독성 규칙으로 다시 검사. `apply=true`일 때만 탈락한 글을 보관(삭제 아님) |
| `GET` | `/api/cron/seed-reference-radar?brand=slug&apply=true` | 비어 있는 `keywords`/`ownHandle`만 채운다(덮어쓰지 않음). `apply=true`일 때만 쓴다 |
| `GET` | `/api/cron/wellness` | `brandConfig.wellness`가 있는 브랜드마다 매일 리서치 → 초안. `NEEDS_REVIEW`로 저장 |
| `GET` | `/api/cron/video-jobs/next?brands=slug` | CI 렌더러에게 draft 1개를 넘긴다: 가장 오래된 `QUEUED`, 없으면 오늘 새로 생성. 렌더 중 죽어서 `RENDERING`으로 남은 draft는 다시 내준다 |
| `POST` | `/api/cron/video-jobs/complete` | `{ draftId, videoUrl }` 또는 `{ draftId, error }`. 렌더된 영상은 `NEEDS_REVIEW` Threads 글이 된다 |
| `GET` | `/api/cron/video-factory/next?brands=slug&force=1` | CI 렌더러에게 오늘의 kinetic-list 작업을 넘기며 `RENDERING`으로 선점. 없으면 `{ job: null }` |
| `POST` | `/api/cron/video-factory/complete` | `{ draftId, videoUrl, coverUrl }` 또는 `{ draftId, errors }`. `RENDERING` draft의 렌더 결과 기록 |
| `GET` | `/api/cron/backfill-channel-structure?apply=1` | 1회성 채널 구조 백필. 기본 dry-run, 여러 번 돌려도 같은 결과. 코드 주석상 레거시 컬럼 정리 단계에서 삭제 예정 |
| `GET` | `/api/cron/publication-parity` | 1회성 점검(읽기 전용): 최근 30일 발행 글의 `Post` 값과 저장된 `Publication` 값을 비교. 같은 이유로 삭제 예정 |

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
  perPostLinks: true, // false = bio-only: 글 링크·"링크 확인" CTA 없음, 프로필 링크(ref=threads_bio)로만 유도
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

- `perPostLinks: false` turns the campaign into bio-only mode: no post gets a link, the "링크 확인" CTA is never chosen, and `linkCadenceEvery` is ignored. Attribution then exists only in aggregate via the profile link (`buildBioLinkUrl`: `ref=threads_bio&track=track_c&fid=profile_hub`).
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

Quality gate failures are allowed to remain visible in the queue for review and editing, but `/api/posts/[id]/publish` and cron publish must reject them. The legacy raw `/api/posts/upload` route has been removed.

### Campaign Summary

| Method | Path | Description |
|:-------|:-----|:------------|
| `GET` | `/api/campaigns/summary?brandId=xxx&campaignId=yyy&scope=today\|campaign` | campaign dashboard summary; `scope` defaults to `today` |
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
  scoreWeights: {            // 건당 점수 = PERFORMANCE_SCORE_WEIGHTS (growth-learning)
    views: 0.2;
    replies: 40;
    reposts: 25;
    clicks: 50;
    conversions: 300;
    manualPaidConversions: 2500;
  };
  // scope=campaign only. A mature measurement requires metrics captured at least 72h after publish.
  experimentReadiness?: {
    status: "empty" | "incomplete" | "ready";
    totalPosts: number;
    immaturePosts: number;
    maturePosts: number;
    measuredMaturePosts: number;
    missingMetricsPosts: number;
    zeroViewMaturePosts: number;
  };
  viralModeComparisons?: Array<MatureComparison & {
    viralIntentModeId: string;
  }>;
  linkExposureComparison?: {
    linked: MatureComparison;
    control: MatureComparison;
  };
}

interface MatureComparison {
  totalPosts: number;
  maturePosts: number;
  measuredPosts: number;
  missingMetricsPosts: number;
  medianViews: number | null;
  replyRate: number;
  repostRate: number;
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

This module generates TikTok-ready video drafts (script and scene beats) for a product profile and renders them with Remotion, either inline or queued for a standalone worker. CosmicPath career timing remains the current preset. It does **not** publish, comment, DM, scrape private data, or control a browser session. Uploading to TikTok is a separate flow: channel OAuth (`/api/oauth/[platform]/*`) plus the `/api/cron/distribute` cron.

> 2026-09-06(`32980d9`)에 `/api/tiktok/videos*`와 `/api/tiktok/summary`가 삭제됐다. 현재 라우트는 아래 세 개뿐이다. `TikTokVideoMetric` 표는 남아 있지만 쓰는 코드가 없다.

### Data Contracts

```typescript
// The statuses the code writes. "APPROVED" / "UPLOADED_MANUAL" / "ARCHIVED" from the old contract are no longer used.
type TikTokVideoDraftStatus = "DRAFT" | "QUEUED" | "RENDERING" | "COMPLETED" | "FAILED";
type TikTokQualityProfileId = "tiktok_career_timing";

// The API returns the Prisma row as is: the list-like fields are JSON-encoded strings, not arrays.
interface TikTokVideoDraftResponse {
  id: string;
  brandId: string;
  campaignId: string;
  formatId: string;
  status: TikTokVideoDraftStatus;
  title: string;
  spokenHook: string;             // intended 0-2s hook
  script: string;                 // 15-35s spoken script
  sceneBeats: string;             // JSON: Array<{ startSecond, endSecond, visualDirection, narration }>
  captionOverlays: string;        // JSON: string[]
  onScreenText: string;           // JSON: string[]
  hashtags: string;               // JSON: string[]
  cta: string;
  landingUrl: string | null;
  utmContent: string | null;      // /api/tiktok/render also stores the render output path here
  qualityProfile: TikTokQualityProfileId;
  qualityPass: boolean;
  qualityScore: number;
  qualityReasons: string;         // JSON: string[] (a failed render stores its error here)
  durationSeconds: number;
  createdAt: string;
  updatedAt: string;
  metrics?: TikTokVideoMetricResponse[];   // GET /api/tiktok/drafts only: the latest one
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
| `GET` | `/api/tiktok/drafts?brandId=xxx` | 브랜드의 TikTok draft 목록(최신순). draft마다 가장 최근 `metrics` 1건 포함 |
| `POST` | `/api/tiktok/generate` | 스크립트 1개를 생성해 `DRAFT`로 저장 |
| `POST` | `/api/tiktok/render` | draft 렌더. `dryRun`(기본 `true`)이면 즉시 처리, `false`면 `QUEUED`로 바꿔 워커에 맡김 |

```typescript
// GET /api/tiktok/drafts?brandId=xxx
interface ListTikTokDraftsResponse {
  success: true;
  drafts: TikTokVideoDraftResponse[];
}

// POST /api/tiktok/generate
interface GenerateTikTokDraftRequest {
  brandId: string;                // required, else 400
  topic?: string;                 // default: the first default topic of the brand's preset, else the brand name
  dayMaster?: string;
  tone?: string;                  // one of PRODUCT_TONES, otherwise "mysterious"
}

interface GenerateTikTokDraftResponse {
  success: true;
  draft: TikTokVideoDraftResponse; // saved with status "DRAFT"
  scriptResult: object;            // the generation engine's output, as is
}

// POST /api/tiktok/render
interface RenderTikTokDraftRequest {
  draftId: string;                // required, else 400 (404 when it does not exist)
  dryRun?: boolean;               // default true
}

// dryRun=true  -> 200 { success: true, draft, renderResult }   draft.status = "COMPLETED", draft.utmContent = output path
//                 500 { success: false, draft, error }          draft.status = "FAILED"
// dryRun=false -> 202 { success: true, queued: true, draft, message }   draft.status = "QUEUED" (picked up by `worker:tiktok`)
```

`dryRun=true`(기본값)는 영상을 만들지 않는다. `.agents/results/videos/tiktok-<timestamp>/`에 `render-spec.json`만 쓰고, 존재하지 않는 `<draftId>.mp4` 경로를 성공으로 돌려주며, draft는 `COMPLETED`가 되어 그 경로가 `utmContent`에 저장된다. 실제 렌더는 `dryRun: false`로 큐에 넣은 뒤 로컬 워커가 한다.

### Quality Gate

`tiktok_career_timing` must check:

- 0-2초 안에 spoken hook이 있다.
- 첫 hook이나 첫 caption에 커리어 불안이 있다: `이직`, `퇴사`, `버틸지`, `옮길지`, `번아웃`, `커리어`, `일`, `회사`.
- CosmicPath language exists through timing, 흐름, 성향, 결정 패턴, 운의 리듬, or 사주/타로/점성술 language.
- One clear self-check, save, share, or profile CTA exists.
- The draft is classifiable as `stay`, `move`, or `prepare` when using `career_timing_diagnosis` or `self_classification`.
- Generic self-help phrases fail.
- Medical, legal, financial certainty and guaranteed fortune claims fail.

### Auth, Error, Empty-State Behavior

- All `/api/tiktok/*` endpoints require `auth_session` and ownership of the brand (the draft's brand for `render`).
- A missing `brandId` (`drafts`, `generate`) or `draftId` (`render`) returns `400`; an unknown `draftId` returns `404`.
- `generate` creates one draft per call; there is no batch generation or quality-based partial success any more.
- Nothing in this module writes `TikTokVideoMetric` (the old manual-metrics endpoint was removed), so `metrics` is empty for every draft.

### Non-Goals

- This module does not upload to TikTok. Upload goes through the channel OAuth flow and `/api/cron/distribute`.
- No Selenium/Playwright cookie uploader.
- No TikTok comments, DMs, likes, follows, or engagement automation.
- No TikTok private analytics or scraping.

---

## Growth Learning API

| Method | Path | Description |
|:-------|:-----|:------------|
| `GET` | `/api/growth?brandId=xxx` | 브랜드 성장 학습 리포트 조회 |
| `POST` | `/api/growth/learn` | 수집된 메트릭으로 growthMemory 재학습 |
| `GET` | `/api/growth/scorecard?brandId=xxx&weeks=4` | 주간 스코어카드: 7일 버킷별 발행/측정/중앙값 뷰/1만뷰 돌파율/퍼널/링크 비교, 공식별 표, 병목 진단과 next action. `weeks`는 1~12 (기본 4) |

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
  formulaWinners?: string[]; // 공식 차원에서 2개 이상·브랜드 평균 이상인 id. 학습 기록용 (생성 상태에는 쓰지 않음: 게이트 통과 글은 모두 PENDING)
}

interface GrowthReportResponse {
  brandId: string;
  sampleSize: number;
  memory: GrowthMemory;
  topPatterns: GrowthPattern[];
  weakPatterns: GrowthPattern[];
}

// GET /api/growth/scorecard
interface WeekBucket {
  label: string;                 // "최근 7일", "8~14일 전", ...
  startsAt: string; endsAt: string;
  published: number;
  measured: number;              // metricsAt ≥ publishedAt + 72h 이고 views != null
  medianViews: number | null;    // measured 기준
  breakoutCount: number;         // views ≥ 10,000
  breakoutRate: number;          // % (measured 기준)
  funnel: { views: number; clicks: number; conversions: number; paid: number };
  clicksPer1kViews: number | null;
  conversionsPerClickPct: number | null;
  linked: { posts: number; medianViews: number | null; clicks: number };
  unlinked: { posts: number; medianViews: number | null };
}

interface ScorecardFormulaRow {
  formulaId: string; posts: number; medianViews: number | null;
  breakoutRate: number; clicks: number; conversions: number; paid: number;
}

interface WeeklyScorecardResponse {
  brandId: string;
  generatedAt: string;
  weeks: WeekBucket[];                 // 최신 주 먼저
  formulas: ScorecardFormulaRow[];     // 측정 2개 이상, 중앙값 뷰 순, 최대 8행
  bottleneck: "sample" | "ops" | "reach" | "conversion" | "none";  // 이 순서로 첫 매치
  nextAction: string;
  queue: { review: number; pending: number };
}
```

병목 진단 규칙 (최근 2주 기준, 순서대로 첫 매치):
1. `sample`: measured 합 < 5
2. `ops`: NEEDS_REVIEW ≥ 10
3. `reach`: 1만뷰 돌파 0건이고 중앙값 뷰 < 300
4. `conversion`: views ≥ 1,000이고 (1천뷰당 클릭 < 5 또는 클릭 ≥ 10인데 전환 0)
5. `none`

---

## Viral Discovery API

| Method | Path | Description |
|:-------|:-----|:------------|
| `GET` | `/api/viral?brandId=xxx` | 브랜드 바이럴 레퍼런스/패턴 리포트 조회 |
| `POST` | `/api/viral/discover` | 저장된 소스, 요청 override, 수동 입력에서 바이럴 후보 저장 |
| `POST` | `/api/viral/learn` | 저장된 레퍼런스로 viralMemory 및 ViralPattern 재학습 |

```typescript
type ViralAdapterId = "owned_posts" | "threads_keyword" | "threads_profile" | "manual" | "youtube_shorts";

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
| `GET` | `/api/cron/publish` | 모든 active 제품 순회 → 각 1개 FIFO 발행. `?brands=slug1,slug2`로 제품 제한. `?slots=0,12`(UTC 시, 0-23)를 주면 열린 슬롯(시작 후 3시간)마다 1회만 발행하고, 슬롯 밖이면 `outside_publish_slot`, 이미 발행했으면 `slot_already_served`로 건너뜀. 형식 오류는 400. 발행을 시도했는데 끝내지 못한 제품(`skipped`의 `publish_failed`·`partial_failed`)이 하나라도 있으면 응답 본문은 그대로 두고 상태 코드만 500이다(알림 웹훅이 프로덕션에 없어서, 스케줄러 워크플로가 붉게 변하는 게 유일한 알림). 나머지 건너뜀 사유는 정상이라 200 |
| `GET` | `/api/cron/refresh-token` | 모든 제품의 Threads 토큰 상태 확인 및 갱신. Instagram 연결 제품은 같은 방식으로 갱신하고 결과를 응답 `instagramRefreshResults: Array<{ slug, success, message?, newExpiry?, instagramNeedsReconnect?, error? }>`로 함께 반환(만료돼 재연결이 필요한 건 `instagramNeedsReconnect: true`이며 500 사유가 아님) |
| `GET` | `/api/cron/instagram-publish?brands=slug1,slug2` | Instagram 연결된 제품(`instagramConnectedAt != null`, `brands`로 제한 가능)마다 Threads 영상 글을 릴스로 교차 발행. 한 번 호출에 ①`PROCESSING` 릴스 상태 확인·발행 ②Threads 발행 3일 지난 미처리 글 `SKIPPED` ③진행 중·방금 발행한 릴스가 없으면 다음 1개 업로드 시작. 릴스는 제품당 KST 하루 1개, 연결 시각 이전에 발행된 글은 올리지 않음, 재시도 최대 3회(3회째 실패 시 `FAILED` + 시스템 알림). 응답 `{ results: Array<{ slug } & ({ skipped: "not_connected" \| "token_expired" } \| { error: string } \| { advanced, published: string[], started: string \| null, skippedStale, failed: string[] })> }`. `token_expired`는 저장 토큰 만료(재연결 필요), `not_connected`는 토큰/계정 ID 없음. Cron 시크릿 없으면 401. Cloudflare Worker가 15분마다 호출(GitHub Actions `cron.yml`에는 없음) |
| `GET` | `/api/cron/replies` | 모든 제품 순회. 먼저 48시간 이내 독자 댓글 초안을 오래된 순으로 최대 3개 자동 게시(게시 전 `PUBLISHING`으로 선점 → 성공 `PUBLISHED`, 실패 `FAILED`; 중단돼 `PUBLISHING`에 남은 행은 자동 재시도하지 않고 `stuck`으로 보고). 이어서 최근 7일 발행 글(최대 25개)의 새 댓글을 수집해 Claude 초안을 `ThreadReply(DRAFT)`로 저장(런당 최대 5개; 브랜드 자기 댓글·링크·맞팔 유도·2자 미만 제외; `/me` 사용자명 조회 실패 시 그 회차 댓글 스캔 생략; Claude 실패 시 고정 문구 없이 행을 만들지 않고 다음 회차 재시도 → `draftsSkipped`). 언어는 `voiceProfile.language`/`ecommerce_d2c`면 en. 멘션 초안은 수동 승인용. `AUTO_REPLY_PUBLISH=false`면 게시 생략. 응답 brand마다 `{ ...scan, autoReply: { published, failed, stuck, errors } \| null }`. GitHub Actions `cron.yml` `replies` 잡이 매시간 호출 |
| `GET` | `/api/cron/auto-plug` | 반응이 온 글에 링크 답글을 1회 단다. 대상 브랜드는 라우트 상수 `AUTO_PLUG_BRANDS`(현재 `cosmicpath`만). 토큰이 없거나 만료된 브랜드는 `skipped: "token_expired"`. 후보는 `PUBLISHED`·`threadsId` 있음·`linkUrl = null`(발행 시 링크를 단 글과 이미 링크를 단 글 제외)·발행 45분~48시간 글, 최신순 최대 10개. 글마다 Threads 인사이트를 조회해 조회 300 이상 또는 댓글 10 이상이면 `linkUrl`이 null일 때만 `linkUrl = <브랜드 랜딩>&utm_content=<postId>`·`utmContent = postId`로 선점한 뒤, 본문에 `/r/<postId>` 짧은 링크를 넣은 답글을 게시한다. 게시가 실패하면 `errorLog`에 `Auto-plug failed:`를 덧붙이고 선점은 유지한다(중복 게시 방지를 위해 자동 재시도 없음). `?dryRun=1`이면 선점·게시 없이 대상만 보고한다. 응답 `{ results: Array<{ slug, checked, plugged: Array<{ postId, views, replies }>, errors: Array<{ postId, error }>, dryRun? } \| { slug, skipped } \| { slug, error }> }`. Cron 시크릿 없으면 401. GitHub Actions `cron.yml` `auto-plug` 잡이 워크플로 실행마다(15분 일정·매시간 일정·수동 실행) 호출 |
| `GET` | `/api/cron/learn` | 모든 제품 growthMemory · formulaWeights · thompsonPriors 재학습 (formulaWeights 단독 소유자). formulaWeights와 thompsonPriors 모두 저장값에 누적하지 않고 최근 300개 창에서 기본값부터 재계산. 응답 `{ success, brands: Array<{ slug, success, ... }> }`. 학습이 실패한 제품이 하나라도 있으면 `success: false`와 상태 코드 500(나머지 제품은 그대로 학습됨) |
| `GET` | `/api/cron/shadowban-check` | 제품마다 섀도밴 프로브(`evaluateShadowbanHealth`, 수동 재평가 버튼과 같은 `evaluateBrandShadowban`)를 돌려 **감지만** 한다. 상태(`accountHealth`/`shadowbanStatus`)는 쓰지 않는다. 이미 `SHADOWBAN_SUSPECTED`인 제품은 `skipped: "already_in_shadowban_mode"`. `SHADOWBAN_SUSPECTED`가 나온 제품이 있거나 검사가 예외를 던진 제품이 있으면 `sendSystemAlert` + 상태 코드 500(`success: false`, 알림 웹훅이 프로덕션에 없어서 붉은 GitHub 실행이 유일한 알림). `WARNING`은 본문에만 싣고 200. 적용(하루 1개 웜업 글, 링크 금지)은 계정 건강 배너의 "웜업 모드 강제 전환"(`PATCH /api/brands/[id]/health`)으로 사람이 한다. 응답 `{ success, brands: Array<{ slug, success, status, dropPercentage, recentAverageViews, baselineAverageViews, reasons } \| { slug, skipped } \| { slug, success: false, error }> }`. GitHub Actions `fetch-metrics.yml`이 지표 수집 뒤 하루 1회 호출 |
| `GET` | `/api/cron/feedback?apply=true` | 72h 성숙 글 기준 viralMemory topPerformers + 금지 표현 학습 (formulaWeights는 쓰지 않음) |
| `GET` | `/api/cron/viral` | 모든 제품 viral discovery → 미분석 상위 10개 Claude 분석(`rawMetrics.llmAnalyzedAt`, `whyItWorks`) → viralMemory 재학습. `topPerformers`/`nextHookCandidates`는 feedback cron 소유라 보존. 외부 글 점수에 TOP 검색 순위·키워드 중복·반복 노출(`rawMetrics.searchRank`/`keywordHits`/`timesSeen`) 가산 |
| `GET` | `/api/cron/shorts/discover?brands=slug,slug` | 6h. `youtube_shorts` 어댑터가 켜진 브랜드만 키워드·채널에서 48h 내 쇼츠 수집. `brands`는 대상을 좁히기만 함(꺼진 브랜드는 `brands`에 있어도 건너뜀) |
| `GET` | `/api/cron/shorts/snapshot` | 1h. 72h 내 쇼츠 통계 스냅샷 → velocity 갱신 → 7일 지난 쇼츠 삭제 |
| `GET` | `/api/cron/refill?brand=slug&target=N` | `brand`, `target`(1-50) 필수. 대기열(PENDING+NEEDS_REVIEW)이 target 미만이면 부족분을 최대 6개까지 `generatePostsForBrand`로 생성. `approvedCampaignStart`는 항상 false. 대기열이 차 있으면 `skipped: "backlog_full"` |
| `GET` | `/api/cron/trends?brands=slug` | `brands` 필수(없으면 400). 한국어 제품만 대상. 도메인별 키워드로 브랜드 토큰의 Threads 키워드 검색(최근 72시간 글 중 TOP 검색 순위·키워드 중복 노출·댓글 유무로 점수화해 도메인당 상위 12개, 작성자 제거) + Claude(Sonnet) 웹 검색으로 커리어·재테크·관계 갈등 수집. 토큰이 없거나 만료면 웹 검색만으로 진행 → 브랜드 훅으로 변환 → `brandConfig.trendRadar = { harvestedAt, items[≤6] }` 저장. 생성 시 4일 이내 레이더만 프롬프트에 주입. 응답 brand마다 `threadsSearch: { calls, failed, posts, firstError?, skipped? }` (키워드 검색 실패·토큰 문제 진단용) |
| `POST` | `/api/cron/promo-posts` | 홍보 영상 로테이션 등록 (CI `render-promo-job.mjs` 전용, `Authorization: Bearer CRON_SECRET`). 본문 `{ date: "YYYY-MM-DD", items: [{ brandSlug, videoUrl, content, commentTemplate, landingPath, format, topic }] }`. 검증: `videoUrl` https + `.mp4`, `content` 1–480자, `commentTemplate`에 `{{link}}`, `landingPath`는 `/start`로 시작, items 1–4개 — 위반 시 400. item마다 `formulaId = video:promo:<date>`로 브랜드당 1개만 만들고(ARCHIVED가 아닌 글이 이미 있으면 `skipped: "already_queued"`와 그 글의 `postId`·`status`, ARCHIVED 글은 자리를 막지 않음, 브랜드 없으면 `skipped: "brand_not_found"`), `NEEDS_REVIEW` Post(`imageUrls=[videoUrl]`, `topic="<format>:<topic>"`) 생성 후 `linkUrl = https://cosmicpath.app<landingPath>` + `utm_source=threads&utm_campaign=promo-rotation&utm_content=<postId>`, `firstComment`는 `{{link}}` 치환. 응답 `{ results }` |

학습 루프 규칙:
- 학습 목표 `brandConfig.optimizationGoal`: `"reach"`(기본, 조회수 우선) 또는 `"conversion"`. reach면 공식 승격·`formulaWinners` 집계·feedback top performer·Thompson 보상이 **조회수**로 계산된다 (Thompson 보상 = min(1, views / (브랜드 중앙값 뷰 × 2))). conversion이면 아래 revenue 점수를 쓴다. 저장되는 `performanceScore`/`performanceTier`는 목표와 무관하게 revenue 점수(표시용).
- 표시 점수 정의는 `calculatePerformanceScore` 하나 (조회 0.2 · 댓글 40 · 리포스트 25 · 클릭 50 · 전환 300 · 유료전환 2500). Thompson 보상은 전환 0.6 / 반응 0.4.
- 생성 품질 게이트에 토픽 포화 가드가 있다: 최근 10개 글 중 같은 마커 그룹(`birth_time_offset`: 진태양시/30분 오차/32분/동경시/서머타임)이 상한(1개)에 도달하면 후보 글이 그 소재를 쓸 때 실패 처리하고 재시도 프롬프트에 사유를 넣는다.
- 품질 게이트를 통과한 초안은 공식과 상관없이 모두 `PENDING`으로 저장된다 (`formulaWinners` 자동 승인 없음). 어느 공식에 물량을 줄지는 학습(Thompson priors)이 정한다.
- remediation 리라이트 결과는 품질 게이트를 다시 통과해야 하며, 실패하면 원문(이미 통과)으로 되돌리고 `qualityReasons`에 `remediation_reverted: …`를 남긴다. 영어 초안은 리라이트가 바뀌었으면 자연스러움 채점(`judgeEnglishNaturalness`)도 다시 통과해야 한다. 수동 `POST /api/posts/[id]/remediate`도 영어 글(`ecommerce_d2c` 또는 한글 없음)은 점수·게이트·자연스러움을 모두 통과해야 `PENDING`이 된다.
- 캠페인 링크 cadence는 캠페인의 기존 글 수를 오프셋으로 더해 `(offset + index + 1) % linkCadenceEvery === 0`으로 결정한다 (청크 요청에서도 1/N 유지). 링크 없는 글에는 "링크 확인" CTA를 쓰지 않는다.
- `thompsonPriors`는 매 실행마다 중립 prior(`NEUTRAL_PRIOR`)에서 발행 72시간 이상 지난 최근 300개 글로 재계산 (중복 학습 방지).
- CosmicPath lean sprint는 priors가 있으면 5개 viral mode(`imagination_dilemma`·`concept_hierarchy`·`identity_profile`·`relationship_tension`·`beginner_qa`) 중 Thompson 샘플링으로 선택, 없으면 고정 배분. 승자 원본이 있으면 `winner_replay`가 6번째 arm으로 들어간다.
- `winner_replay` arm: 한국어 lean sprint 전용(`ecommerce_d2c` 제외). 최근 60일 발행 글 중 조회수가 브랜드 하위 중앙값의 5배 이상인 글(이미 `winner_replay`로 만든 글은 제외, 14일 안에 replay한 소스도 제외)의 구조를 새 토픽으로 다시 쓴다. 실행당 최대 1개, 원본과 너무 비슷하면 게이트에서 떨어지고, 저장 시 `qualityReasons`에 `winner_replay_source:<postId>`를 남긴다. 길이 실험이 진행 중이면 arm별 탈락률과 무작위 배정을 지키기 위해 제공하지 않는다. 소스 조회가 실패하면 경고만 남기고 replay 없이 생성을 계속한다.

```typescript
interface CronLearnResponse {
  success: true;
  brands: Array<{
    slug: string;
    success: boolean;
    learnedPosts?: number;
    promotedFormulas?: string[];
    demotedFormulas?: string[];
    weeklyLift?: {
      current: { posts: number; avgScore: number; conversionsPer1kViews: number };  // 3~10일 전 발행
      previous: { posts: number; avgScore: number; conversionsPer1kViews: number }; // 10~17일 전 발행
      scoreLiftPct: number | null; // 한쪽 주에 글이 없으면 null
    };
    error?: string;
  }>;
}
```

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
    reason: "no_pending" | "quality_blocked" | "awaiting_review" | "scheduled_later" | "publish_failed" | "daily_quota_reached"; // daily_quota_reached: 등급 일일 쿼터(KST 자정 기준) 도달, 글 상태는 바꾸지 않음
    // awaiting_review: 발행할 글은 없고 NEEDS_REVIEW 글만 있음(refill은 이걸 backlog로 세서 생성도 멈춤) → 시스템 알림 발송
    // scheduled_later: PENDING 글이 있지만 scheduledAt이 아직 미래
  }>;
}
```

```typescript
interface ShortsCronResponse {
  success: true;
  brands: Array<{
    slug: string;
    discovered?: number;
    saved?: number;
    snapshots?: number;
    deleted?: number;
    quotaUsed: number;
    errors: ViralSourceError[];
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

## Conversion Webhook

| Method | Path | Description |
|:-------|:-----|:------------|
| `POST` | `/api/webhooks/conversion` | 랜딩/제품 쪽에서 글 귀속 전환 이벤트 수신. `postId`(또는 `pid`)로 글에 귀속하고 Post 카운터를 원자적으로 증가시킨 뒤 performanceScore를 재계산 |

```typescript
interface ConversionWebhookRequest {
  postId?: string; pid?: string;      // 둘 중 하나 필수
  eventType: string;                  // 아래 표로 정규화
  amount?: number;
  sessionId?: string;                 // 중복 제거 키 (idempotencyKey가 없을 때)
  idempotencyKey?: string;
}
```

| 정규화 | 원본 eventType | 인증 | 증가 컬럼 |
|---|---|---|---|
| `click` | `click`, `landing_view` | 없음 | `clicks` |
| `conversion` | `test_start`, `first_result_view`, `conversion`, `analysis_start`, `decision_question_submit`, `ritual_action_viewed`, `signup`, `checkout_intent`, `match_created`, `match_create` | 없음 | `conversions` |
| `paid_conversion` | `paid_conversion`, `checkout_success`, `payment`, `order_complete` | `x-webhook-secret` 또는 `Authorization: Bearer <CONVERSION_WEBHOOK_SECRET>` | `manualPaidConversions` |

그 외 eventType은 `{ success: true, ignored: true }`로 응답하고 아무것도 기록하지 않는다. `match_created`는 CosmicPath 북극성 지표(월 궁합 생성 수)다.

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
  instagramAccessToken  String?   // encrypt() 저장, 클라이언트로 전송 금지
  instagramUserId       String?
  instagramUsername     String?
  instagramTokenExpiry  DateTime?
  instagramConnectedAt  DateTime? // 최초 연결 시각. 이전에 Threads에 발행된 글은 릴스로 올리지 않음
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
  instagramStatus       String?   // null(대기) | PROCESSING | PUBLISHED | FAILED | SKIPPED. 바이오 기준 글은 status="ANCHOR"
  instagramContainerId  String?
  instagramMediaId      String?
  instagramPublishedAt  DateTime?
  instagramAttempts     Int       @default(0)
  instagramError        String?
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
  country         String?
  snapshots       ViralExampleSnapshot[]

  @@unique([brandId, source, sourceKey])
  @@index([brandId, source, publishedAt])
}

model ViralExampleSnapshot {
  id         String       @id @default(cuid())
  exampleId  String
  example    ViralExample @relation(fields: [exampleId], references: [id], onDelete: Cascade)
  capturedAt DateTime
  views      Int
  likes      Int?
  comments   Int?
  @@unique([exampleId, capturedAt])
  @@index([exampleId, capturedAt(sort: Desc)])
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
| `GET` | `/api/cron/account-intelligence` | 전체 브랜드 2시간 간격 계정 분석 cron. 매 실행 `metrics.followersCount`에 Threads 사용자 인사이트 `followers_count`를 기록(조회 실패 시 `null`, 0으로 기록하지 않음) → 팔로워 추이는 AccountInsight 히스토리에서 읽는다 |

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

- X 연동 / Instagram 스토리·DM·지표(3단계) — Instagram 릴스 교차 발행과 바이오 링크 기준 글은 1단계로 구현됨
- TikTok upload/publish 외부 API 연동
- 공개 API / 3rd party webhook
- 브랜드 간 콘텐츠 공유
- 초단위 실시간 알림/자동 판단

> [!IMPORTANT]
> 코드와 계약이 어긋나면 ship 게이트에서 먼저 문서를 갱신하거나 구현을 되돌려야 한다.
