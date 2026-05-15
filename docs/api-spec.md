# 📜 API Spec — Threads Auto Uploader

- **Version**: v2.0 (Multi-brand SaaS)
- **Updated**: 2026-05-15
- **Base URL**: `/api`

---

## Primary Flow & Actors

```
[Brand Owner]
  → 회원가입/로그인
  → 브랜드 생성 (Threads token 연결)
  → active campaign 설정 (career_timing_wedge_399)
  → AI Account Discovery로 관련 공개 계정 후보 발견
  → 후보 계정 watch/ignore 승인
  → watched 계정 공개 글 구조 학습
  → career_decision 품질 게이트 설정
  → 캠페인 콘텐츠 생성 (3종 공식 + 링크 cadence)
  → PENDING 큐 확인
  → [Cron] 각 브랜드 FIFO 자동 발행
  → 댓글 대응 플레이북으로 수동 답글
  → UTM/성과/수동 전환 입력
  → 캠페인 성과 학습
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

## Brand API

| Method | Path | Description | Auth |
|:-------|:-----|:------------|:-----|
| `GET` | `/api/brands` | 내 브랜드 목록 | Required |
| `POST` | `/api/brands` | 브랜드 생성 | Required |
| `GET` | `/api/brands/[id]` | 브랜드 상세 | Required + Owner |
| `PATCH` | `/api/brands/[id]` | 브랜드 수정 | Required + Owner |
| `DELETE` | `/api/brands/[id]` | 브랜드 삭제 | Required + Owner |

```typescript
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
}

type QualityProfileId = "saju_viral" | "career_decision";
type CampaignFormulaId = "comment_diagnosis" | "friend_tag" | "self_confession";
type CareerDecisionType = "stay" | "move" | "prepare";

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
    weight: number;
    instruction: string;
  }>;
  replyPlaybook: {
    stay: string[];
    move: string[];
    prepare: string[];
    cta: string[];
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

---

## AI Account Discovery API

The account discovery engine finds related public Threads accounts, scores them for CosmicPath relevance, and only learns from accounts that the Brand Owner explicitly watches.

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

### Scoring

Initial MVP scoring is deterministic and explainable:

- target/topic overlap: 30
- career decision anxiety terms: 25
- saju/timing/flow language: 15
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

`qualityPass === false` posts are review-only and must not be published by either immediate publish or cron publish.

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

Default campaign for CosmicPath career wedge:

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
      id: "comment_diagnosis",
      weight: 4,
      instruction: "댓글에 상황을 쓰면 버팀형/이동형/준비형으로 분류해준다는 진단형 포스트",
    },
    {
      id: "friend_tag",
      weight: 2,
      instruction: "이직/퇴사 고민하는 친구에게 보내주라는 공유 유도형 포스트",
    },
    {
      id: "self_confession",
      weight: 3,
      instruction: "퇴사/이직 불안에 대한 자기고백과 공감형 포스트",
    },
  ],
  replyPlaybook: {
    stay: ["지금은 옮기기보다 버티면서 조건을 정리할 타이밍으로 보여요."],
    move: ["이미 버틸 이유보다 옮겨야 할 신호가 더 커 보여요."],
    prepare: ["바로 움직이기보다 2~4주 준비 기간을 먼저 잡는 쪽이 좋아 보여요."],
    cta: ["자세히 보려면 첫 댓글 링크에서 커리어 타이밍을 확인해보세요."],
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

Quality gate failures are allowed to remain visible in the queue for review and editing, but publish boundaries must reject them.

### Campaign Summary

| Method | Path | Description |
|:-------|:-----|:------------|
| `GET` | `/api/campaigns/summary?brandId=xxx&campaignId=yyy` | campaign dashboard summary |
| `PATCH` | `/api/posts/[id]/campaign-metrics` | clicks/conversions/manual paid conversion 입력 |

```typescript
interface CampaignSummaryResponse {
  brandId: string;
  campaignId: string;
  todayScheduled: Array<{
    id: string;
    content: string;
    scheduledAt: string;
    campaignFormulaId: CampaignFormulaId | null;
    hasLink: boolean;
    qualityPass: boolean | null;
    qualityReasons: string[];
    careerDecisionType: CareerDecisionType | null;
    views: number | null;
    replies: number | null;
    reposts: number | null;
    clicks: number | null;
    conversions: number | null;
    manualPaidConversions: number | null;
  }>;
  linkRatio: {
    linked: number;
    total: number;
  };
  quality: {
    passed: number;
    failed: number;
  };
  scoreWeights: {
    replies: 0.4;
    reposts: 0.25;
    views: 0.2;
    clicksConversions: 0.15;
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
- No non-Threads external provider implementation in this cycle.
- No conversion tracking or paid attribution in this cycle.

---

## Cron API

| Method | Path | Description |
|:-------|:-----|:------------|
| `GET` | `/api/cron/publish` | 모든 active 브랜드 순회 → 각 1개 FIFO 발행 |
| `GET` | `/api/cron/refresh-token` | 모든 브랜드 토큰 상태 확인 및 갱신 |
| `GET` | `/api/cron/learn` | 모든 브랜드 growthMemory 재학습 |
| `GET` | `/api/cron/viral` | 모든 브랜드 viral discovery + viralMemory 재학습 |

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
    reason: "no_pending" | "publish_failed";
  }>;
}
```

---

## Analytics API

| Method | Path | Description |
|:-------|:-----|:------------|
| `GET` | `/api/analytics?brandId=xxx` | 브랜드별 공식 성과 요약 |

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

- X, Instagram, TikTok 등 타 플랫폼 연동
- 공개 API / 3rd party webhook
- 브랜드 간 콘텐츠 공유
- 초단위 실시간 알림/자동 판단

> [!IMPORTANT]
> 코드와 계약이 어긋나면 ship 게이트에서 먼저 문서를 갱신하거나 구현을 되돌려야 한다.
