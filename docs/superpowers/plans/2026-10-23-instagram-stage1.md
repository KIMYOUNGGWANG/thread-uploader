# Instagram 1단계 (연결 + 릴스 교차 발행 + 바이오 매출 추적) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CosmicPath 인스타 계정을 OAuth로 연결하고, Threads에 발행된 릴스를 인스타 릴스로 자동 교차 발행하며, 바이오 링크 유입 결제를 기존 웹훅 경로로 기록한다.

**Architecture:** Threads 발행 경로(`/api/cron/publish`)는 건드리지 않는다. 새 cron `/api/cron/instagram-publish`가 `PUBLISHED` 상태의 영상 글을 골라 2틱 방식(컨테이너 생성 → 다음 틱에 상태 확인·게시)으로 인스타에 올린다. Graph API 호출은 `src/lib/instagram-api.ts`, 판단 로직은 `src/lib/instagram-reels-sync.ts`에 모은다. 매출은 브랜드마다 `status = "ANCHOR"`인 바이오 기준 `Post`를 하나 두고 그 id를 바이오 링크 `pid`로 써서 기존 전환 웹훅에 그대로 쌓는다.

**Tech Stack:** Next.js 16 App Router, Prisma 5 (PostgreSQL), Vitest, Instagram API with Instagram Login (`graph.instagram.com/v26.0`), Cloudflare Worker scheduler.

**Spec:** `docs/superpowers/specs/2026-10-23-instagram-integration-design.md` (§1~§5, §7 중 1단계 컬럼, §8~§11). 2단계 캐러셀(§6, `InstagramCarousel` 테이블, `sharp`)은 이 계획 범위가 아니다 — 캐러셀 디자인 시안 승인 후 별도 계획.

## Global Constraints

- 패키지 매니저는 `pnpm`만. 이 계획은 새 의존성을 추가하지 않는다.
- `any` 금지. 외부 응답은 `unknown` → `isRecord`(from `@/types/config-normalizers`) 등으로 좁힌다.
- 함수 20줄 미만, 축약어 금지 (`request`/`response`, `res`·`req` 금지).
- 비밀값: `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`은 `.env.local`/Vercel 환경변수에만. 토큰은 `encrypt()`로 암호화 저장, `decryptToken()`으로 복호화.
- Graph 호스트: `https://graph.instagram.com/v26.0`. 토큰 교환: `POST https://api.instagram.com/oauth/access_token`. 인가: `https://www.instagram.com/oauth/authorize`.
- OAuth scope: `instagram_business_basic,instagram_business_content_publish`.
- 캡션 최대 2,200자.
- 하루 기준은 KST 0시 → `startOfPublishDay(now)` (`@/lib/account-trust-ramp`) 재사용.
- 릴스는 브랜드당 KST 하루 1개. 인스타 연결 시각 이전에 Threads에 발행된 글은 절대 올리지 않는다. Threads 발행 후 3일이 지나면 `SKIPPED`.
- 재시도 최대 3회, 3회째 실패 시 `FAILED` + `sendSystemAlert`.
- `src/app/api/cron/publish/route.ts`는 수정하지 않는다.
- 커밋 메시지: conventional commits + 한국어 (예: `feat: 인스타 릴스 교차 발행 cron 추가`). `git add`는 파일명 지정.
- 프로덕션 DB 마이그레이션 적용과 `git push`는 사용자 승인 후에만.

## Review Focus

1. **동시 실행** — Cloudflare가 같은 틱을 두 번 호출해도 같은 글이 두 번 올라가지 않아야 한다 → Task 6 `claims atomically` 테스트.
2. **선점 후 크래시** — `instagramStatus = "PROCESSING"`인데 `instagramContainerId`가 null인 글은 실패 1회로 세고 다시 시도돼야 한다 (영원히 멈추면 안 됨) → Task 6 `recovers a claim without container` 테스트.
3. **토큰 없음·만료** — 인스타 미연결/만료 브랜드는 조용히 건너뛰고 200을 돌려야 한다. Threads 쪽에는 영향 없음 → Task 6 route 테스트.
4. **긴 Threads 글** — 여러 파트로 나뉜 긴 `content` + 꼬리말이 2,200자를 넘으면 잘라서 올려야 한다 (API 에러로 실패하면 안 됨) → Task 6 `buildInstagramCaption` 테스트.
5. **연결 전 과거 릴스** — 연결 직후 첫 틱에 과거 릴스가 몰려 올라가면 안 된다 → Task 6 `selectReelCandidate` 테스트.

---

### Task 0: 릴스 mp4가 인스타 규격(faststart)인지 확인

인스타는 moov atom이 파일 앞에 있어야 한다. Remotion 출력이 이걸 만족하는지 먼저 확인한다.

**Files:**
- Modify (필요할 때만): `video/scripts/queue-reels.mjs`

- [ ] **Step 1: 최근 렌더 mp4 하나의 atom 순서 확인**

Run: `ffprobe -v trace video/out/reels/<아무 파일>.mp4 2>&1 | grep -m2 -o "type:'\(moov\|mdat\)'"`
Expected: 첫 줄이 `type:'moov'`면 통과 → Task 0 끝 (커밋 없음).

- [ ] **Step 2: (mdat가 먼저일 때만) 업로드 전 faststart 재포장 추가**

`queue-reels.mjs`의 `uploadVideo`에서 업로드 전에 `ffmpeg -y -i <in> -c copy -movflags +faststart <tmp>`를 `node:child_process`의 `execFileSync`로 실행하고 tmp 파일을 올린다. `--dry-run`에서는 실행하지 않는다.

- [ ] **Step 3: 재포장 결과 확인 후 커밋**

Run: Step 1 명령을 재포장된 파일에 실행 → `type:'moov'`가 먼저.
```bash
git add video/scripts/queue-reels.mjs
git commit -m "fix: 릴스 업로드 전 faststart 재포장 추가"
```

---

### Task 1: DB 스키마 (1단계 컬럼)

**Files:**
- Modify: `prisma/schema.prisma` (`model Brand`, `model Post`)
- Create: `prisma/migrations/20261023120000_add_instagram_integration/migration.sql`

**Interfaces:**
- Produces: `Brand.instagramAccessToken | instagramUserId | instagramUsername: String?`, `Brand.instagramTokenExpiry | instagramConnectedAt: DateTime?`; `Post.instagramStatus | instagramContainerId | instagramMediaId | instagramError: String?`, `Post.instagramPublishedAt: DateTime?`, `Post.instagramAttempts: Int @default(0)`, `@@index([brandId, instagramStatus])`.

- [ ] **Step 1: `schema.prisma`에 위 컬럼 추가** (spec §7 그대로, `InstagramCarousel`과 `Brand.instagramCarousels` 관계는 2단계라 제외)

- [ ] **Step 2: 마이그레이션 SQL 작성** — 기존 마이그레이션처럼 손으로 쓴 `ALTER TABLE "Brand" ADD COLUMN ...`, `ALTER TABLE "Post" ADD COLUMN ...`, `CREATE INDEX "Post_brandId_instagramStatus_idx" ON "Post"("brandId", "instagramStatus");`. 모든 컬럼 nullable, `instagramAttempts`만 `INTEGER NOT NULL DEFAULT 0`.

- [ ] **Step 3: 클라이언트 생성·타입 확인**

Run: `pnpm prisma generate && pnpm typecheck`
Expected: 에러 없음.

- [ ] **Step 4: 커밋**

```bash
git add prisma/schema.prisma prisma/migrations/20261023120000_add_instagram_integration/migration.sql
git commit -m "feat: 인스타 연동용 Brand·Post 컬럼 추가"
```

(프로덕션 적용 `pnpm prisma migrate deploy`는 Task 8에서 사용자 승인 후.)

---

### Task 2: 브랜드 설정 `instagram` 파싱 + 추적 링크 출처

**Files:**
- Modify: `src/types/brand.ts` (`BrandConfig` 타입, `parseBrandConfig`)
- Modify: `src/lib/tracking-url.ts:13-21` (`buildTrackedUrl`)
- Test: `src/types/brand.test.ts`(없으면 생성), `src/lib/tracking-url.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface InstagramConfig {
    captionSuffix: string;      // 기본 ""
    carouselDailyCap: number;   // 기본 1 (2단계용, 파싱만)
    publishHoursKst: number[];  // 기본 [12, 20] (2단계용, 파싱만)
    bioAnchorPostId?: string;
  }
  export function parseInstagramConfig(input: unknown): InstagramConfig;
  // BrandConfig에 `instagram: InstagramConfig` 추가 (항상 존재, 기본값 채움)
  ```
  `buildTrackedUrl`: `params.source`가 있으면 `utm_source`도 그 값. 없으면 기존처럼 `"threads"`.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
it("fills instagram defaults when missing", () => {
  expect(parseBrandConfig("{}").instagram).toEqual({ captionSuffix: "", carouselDailyCap: 1, publishHoursKst: [12, 20] });
});
it("keeps a valid instagram config and drops invalid fields", () => {
  const config = parseBrandConfig(JSON.stringify({ instagram: { captionSuffix: "끝", carouselDailyCap: "x", publishHoursKst: [20, 99], bioAnchorPostId: "p1" } }));
  expect(config.instagram).toEqual({ captionSuffix: "끝", carouselDailyCap: 1, publishHoursKst: [20], bioAnchorPostId: "p1" });
});
// tracking-url.test.ts
it("uses source as utm_source when given", () => {
  const url = new URL(buildTrackedUrl("https://x.com/start", { postId: "p1", source: "instagram" }));
  expect(url.searchParams.get("utm_source")).toBe("instagram");
  expect(url.searchParams.get("ref")).toBe("instagram");
  expect(url.searchParams.get("pid")).toBe("p1");
});
it("keeps utm_source=threads without source", () => {
  expect(new URL(buildTrackedUrl("https://x.com", { postId: "p1" })).searchParams.get("utm_source")).toBe("threads");
});
```

- [ ] **Step 2: 실패 확인** — Run: `pnpm vitest run src/types/brand.test.ts src/lib/tracking-url.test.ts` → FAIL.

- [ ] **Step 3: 구현** — `parseInstagramConfig`는 `publishHoursKst`에서 0~23 정수만 남기고, `carouselDailyCap`은 1 이상 정수가 아니면 1. `parseBrandConfig` 반환 객체에 `instagram: parseInstagramConfig(parsed.instagram)` 추가. `DEFAULT_BRAND_CONFIG`에도 기본값 추가.

- [ ] **Step 4: 통과 확인** — 같은 명령 → PASS. `pnpm typecheck` 통과.

- [ ] **Step 5: 커밋**

```bash
git add src/types/brand.ts src/types/brand.test.ts src/lib/tracking-url.ts src/lib/tracking-url.test.ts
git commit -m "feat: 브랜드 설정에 인스타 항목과 추적 링크 출처 추가"
```

---

### Task 3: 인스타 OAuth + 바이오 기준 글

**Files:**
- Create: `src/lib/instagram-oauth.ts`, `src/lib/instagram-oauth.test.ts`
- Create: `src/lib/instagram-bio-anchor.ts`, `src/lib/instagram-bio-anchor.test.ts`
- Create: `src/app/api/oauth/instagram/start/route.ts`, `src/app/api/oauth/instagram/callback/route.ts`, `src/app/api/oauth/instagram/callback/route.test.ts`

**Interfaces:**
- Consumes: Task 1 컬럼, Task 2 `parseInstagramConfig`, `buildTrackedUrl`, `serializeBrandConfigUpdate`.
- Produces:
  ```ts
  // instagram-oauth.ts
  export const INSTAGRAM_GRAPH_BASE = "https://graph.instagram.com/v26.0";
  export class InstagramOAuthError extends Error {}
  export function buildInstagramAuthorizationUrl(input: { appId: string; redirectUri: string; state: string }): string;
  export async function exchangeInstagramAuthorizationCode(input: { appId: string; appSecret: string; code: string; redirectUri: string }): Promise<string>;
  export async function exchangeInstagramLongLivedToken(input: { appSecret: string; shortLivedToken: string }): Promise<{ accessToken: string; expiresIn: number }>;
  export async function refreshInstagramLongLivedToken(accessToken: string): Promise<{ accessToken: string; expiresIn: number }>;
  export async function getInstagramProfile(accessToken: string): Promise<{ userId: string; username: string }>;
  // instagram-bio-anchor.ts
  export const INSTAGRAM_BIO_ANCHOR_STATUS = "ANCHOR";
  export const INSTAGRAM_BIO_CATEGORY = "INSTAGRAM_BIO";
  export async function ensureInstagramBioAnchor(brandId: string): Promise<string>; // anchor Post id
  export function buildInstagramBioLink(websiteUrl: string, anchorPostId: string): string;
  ```

- [ ] **Step 1: 실패하는 테스트 작성** (`fetch`는 `vi.stubGlobal`로 대체, `threads-oauth.test.ts` 방식 따름)

```ts
it("builds the authorize URL with publish scopes", () => {
  const url = new URL(buildInstagramAuthorizationUrl({ appId: "a", redirectUri: "https://x/cb", state: "s" }));
  expect(url.origin + url.pathname).toBe("https://www.instagram.com/oauth/authorize");
  expect(url.searchParams.get("scope")).toBe("instagram_business_basic,instagram_business_content_publish");
  expect(url.searchParams.get("response_type")).toBe("code");
});
it("exchanges code via form POST to api.instagram.com", async () => { /* fetch 호출 URL·method·body(code, grant_type=authorization_code) 검증, access_token 반환 */ });
it("exchanges long-lived token with grant_type=ig_exchange_token", async () => { /* expiresIn 숫자 반환 */ });
it("refreshes with grant_type=ig_refresh_token", async () => { /* ... */ });
it("reads user_id and username from /me", async () => { /* GET .../me?fields=user_id,username */ });
it("throws InstagramOAuthError with the API message on error", async () => { /* { error: { message: "bad" } } → message 포함 */ });
// instagram-bio-anchor.test.ts (prisma mock)
it("creates an ANCHOR post once and stores its id in brandConfig", async () => { /* create 1회, brand.update에 bioAnchorPostId */ });
it("reuses the stored anchor when it still exists", async () => { /* create 호출 없음 */ });
it("builds the bio link to /start with pid and utm_source=instagram", () => {
  const url = new URL(buildInstagramBioLink("https://cosmicpath.app", "p1"));
  expect(url.pathname).toBe("/start");
  expect(url.searchParams.get("pid")).toBe("p1");
  expect(url.searchParams.get("utm_source")).toBe("instagram");
});
// callback/route.test.ts
it("stores encrypted token, profile, connectedAt and redirects to settings?instagram=connected", async () => {});
it("returns 400 on state mismatch", async () => {});
```

- [ ] **Step 2: 실패 확인** — Run: `pnpm vitest run src/lib/instagram-oauth.test.ts src/lib/instagram-bio-anchor.test.ts src/app/api/oauth/instagram` → FAIL.

- [ ] **Step 3: `instagram-oauth.ts` 구현** — `threads-oauth.ts`를 그대로 본뜬다 (`readJson`/`getString`/`getNumber`/`isRecord` 패턴). 단기 토큰 교환은 `application/x-www-form-urlencoded` body. `getInstagramProfile`은 `user_id`를 `userId`로 쓴다 (게시에 쓰는 IG 계정 id — 첫 실호출에서 확인).

- [ ] **Step 4: `instagram-bio-anchor.ts` 구현** — anchor Post: `status: "ANCHOR"`, `postCategory: "INSTAGRAM_BIO"`, `content: "[instagram bio anchor]"`, `scheduledAt: new Date()`. 저장된 id의 Post가 없으면 새로 만든다. `brandConfig` 저장은 `serializeBrandConfigUpdate(brand.brandConfig, { instagram: { ...current, bioAnchorPostId } })`. `buildInstagramBioLink`는 `buildTrackedUrl(new URL("/start", websiteUrl).toString(), { postId, source: "instagram" })`.

- [ ] **Step 5: 라우트 구현** — `oauth/threads/start`·`callback`을 복제해 쿠키 이름 `instagram_oauth`, 환경변수 `INSTAGRAM_APP_ID`/`INSTAGRAM_APP_SECRET`(없으면 500 JSON), 콜백 경로 `/api/oauth/instagram/callback`. 콜백 저장 필드: `instagramAccessToken: encrypt(token)`, `instagramUserId`, `instagramUsername`, `instagramTokenExpiry`, `instagramConnectedAt`(이미 값이 있으면 유지 — 재연결 때 과거 릴스가 올라가지 않게). 그다음 `ensureInstagramBioAnchor(brand.id)`. 성공 리디렉트 `/brands/${slug}/settings?instagram=connected`, 실패 `/brands?instagram=connection_failed`.

- [ ] **Step 6: 통과 확인** — Step 2 명령 → PASS. `pnpm typecheck` 통과.

- [ ] **Step 7: 커밋**

```bash
git add src/lib/instagram-oauth.ts src/lib/instagram-oauth.test.ts src/lib/instagram-bio-anchor.ts src/lib/instagram-bio-anchor.test.ts src/app/api/oauth/instagram
git commit -m "feat: 인스타 OAuth 연결과 바이오 기준 글 추가"
```

---

### Task 4: `ANCHOR` 글이 Threads 로직에 섞이지 않게 막기

**Files (점검 대상 — status 조건 없이 `prisma.post.findMany/findFirst/count/aggregate/groupBy`를 쓰는 곳):**
`src/app/api/interactions/route.ts`, `src/app/api/posts/route.ts`, `src/app/api/brands/[id]/health/route.ts`, `src/app/api/brands/[id]/voice/route.ts`, `src/app/api/growth/route.ts`, `src/app/api/growth/scorecard/route.ts`, `src/app/api/generate/optimize/route.ts`, `src/app/api/campaigns/summary/route.ts`, `src/app/api/cron/refill/route.ts`, `src/app/api/cron/feedback/route.ts`, `src/app/api/cron/publish/route.ts`(읽기만, 수정 금지), `src/app/api/cron/fetch-metrics/route.ts`, `src/app/api/analytics/route.ts`, `src/lib/generate-posts.ts`, `src/lib/viral-service.ts`, `src/lib/growth-service.ts`, `src/lib/account-intelligence.ts`, `src/lib/length-experiment.ts`, `src/lib/threads/reply-mention-engine.ts`, `src/lib/promo/promo-post-service.ts`

**Interfaces:**
- Consumes: `INSTAGRAM_BIO_ANCHOR_STATUS` (Task 3).

- [ ] **Step 1: 각 쿼리 분류** — `where.status`가 `"PUBLISHED"`/`"PENDING"`/`in: [...]`처럼 **포함 목록**이면 안전(손대지 않음). status 조건이 없거나 `not`/`notIn`이면 `ANCHOR`가 섞인다 → 목록화.

- [ ] **Step 2: 대표 실패 테스트 작성** — `src/app/api/posts/route.test.ts`(대시보드 글 목록)와 refill 백로그 카운트 테스트에, prisma mock에 전달된 `where`가 `status`로 `"ANCHOR"`를 제외하는지 검증:

```ts
expect(findMany.mock.calls[0][0].where).toMatchObject({ status: { not: "ANCHOR" } }); // 또는 notIn에 "ANCHOR" 포함
```

- [ ] **Step 3: 실패 확인** — Run: `pnpm vitest run src/app/api/posts src/app/api/cron/refill` → FAIL.

- [ ] **Step 4: Step 1 목록의 쿼리마다 제외 조건 추가** — status 조건이 없으면 `status: { not: INSTAGRAM_BIO_ANCHOR_STATUS }`, 기존 `notIn`이면 배열에 추가. `publish/route.ts`는 포함 목록만 쓰므로 수정하지 않는다 (Step 1에서 확인 결과를 커밋 메시지 본문에 남긴다).

- [ ] **Step 5: 전체 테스트** — Run: `pnpm test` → 모두 PASS.

- [ ] **Step 6: 커밋**

```bash
git add <Step 4에서 수정한 파일들> src/app/api/posts/route.test.ts src/app/api/cron/refill/route.test.ts
git commit -m "fix: 인스타 바이오 기준 글을 Threads 쿼리에서 제외"
```

---

### Task 5: 인스타 Graph API 클라이언트 + 토큰 갱신

**Files:**
- Create: `src/lib/instagram-api.ts`, `src/lib/instagram-api.test.ts`
- Modify: `src/app/api/cron/refresh-token/route.ts`, `src/app/api/cron/refresh-token/route.test.ts`

**Interfaces:**
- Consumes: `INSTAGRAM_GRAPH_BASE`, `refreshInstagramLongLivedToken` (Task 3), `isTokenRefreshDue` (`@/lib/threads-api`), `decryptToken`/`encrypt`.
- Produces:
  ```ts
  export interface InstagramCredentials { accessToken: string; userId: string }
  export type InstagramContainerStatus = "IN_PROGRESS" | "FINISHED" | "ERROR" | "EXPIRED" | "PUBLISHED";
  export async function createReelsContainer(credentials: InstagramCredentials, input: { videoUrl: string; caption: string }): Promise<string>;
  export async function getContainerStatus(containerId: string, accessToken: string): Promise<InstagramContainerStatus>;
  export async function publishContainer(credentials: InstagramCredentials, containerId: string): Promise<string>; // media id
  export async function getRemainingPublishQuota(credentials: InstagramCredentials): Promise<number | null>; // 응답을 못 읽으면 null
  export async function getFreshInstagramCredentials(brandId: string): Promise<InstagramCredentials | null>; // 미연결·만료면 null
  export async function refreshBrandInstagramToken(brandId: string): Promise<{ accessToken: string; expiresIn: number }>;
  ```

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
it("creates a REELS container with share_to_feed", async () => { /* POST {base}/{userId}/media, media_type=REELS, video_url, caption, share_to_feed=true → id */ });
it("maps status_code to InstagramContainerStatus", async () => { /* FINISHED */ });
it("throws on unknown status_code", async () => {});
it("publishes with creation_id", async () => { /* POST {base}/{userId}/media_publish → id */ });
it("returns remaining quota as quota_total - quota_usage", async () => {
  // 응답 { data: [{ quota_usage: 3, config: { quota_total: 50 } }] } → 47
});
it("returns null quota when the response shape is unexpected", async () => {});
it("returns null credentials when token is missing or expired", async () => {});
// refresh-token/route.test.ts
it("refreshes an Instagram token that is due and skips expired ones", async () => {
  // instagramTokenExpiry 5일 남음 → refreshBrandInstagramToken 호출, -1일 → 호출 없음 + 결과에 instagramNeedsReconnect: true
});
it("alerts once for an Instagram token that expired within the last 24h", async () => {
  // 만료 2시간 전 → sendSystemAlert 1회, 만료 3일 전(이미 알린 것) → 알림 없음
});
```

- [ ] **Step 2: 실패 확인** — Run: `pnpm vitest run src/lib/instagram-api.test.ts src/app/api/cron/refresh-token` → FAIL.

- [ ] **Step 3: 구현** — 요청 파라미터는 `URLSearchParams` (Threads publisher와 같은 방식). 에러는 `Instagram API Error (<단계>): <message>`. `getFreshInstagramCredentials`는 `getFreshBrandCredentials`(`threads-api.ts:336`)를 본뜨되 미연결·만료 시 throw 대신 `null`. 갱신 기한이면 `refreshBrandInstagramToken`으로 갱신 후 DB에 `encrypt`해 저장.

- [ ] **Step 4: refresh-token 라우트에 인스타 루프 추가** — 기존 Threads 루프 뒤에 같은 구조로. 만료된 토큰은 결과에 `instagramNeedsReconnect: true`이고, 만료 시각이 최근 24시간 안이면(하루 1회 cron이라 사실상 첫 발견) `sendSystemAlert` 한 번. 갱신 실패는 기존처럼 `success: false`와 알림. 함수 20줄 제한 때문에 인스타 부분은 `refreshInstagramTokens(brands, now)` 헬퍼로 뺀다.

- [ ] **Step 5: 통과 확인** — Step 2 명령 → PASS. `pnpm typecheck` 통과.

- [ ] **Step 6: 커밋**

```bash
git add src/lib/instagram-api.ts src/lib/instagram-api.test.ts src/app/api/cron/refresh-token/route.ts src/app/api/cron/refresh-token/route.test.ts
git commit -m "feat: 인스타 Graph API 클라이언트와 토큰 갱신 추가"
```

---

### Task 6: 릴스 교차 발행 로직 + cron 라우트

**Files:**
- Create: `src/lib/instagram-reels-sync.ts`, `src/lib/instagram-reels-sync.test.ts`
- Create: `src/app/api/cron/instagram-publish/route.ts`, `src/app/api/cron/instagram-publish/route.test.ts`

**Interfaces:**
- Consumes: Task 5 전부, `isVideoMediaUrl`, `startOfPublishDay`, `sendSystemAlert`, `parseBrandConfig`, `verifyCronSecret`.
- Produces:
  ```ts
  export const INSTAGRAM_CAPTION_MAX = 2200;
  export const INSTAGRAM_MAX_ATTEMPTS = 3;
  export const REEL_STALE_MS = 3 * 24 * 60 * 60 * 1000;
  export function buildInstagramCaption(content: string, captionSuffix: string): string;
  export function selectReelCandidate<T extends { imageUrls: string; publishedAt: Date | null }>(posts: T[], options: { connectedAt: Date; now: Date }): T | null;
  export interface ReelsTickResult { advanced: number; published: string[]; started: string | null; skippedStale: number; failed: string[] }
  export async function runInstagramReelsTick(brand: { id: string; name: string; brandConfig: string; instagramConnectedAt: Date }, credentials: InstagramCredentials, now: Date): Promise<ReelsTickResult>;
  ```

`runInstagramReelsTick` 순서 (이 순서가 테스트 대상):
1. **진행 중 처리** — `instagramStatus = "PROCESSING"`인 글마다: `instagramContainerId`가 null이면 실패 1회 처리. 아니면 상태 조회 → `FINISHED`: `publishContainer` → `PUBLISHED` + `instagramMediaId` + `instagramPublishedAt = now`. `IN_PROGRESS`: 그대로. `ERROR`/`EXPIRED`/예외: 실패 1회 처리.
   - 실패 1회 처리 = `instagramAttempts + 1`; 3 미만이면 `instagramStatus = null`, `instagramContainerId = null` (다음 틱에 재시작); 3이면 `FAILED` + `instagramError` + `sendSystemAlert`.
2. **오래된 글 정리** — `status = "PUBLISHED"`, `instagramStatus = null`, `publishedAt >= connectedAt`, `publishedAt < now - REEL_STALE_MS`인 영상 글 → `SKIPPED` (영상 여부는 코드에서 `isVideoMediaUrl`로 거른 id 목록에 `updateMany`).
3. **새로 시작** — 오늘(KST) `instagramPublishedAt`이 있는 글이 있거나, 1단계 후에도 `PROCESSING` 글이 남아 있으면 종료. 남은 한도(`getRemainingPublishQuota`)가 0이면 종료 (`null`이면 진행). 아니면 최근 3일 `PUBLISHED`·`instagramStatus = null` 글에서 `selectReelCandidate`(가장 먼저 발행된 것) → **원자적 선점** `prisma.post.updateMany({ where: { id, instagramStatus: null }, data: { instagramStatus: "PROCESSING" } })`, `count === 0`이면 종료 → `createReelsContainer` → `instagramContainerId` 저장. 생성 실패는 실패 1회 처리.

- [ ] **Step 1: 실패하는 테스트 작성** (prisma는 `vi.mock`, Graph 함수는 `@/lib/instagram-api` mock)

```ts
it("buildInstagramCaption appends the suffix after a blank line", () => {
  expect(buildInstagramCaption("본문", "꼬리")).toBe("본문\n\n꼬리");
  expect(buildInstagramCaption("본문", "")).toBe("본문");
});
it("buildInstagramCaption keeps the suffix and trims the body to 2200 chars", () => {
  const caption = buildInstagramCaption("가".repeat(3000), "꼬리");
  expect(caption.length).toBe(2200);
  expect(caption.endsWith("\n\n꼬리")).toBe(true);
});
it("selectReelCandidate ignores posts published before connectedAt, older than 3 days, or without video", () => {});
it("selectReelCandidate picks the earliest published video", () => {});
it("publishes a FINISHED container and records media id", async () => {});
it("leaves IN_PROGRESS containers alone and starts nothing new", async () => {});
it("recovers a claim without container as one failed attempt", async () => {
  // PROCESSING + containerId null + attempts 0 → update { instagramStatus: null, instagramAttempts: 1 }
});
it("marks FAILED and alerts on the third failure", async () => {});
it("starts nothing when a reel was already published today (KST)", async () => {});
it("starts nothing when remaining quota is 0", async () => {});
it("claims atomically and stops when another run claimed first", async () => {
  // updateMany → { count: 0 } → createReelsContainer 호출 없음
});
it("marks unposted reels older than 3 days as SKIPPED", async () => {});
// route.test.ts
it("returns 401 without cron secret", async () => {});
it("skips brands with no Instagram credentials and still returns 200", async () => {});
it("one brand throwing does not stop the others", async () => {});
```

- [ ] **Step 2: 실패 확인** — Run: `pnpm vitest run src/lib/instagram-reels-sync.test.ts src/app/api/cron/instagram-publish` → FAIL.

- [ ] **Step 3: `instagram-reels-sync.ts` 구현** — 위 순서대로. 단계마다 20줄 미만 함수로 분리 (`advanceProcessingReels`, `skipStaleReels`, `startNextReel`, `recordReelFailure`). 캡션은 `parseBrandConfig(brand.brandConfig).instagram.captionSuffix`.

- [ ] **Step 4: 라우트 구현** — `verifyCronSecret` → `brands` 쿼리 파라미터(쉼표 구분 slug, 없으면 인스타 연결된 전 브랜드) → `instagramConnectedAt`이 있는 브랜드마다 `getFreshInstagramCredentials` (null이면 `skipped: "not_connected"`) → `runInstagramReelsTick`. 브랜드별 try/catch, 예외는 `sendSystemAlert` 후 계속. `export const maxDuration = 60`. 응답 `{ results: [...] }`.

- [ ] **Step 5: 통과 확인** — Step 2 명령 → PASS. `pnpm test` 전체 PASS, `pnpm typecheck`, `pnpm lint` 통과.

- [ ] **Step 6: 커밋**

```bash
git add src/lib/instagram-reels-sync.ts src/lib/instagram-reels-sync.test.ts src/app/api/cron/instagram-publish
git commit -m "feat: 인스타 릴스 교차 발행 cron 추가"
```

---

### Task 7: 스케줄러 · 설정 화면 · 문서

**Files:**
- Modify: `cloudflare/scheduler/worker.js` (`ROUTES["*/15 * * * *"]`)
- Modify: `src/app/brands/[slug]/settings/page.tsx`, `src/components/BrandSettingsForm.tsx`
- Modify: `docs/api-spec.md`, `docs/ops/external-scheduler.md`

**Interfaces:**
- Consumes: `buildInstagramBioLink` (Task 3), Task 2 `InstagramConfig`.

- [ ] **Step 1: 스케줄러에 경로 추가** — `"*/15 * * * *"` 배열에 `"/api/cron/instagram-publish?brands=cosmicpath"`. GitHub Actions `cron.yml`에는 추가하지 않는다.

Run: `node --test cloudflare/scheduler/worker.test.mjs` → PASS.

- [ ] **Step 2: 설정 페이지에 인스타 연결 상태 전달** — `page.tsx`가 `initialData.instagram = { username, tokenExpiry(YYYY-MM-DD | null), needsReconnect: expiry < now, bioLink: anchorId ? buildInstagramBioLink(config.websiteUrl, anchorId) : null, clicks, conversions }`을 넘긴다. `clicks`/`conversions`는 기준 글(`bioAnchorPostId`) Post의 값 (없으면 0) — spec §8의 "인스타 합계". 토큰은 절대 넘기지 않는다.

- [ ] **Step 3: `BrandSettingsForm`에 "Instagram 연결" 섹션 추가** — Threads 연결 블록(`handleThreadsReconnect`, 349~395행) 옆에 같은 스타일로: 연결 버튼(`/api/oauth/instagram/start?brandId=`), `@username`·만료일, `needsReconnect`면 "재연결 필요" 경고, "인스타 합계: 클릭 N · 전환 N", 바이오 링크 + 복사 버튼(`navigator.clipboard.writeText`), 캡션 꼬리말 입력(`instagram.captionSuffix`, 기존 저장 흐름으로 `brandConfig`에 저장). 연결 전에는 버튼과 안내 문구만.

- [ ] **Step 4: 화면 확인** — `preview_start`로 dev 서버를 띄워 `/brands/cosmicpath/settings`에서 섹션이 보이고 콘솔 에러가 없는지, 꼬리말 저장 후 새로고침해도 유지되는지 확인.

- [ ] **Step 5: 문서 갱신** — `docs/api-spec.md`: Non-goals의 "X/Instagram 외부 플랫폼 연동"을 "X 연동 / Instagram 스토리·DM·지표(3단계)"로 바꾸고, `GET /api/oauth/instagram/start`, `GET /api/oauth/instagram/callback`, `GET /api/cron/instagram-publish` 명세와 `Post`/`Brand` 새 필드를 추가. `docs/ops/external-scheduler.md`에 인스타 cron 한 줄.

- [ ] **Step 6: 전체 확인 후 커밋** — Run: `pnpm test && pnpm typecheck && pnpm lint` → 통과.

```bash
git add cloudflare/scheduler/worker.js src/app/brands/[slug]/settings/page.tsx src/components/BrandSettingsForm.tsx docs/api-spec.md docs/ops/external-scheduler.md
git commit -m "feat: 인스타 연결 설정 화면과 스케줄 추가"
```

---

### Task 8: 실제 계정 연결·검증 (사용자와 함께)

자동화된 테스트가 못 덮는 외부 의존 부분. 각 단계는 사용자 승인 후 진행.

- [ ] **Step 1 (사용자):** 인스타 계정 생성 → 프로페셔널 계정 전환. Meta 앱에 Instagram 제품 추가, 리디렉트 URI `https://thread-uploader.vercel.app/api/oauth/instagram/callback` 등록. Threads 앱 재사용이 안 되면 새 Business 앱 생성. `INSTAGRAM_APP_ID`/`INSTAGRAM_APP_SECRET`을 Vercel 환경변수와 `.env.local`에 설정.
- [ ] **Step 2 (승인 후):** 프로덕션 DB에 `pnpm prisma migrate deploy`.
- [ ] **Step 3 (승인 후):** PR 머지·배포, `cloudflare/scheduler`에서 `npx wrangler deploy`.
- [ ] **Step 4:** 설정 페이지에서 인스타 연결 → `@username` 표시, 바이오 링크 생성 확인. 사용자가 바이오 링크를 프로필에 붙여넣음.
- [ ] **Step 5:** 다음 Threads 릴스 발행 후 `/api/cron/instagram-publish` 로그에서 `started` → 다음 틱 `published` 확인, 실제 인스타에 릴스 노출 확인. `Post.instagramStatus = "PUBLISHED"`.
- [ ] **Step 6:** 바이오 링크를 한 번 클릭 → 기준 글 `clicks` 증가 확인 (CosmicPath 사이트가 `pid`를 웹훅으로 넘기는지 검증).
- [ ] **Step 7:** 결과를 spec §9의 "확인 필요" 항목(App Review 불필요 여부, `user_id` 사용, 한도 응답 구조)에 기록하고 커밋.
