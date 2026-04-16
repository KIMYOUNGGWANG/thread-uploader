# Plan — CosmicPath 마케팅 자동화 루프
> 작성일: 2026-04-15  
> 근거: docs/office-hours.md

## 목표

```
[콘텐츠 생성] → [품질 게이트] → [포스팅] → [성과 수집] → [UTM 전환 추적] → [공식 최적화]
```

현재 시스템(generate → publish cron)은 이미 작동 중이다.  
**추가할 것은 4개의 레이어**다: Quality Gate, Metrics, UTM, Optimizer.

---

## 현재 시스템 요약

| 파일 | 역할 |
|------|------|
| `src/app/api/generate/route.ts` | Claude Haiku로 8가지 공식 × 30가지 주제 조합 생성 |
| `src/app/api/cron/publish/route.ts` | PENDING → Threads 발행 → PUBLISHED |
| `src/lib/threads-api.ts` | Threads Graph API 래퍼 |
| `prisma/schema.prisma` | Post(content, threadsId, status, firstComment) |

**누락된 것:**
- Post에 `formulaId` 없음 → 어떤 공식이 효과적인지 추적 불가
- 게시 후 성과(조회수/좋아요) 수집 없음
- 웹사이트 UTM 추적 없음
- 공식 weights 하드코딩 → 성과 기반 자동 조정 없음

---

## Phase 1 — Formula Tag + Quality Gate
> 목적: Drift 방지. 생성된 콘텐츠가 바이럴 공식을 반드시 지키게 한다.

### 1-1. DB 스키마 변경

**파일: `prisma/schema.prisma`**

```prisma
model Post {
  id           String   @id @default(cuid())
  content      String
  imageUrls    String   @default("[]")
  scheduledAt  DateTime
  status       String   @default("PENDING")
  threadsId    String?
  createdAt    DateTime @default(now())
  errorLog     String?
  firstComment String?
  // 신규 필드
  formulaId    String?   // "contrarian" | "choice" | "reveal" 등
  views        Int?      // Threads Insights에서 수집
  likes        Int?
  replies      Int?
  reposts      Int?
  metricsAt    DateTime? // 마지막 성과 수집 시각
}
```

마이그레이션: `pnpm prisma migrate dev --name add_formula_metrics`

### 1-2. Quality Gate

**파일: `src/lib/quality-gate.ts` (신규)**

바이럴 공식 체크리스트 (go-viral-or-die의 Core Value Congruence 기반):

```
체크 1: 사주 전문 용어 포함 여부
  → TOPICS 배열의 키워드 중 하나 이상이 본문에 있어야 함
  → 없으면 FAIL

체크 2: 첫 줄 훅 구조
  → 첫 줄이 질문형("?") 또는 상상 시나리오 또는 반전 선언이어야 함
  → "안녕", "오늘", "요즘" 등 generic 시작이면 FAIL

체크 3: 참여 유도
  → 선택지(1. 2. 3.) 또는 시리즈(1/2) 또는 동의 유발 문장 포함
  → 없으면 WARNING (FAIL 아님)

점수: 3점 만점, 2점 미만 → FAIL → 재생성 트리거
```

**파일: `src/app/api/generate/route.ts` 수정**

`generateOne()` 결과를 `qualityCheck()`에 통과시킨다.  
FAIL 시 최대 2회 재생성. 3회 모두 실패 시 WARNING 로그 후 그대로 저장.  
저장 시 `formulaId: formula.id` 포함.

---

## Phase 2 — Metrics Collection (성과 수집)
> 목적: 어떤 공식/주제가 실제로 조회수/좋아요를 만드는지 데이터로 파악.

### 2-1. Threads Insights API

Threads Graph API 공식 엔드포인트:
```
GET https://graph.threads.net/v1.0/{media-id}/insights
  ?metric=views,likes,replies,reposts,quotes
  &access_token={token}
```

**파일: `src/lib/threads-api.ts` 수정**

`fetchPostInsights(threadsId: string)` 함수 추가:
```typescript
// 반환 타입
interface PostInsights {
  views: number;
  likes: number;
  replies: number;
  reposts: number;
}
```

### 2-2. Metrics Cron Job

**파일: `src/app/api/cron/fetch-metrics/route.ts` (신규)**

- 하루 1회 실행 (Vercel Cron 또는 GitHub Actions)
- 대상: `status = "PUBLISHED"` AND (`metricsAt = null` OR `metricsAt < 48시간 전`)
- 게시 후 2일 이상 된 글은 성과가 안정화됐다고 가정 → skip
- 배치 처리: 한 번에 최대 20개

**vercel.json 수정:**
```json
{
  "crons": [
    { "path": "/api/cron/publish", "schedule": "..." },
    { "path": "/api/cron/fetch-metrics", "schedule": "0 9 * * *" }
  ]
}
```

---

## Phase 3 — UTM Conversion Tracking
> 목적: Threads → 웹사이트 유입을 측정 가능하게 만든다.

### 3-1. First Comment에 UTM 링크 삽입

**파일: `src/app/api/generate/route.ts` 수정**

firstComment 생성 프롬프트에 아래를 자동 추가:
```
마지막 줄에 반드시 이 링크를 자연스럽게 넣어:
cosmicpath.app?utm_source=threads&utm_medium=social&utm_campaign={formulaId}

예시: "더 자세한 내 사주 → cosmicpath.app?utm_source=threads&utm_medium=social&utm_campaign=reveal"
```

이렇게 하면 Google Analytics / 웹사이트 analytics에서
"어떤 공식의 게시물이 유입을 만드는지" 추적 가능해진다.

---

## Phase 4 — Formula Weight Optimizer
> 목적: 성과 데이터를 기반으로 공식 가중치를 자동 조정해 drift를 시스템으로 방지.

### 4-1. Analytics API

**파일: `src/app/api/analytics/route.ts` (신규)**

```
GET /api/analytics
응답: 공식별 평균 조회수/좋아요, 상위 3개 공식, 하위 3개 공식
```

ai-marketing-skills의 growth-engine 개념 적용:
- 충분한 샘플(최소 5개 게시물)이 있는 공식만 평가
- 상위 20% 공식 = winner → weight +1
- 하위 20% 공식 = loser → weight -1 (최소 1 유지)

### 4-2. Weight 자동 업데이트

**파일: `src/app/api/generate/optimize/route.ts` (신규)**

```
POST /api/generate/optimize
  → DB에서 지난 30일 성과 데이터 분석
  → 최적 weights 계산
  → generate/route.ts의 FORMULAS를 직접 업데이트하지 않고
     DB의 Settings 테이블에 weights JSON 저장
  → 다음 generateOne() 호출 시 DB weights 우선 사용
```

**Settings 모델 확장:**
```prisma
model Settings {
  ...
  formulaWeights String @default("{}") // JSON: { contrarian: 4, choice: 2, ... }
}
```

---

## 파일 변경 요약

| 파일 | 변경 유형 | 내용 |
|------|---------|------|
| `prisma/schema.prisma` | 수정 | formulaId, views, likes, replies, reposts, metricsAt 추가 |
| `src/lib/quality-gate.ts` | 신규 | 바이럴 공식 준수 체크 (3가지 기준) |
| `src/lib/threads-api.ts` | 수정 | fetchPostInsights() 추가 |
| `src/app/api/generate/route.ts` | 수정 | Quality Gate 적용, formulaId 저장, UTM 링크 주입 |
| `src/app/api/cron/fetch-metrics/route.ts` | 신규 | 성과 수집 cron |
| `src/app/api/analytics/route.ts` | 신규 | 공식별 성과 요약 API |
| `src/app/api/generate/optimize/route.ts` | 신규 | 공식 가중치 최적화 |
| `vercel.json` | 수정 | fetch-metrics cron 추가 |

---

## 구현 순서 (의존성 기준)

```
Phase 1 (스키마 + Quality Gate)
  ↓ threadsId 이미 있음, formulaId만 추가
Phase 2 (Metrics 수집)
  ↓ formulaId가 있어야 공식별 분석 가능
Phase 3 (UTM)  ← Phase 1과 병렬 가능
Phase 4 (Optimizer)
  ↓ Phase 2 데이터가 쌓인 후 의미있음
```

---

## 성공 기준

| 지표 | 현재 | 목표 |
|------|------|------|
| 바이럴 공식 준수율 | 측정 불가 | 100% |
| 성과 데이터 보유 | 0개 | 전체 PUBLISHED 게시물 |
| Threads → 웹사이트 UTM | 없음 | 모든 firstComment에 포함 |
| 공식 가중치 | 하드코딩 | DB 기반 동적 조정 |

---

## 다음 단계

`/develop` — Phase 1부터 순서대로 구현
