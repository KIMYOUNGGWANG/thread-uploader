# 📜 API Spec — Threads Auto Uploader

- **Version**: v2.0 (Multi-brand SaaS)
- **Updated**: 2026-04-16
- **Base URL**: `/api`

---

## Primary Flow & Actors

```
[Brand Owner]
  → 회원가입/로그인
  → 브랜드 생성 (Threads token 연결)
  → 콘텐츠 생성 (AI) or 수동 업로드
  → PENDING 큐 확인
  → [Cron] 각 브랜드 FIFO 자동 발행
```

---

## Authentication

- **Method**: email + password → httpOnly 쿠키 세션 (`auth_session` 쿠키에 userId 저장)
- **bcrypt**: 비밀번호 해싱 (rounds=12)
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
  qualityRules?: {              // 품질 게이트 설정 (선택)
    minLength?: number;
    requiredTerms?: string[];
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
  createdAt: string;
  errorLog: string | null;
  firstComment: string | null;
  formulaId: string | null;
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
}

interface GenerateResponse {
  success: true;
  count: number;
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

## Cron API

| Method | Path | Description |
|:-------|:-----|:------------|
| `GET` | `/api/cron/publish` | 모든 active 브랜드 순회 → 각 1개 FIFO 발행 |
| `GET` | `/api/cron/refresh-token` | 모든 브랜드 토큰 상태 확인 및 갱신 |

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
  ownerId        String
  owner          User     @relation(fields: [ownerId], references: [id])
  posts          Post[]
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
  views        Int?
  likes        Int?
  replies      Int?
  reposts      Int?
  metricsAt    DateTime?
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

## Non-goals

- X, Instagram, TikTok 등 타 플랫폼 연동
- 공개 API / 3rd party webhook
- 브랜드 간 콘텐츠 공유
- 실시간 알림

> [!IMPORTANT]
> 코드와 계약이 어긋나면 ship 게이트에서 먼저 문서를 갱신하거나 구현을 되돌려야 한다.
