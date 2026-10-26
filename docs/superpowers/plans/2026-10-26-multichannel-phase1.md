# 멀티 채널 구조 1단계 (구조 정리 + 기존 데이터 이전) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `BrandGroup`·`ChannelAccount`·`Publication` 테이블을 추가하고, 기존 Threads·인스타 게시 이력과 앞으로의 게시를 `Publication`에도 같이 기록한 뒤, 학습 입력을 Threads `Publication` 지표로 전환한다. 발행 동작은 하나도 바뀌지 않는다.

**Architecture:** 새 테이블은 "거울(mirror)"로 시작한다. 기존 `Post` 칸이 계속 진짜 값이고, 쓰는 지점 바로 뒤에서 `Post`를 다시 읽어 `Publication`으로 옮겨 적는다(`mirrorThreadsFromPost`, `mirrorInstagramFromPost`). 거울 쓰기가 실패해도 발행은 절대 실패하지 않는다. 과거 데이터는 같은 거울 함수를 도는 백필 라우트로 채우고, 패리티 라우트로 차이가 0인지 확인한다.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma 5 + Postgres, Vitest 4

**Spec:** `docs/superpowers/specs/2026-10-26-multichannel-structure-design.md`

## Global Constraints

- 발행 동작 불변: 글 고르기(`pickPublishCandidate`, 길이 실험 포함), Threads 발행 속도 규칙, 인스타 후보 고르기(`selectReelCandidate`)를 바꾸지 않는다.
- `Post.status`의 의미와 값은 바꾸지 않는다(스펙 4.2).
- 기존 칸(`Brand.instagram*`, `Post.instagram*`, Threads 전용 칸)은 삭제하지 않는다(스펙 4.5-5).
- 거울 쓰기 실패는 `console.error("[publication-mirror] …")`로 남기고 삼키지 않되, 호출한 발행 흐름에는 던지지 않는다.
- DB 마이그레이션 적용(`prisma migrate deploy`)과 운영 DB 백필 실행(`?apply=1`)은 **사용자 승인 후**에만 한다. git push도 승인 후.
- 새 라이브러리 설치 금지. 명령은 `pnpm`으로 실행한다(`pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm exec prisma …`).
- 크론·관리 라우트는 `verifyCronSecret`(`src/lib/cron-auth.ts`) Bearer 인증을 쓴다.
- 커밋 메시지는 conventional commits + 한국어(예: `feat: 게시 거울 기록 추가`). 브랜치는 `feat/multichannel-structure`.
- `any` 금지, `unknown` + 좁히기.

## Spec와 다른 점 (사용자 확인 필요)

1. **Threads·인스타 토큰은 1단계에서 `ChannelAccount`로 복사하지 않는다.** 토큰을 쓰는 곳이 6군데(Threads/인스타 OAuth 콜백, `brands` POST/PATCH, `refresh-token` 크론, 발행 시 갱신)라서, 복사하면 갱신 때마다 두 값이 어긋난다. 1단계 `ChannelAccount`(threads/instagram)는 계정 식별 정보(`externalUserId`, `handle`, `connectedAt`)만 담고, 토큰은 계속 `Brand` 칸에서 읽는다. 토큰 이전은 기존 칸 정리 단계에서 한다. 새 채널(2단계)은 처음부터 `ChannelAccount`에 토큰을 저장한다.
2. **화면이 `Publication`을 읽는 전환은 2단계로 미룬다.** 1단계에는 새 화면 요소가 없고, 채널별 배지는 2단계에서 처음 생긴다.
3. **`ChannelAdapter` 인터페이스(스펙 4.3)는 2단계에서 만든다.** 1단계에는 쓰는 곳이 없다.

## Review Focus

1. 거울 쓰기(`prisma.publication.upsert`)가 실패해도 `publishOrResumePost`는 성공 결과를 그대로 돌려준다 → Task 3 테스트.
2. 부분 실패 후 재개(`PARTIAL_FAILED` → 재개 → `PUBLISHED`)해도 `Publication`은 한 줄이고 상태만 바뀐다(`@@unique([postId, channelAccountId])` + upsert) → Task 2 테스트.
3. Threads 사용자 ID 없이 레거시 토큰만 있는 브랜드도 Threads 계정 줄이 하나만 생긴다(`externalUserId` null) → Task 2 테스트.
4. 백필을 두 번 돌려도 새로 생기는 줄이 0개다 → Task 5 테스트.
5. Threads에서 삭제돼 `ARCHIVED`된 글은 `Publication`도 `ARCHIVED`, `threadsId` 없이 `ARCHIVED`된 글(regate)은 `Publication`이 생기지 않는다 → Task 2 테스트.

---

### Task 1: 스키마와 마이그레이션

**Files:**
- Modify: `prisma/schema.prisma` (`User`, `Brand`, `Post` 관계 추가, 새 모델 3개)
- Create: `prisma/migrations/20261026000000_add_multichannel_structure/migration.sql`

**Interfaces:**
- Produces: Prisma 모델 `BrandGroup`, `ChannelAccount`, `Publication`(필드는 스펙 4.2 그대로), `Brand.groupId String?`, `Brand.group BrandGroup?`, `Brand.marketLabel String?`, `Brand.locale String?`, `Brand.channelAccounts ChannelAccount[]`, `Post.publications Publication[]`, `User.brandGroups BrandGroup[]`.

- [ ] **Step 1: 스키마 수정**

스펙 4.2의 모델을 그대로 넣는다. 추가로 `Brand`에 `@@index([groupId])`, `Publication`에 `@@index([postId])`. 관계는 `onDelete` 기본값(Restrict)을 쓴다.

- [ ] **Step 2: 마이그레이션 SQL 생성 (DB 접속 없이)**

```bash
git show main:prisma/schema.prisma > /private/tmp/claude-501/old-schema.prisma
pnpm exec prisma migrate diff --from-schema-datamodel /private/tmp/claude-501/old-schema.prisma --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/20261026000000_add_multichannel_structure/migration.sql
```

Expected: `CREATE TABLE "BrandGroup"`, `"ChannelAccount"`, `"Publication"`과 `ALTER TABLE "Brand" ADD COLUMN "groupId"`… 만 들어 있고 `DROP`이 하나도 없다(`grep -c DROP` = 0).

- [ ] **Step 3: 검증**

Run: `pnpm exec prisma validate && pnpm exec prisma generate && pnpm typecheck`
Expected: 모두 성공.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20261026000000_add_multichannel_structure/migration.sql
git commit -m "feat: 브랜드 그룹·채널 계정·게시 테이블 추가"
```

마이그레이션 **적용은 이 태스크에서 하지 않는다.** 롤아웃 절차(맨 아래)에서 승인 후 적용한다.

---

### Task 2: 게시 거울 모듈

**Files:**
- Create: `src/lib/channels/publication-mirror.ts`
- Test: `src/lib/channels/publication-mirror.test.ts`

**Interfaces:**
- Consumes: Task 1의 Prisma 모델.
- Produces:
  - `type ChannelPlatform = "threads" | "instagram"` (2단계에서 확장)
  - `type PublicationStatus = "QUEUED" | "READY_MANUAL" | "PUBLISHING" | "PUBLISHED" | "FAILED" | "SKIPPED" | "ARCHIVED"`
  - `interface PublicationMirror { status: PublicationStatus; externalId: string | null; publishedAt: Date | null; platformData: Record<string, unknown>; attempts: number; errorLog: string | null; views: number | null; likes: number | null; replies: number | null; reposts: number | null; metricsAt: Date | null }`
  - `threadsPublicationFromPost(post: ThreadsMirrorPost): PublicationMirror | null` (순수)
  - `instagramPublicationFromPost(post: InstagramMirrorPost): PublicationMirror | null` (순수)
  - `ensureLegacyChannelAccount(brandId: string, platform: ChannelPlatform): Promise<string>` (계정 id 반환)
  - `mirrorThreadsFromPost(postId: string): Promise<void>` (절대 throw 안 함)
  - `mirrorInstagramFromPost(postId: string): Promise<void>` (절대 throw 안 함)
  - `ThreadsMirrorPost` = `Post`에서 `id, brandId, status, threadsId, publishedAt, errorLog, threadRootId, threadPartIds, threadPartsPosted, threadTotalParts, views, likes, replies, reposts, metricsAt`를 고른 타입. `InstagramMirrorPost` = `id, brandId, instagramStatus, instagramContainerId, instagramMediaId, instagramPublishedAt, instagramAttempts, instagramError`.

**상태 매핑 (이 표가 정답이다):**

| Threads (`Post.status`) | 조건 | `Publication.status` |
|---|---|---|
| `PUBLISHED` | — | `PUBLISHED` |
| `PUBLISHING`, `PARTIAL_PUBLISHED` | — | `PUBLISHING` |
| `PARTIAL_FAILED`, `FAILED` | `threadsId` 있음 | `FAILED` |
| `ARCHIVED` | `threadsId` 있음 | `ARCHIVED` |
| 그 밖의 모든 경우 | — | `null` (거울 안 만듦) |

| 인스타 (`Post.instagramStatus`) | 조건 | `Publication.status` |
|---|---|---|
| `PROCESSING` | — | `PUBLISHING` |
| `PUBLISHED` / `FAILED` / `SKIPPED` | — | 같은 이름 |
| `null` | `instagramAttempts > 0` (재시도 대기) | `QUEUED` |
| `null` | `instagramAttempts = 0` | `null` |

Threads `platformData` = `{ threadRootId, threadPartIds: string[] (JSON 파싱, 실패 시 []), threadPartsPosted, threadTotalParts }`, `externalId` = `threadsId`, 지표 4개·`metricsAt`·`errorLog`·`publishedAt`은 그대로 복사. 인스타 `platformData` = `{ containerId }`, `externalId` = `instagramMediaId`, `publishedAt` = `instagramPublishedAt`, `attempts` = `instagramAttempts`, `errorLog` = `instagramError`, 지표는 null.

- [ ] **Step 1: 실패하는 테스트 작성** (`vi.mock("@/lib/prisma")`, 기존 `fetch-metrics/route.test.ts` 방식)

```ts
describe("threadsPublicationFromPost", () => {
  it("maps PUBLISHED with parts and metrics", () => {
    const m = threadsPublicationFromPost(post({ status: "PUBLISHED", threadsId: "t1", threadPartIds: '["t1","t2"]', views: 120 }));
    expect(m?.status).toBe("PUBLISHED");
    expect(m?.externalId).toBe("t1");
    expect(m?.platformData.threadPartIds).toEqual(["t1", "t2"]);
    expect(m?.views).toBe(120);
  });
  it("maps PARTIAL_PUBLISHED to PUBLISHING", () => expect(threadsPublicationFromPost(post({ status: "PARTIAL_PUBLISHED", threadsId: "t1" }))?.status).toBe("PUBLISHING"));
  it("archives only posts that reached Threads", () => {
    expect(threadsPublicationFromPost(post({ status: "ARCHIVED", threadsId: "t1" }))?.status).toBe("ARCHIVED");
    expect(threadsPublicationFromPost(post({ status: "ARCHIVED", threadsId: null }))).toBeNull();
  });
  it("skips FAILED without a root post and unpublished states", () => {
    expect(threadsPublicationFromPost(post({ status: "FAILED", threadsId: null }))).toBeNull();
    expect(threadsPublicationFromPost(post({ status: "PENDING", threadsId: null }))).toBeNull();
  });
  it("survives malformed threadPartIds", () => expect(threadsPublicationFromPost(post({ status: "PUBLISHED", threadsId: "t1", threadPartIds: "oops" }))?.platformData.threadPartIds).toEqual([]));
});

describe("instagramPublicationFromPost", () => {
  it("maps PROCESSING to PUBLISHING", () => expect(instagramPublicationFromPost(ig({ instagramStatus: "PROCESSING" }))?.status).toBe("PUBLISHING"));
  it("maps a retry reset to QUEUED", () => expect(instagramPublicationFromPost(ig({ instagramStatus: null, instagramAttempts: 1 }))?.status).toBe("QUEUED"));
  it("ignores untouched posts", () => expect(instagramPublicationFromPost(ig({ instagramStatus: null, instagramAttempts: 0 }))).toBeNull());
});

describe("ensureLegacyChannelAccount", () => {
  it("reuses the existing row for a brand without threadsUserId", async () => {
    // brand.findUnique → { threadsUserId: null, accessToken: "enc" }; channelAccount.findFirst → { id: "ca1" }
    await expect(ensureLegacyChannelAccount("b1", "threads")).resolves.toBe("ca1");
    expect(prisma.channelAccount.create).not.toHaveBeenCalled();
  });
});

describe("mirrorThreadsFromPost", () => {
  it("upserts on (postId, channelAccountId) so a resumed publish stays one row", async () => {
    await mirrorThreadsFromPost("p1");
    expect(prisma.publication.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { postId_channelAccountId: { postId: "p1", channelAccountId: "ca1" } },
    }));
  });
  it("logs and swallows a database failure", async () => {
    vi.mocked(prisma.publication.upsert).mockRejectedValueOnce(new Error("db down"));
    await expect(mirrorThreadsFromPost("p1")).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("[publication-mirror]"), expect.anything());
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm exec vitest run src/lib/channels/publication-mirror.test.ts`
Expected: FAIL (모듈 없음)

- [ ] **Step 3: 구현**

`ensureLegacyChannelAccount`: `brand`를 읽어 platform별 식별자(threads: `threadsUserId`, instagram: `instagramUserId`/`instagramUsername`/`instagramConnectedAt`)를 고른 뒤 `channelAccount.findFirst({ where: { brandId, platform } })`가 있으면 그 id, 없으면 `mode: "direct"`로 create. 토큰 칸은 비워 둔다(Spec와 다른 점 1). `mirror*FromPost`: post를 읽고 → 매핑이 null이면 종료 → 계정 id 확보 → `publication.upsert`(create/update 모두 매핑 값). 전체를 try/catch로 감싸 `console.error("[publication-mirror] threads", postId, error)`.

- [ ] **Step 4: 통과 확인**

Run: `pnpm exec vitest run src/lib/channels/publication-mirror.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/channels/publication-mirror.ts src/lib/channels/publication-mirror.test.ts
git commit -m "feat: Threads·인스타 게시를 Publication에 거울 기록하는 모듈 추가"
```

---

### Task 3: Threads 발행·지표 경로에 거울 연결

**Files:**
- Modify: `src/lib/threads/thread-resume-engine.ts:29` (`publishOrResumePost`)
- Modify: `src/app/api/cron/fetch-metrics/route.ts:95-115` (지표 저장, 삭제 글 `ARCHIVED`)
- Test: `src/lib/threads/thread-resume-engine.test.ts`, `src/app/api/cron/fetch-metrics/route.test.ts`

**Interfaces:**
- Consumes: `mirrorThreadsFromPost(postId: string): Promise<void>` (Task 2)

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// thread-resume-engine.test.ts — publication-mirror를 vi.mock
it("mirrors the final post state after a successful publish", async () => {
  const result = await publishOrResumePost("p1", creds);
  expect(result.success).toBe(true);
  expect(mirrorThreadsFromPost).toHaveBeenCalledWith("p1");
});
it("mirrors after a partial failure too", async () => { /* 2번째 파트 실패 */ expect(mirrorThreadsFromPost).toHaveBeenCalledWith("p1"); });

// fetch-metrics/route.test.ts
it("mirrors metrics after updating a post", async () => { await GET(req); expect(mirrorThreadsFromPost).toHaveBeenCalledWith("p1"); });
it("mirrors the archive when Threads reports the post deleted", async () => { /* 400 does not exist */ expect(mirrorThreadsFromPost).toHaveBeenCalledWith("p1"); });
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm exec vitest run src/lib/threads/thread-resume-engine.test.ts src/app/api/cron/fetch-metrics/route.test.ts`
Expected: FAIL (`mirrorThreadsFromPost` not called)

- [ ] **Step 3: 구현**

`publishOrResumePost`는 락을 잡은 뒤의 본문을 `try { … } finally { await mirrorThreadsFromPost(postId); }`로 감싼다(락 획득 실패로 throw하는 경로는 제외 — 거기선 상태를 바꾸지 않았다). fetch-metrics는 두 `prisma.post.update` 바로 뒤에 `await mirrorThreadsFromPost(post.id)`.

- [ ] **Step 4: 통과 확인 + 기존 발행 테스트 회귀**

Run: `pnpm exec vitest run src/lib/threads src/app/api/cron/publish src/app/api/cron/fetch-metrics src/app/api/posts`
Expected: PASS (기존 `lock.test.ts`, `length-experiment.test.ts` 포함)

- [ ] **Step 5: Commit**

```bash
git add src/lib/threads/thread-resume-engine.ts src/lib/threads/thread-resume-engine.test.ts src/app/api/cron/fetch-metrics/route.ts src/app/api/cron/fetch-metrics/route.test.ts
git commit -m "feat: Threads 발행·지표 수집 뒤 Publication 거울 기록"
```

---

### Task 4: 인스타 릴스 경로에 거울 연결

**Files:**
- Modify: `src/lib/instagram-reels-sync.ts:80-92` (`runInstagramReelsTick`)
- Test: `src/lib/instagram-reels-sync.test.ts`

**Interfaces:**
- Consumes: `mirrorInstagramFromPost(postId: string): Promise<void>` (Task 2)
- Produces: `mirrorRecentInstagram(brandId: string, now: Date): Promise<void>` in `src/lib/channels/publication-mirror.ts` — `instagramStatus != null` 또는 `instagramAttempts > 0`이고 `publishedAt >= now - REEL_STALE_MS - 1일`인 글마다 `mirrorInstagramFromPost`.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
it("mirrors recent instagram posts at the end of every tick", async () => {
  await runInstagramReelsTick(brand, creds, now);
  expect(mirrorRecentInstagram).toHaveBeenCalledWith(brand.id, now);
});
it("still mirrors when the tick published nothing", async () => { /* 후보 없음 */ expect(mirrorRecentInstagram).toHaveBeenCalledTimes(1); });
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm exec vitest run src/lib/instagram-reels-sync.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현** — `mirrorRecentInstagram`을 publication-mirror에 추가(테스트는 Task 2 파일에 "고르는 글 범위" 1개 추가), `runInstagramReelsTick` 반환 직전에 `await mirrorRecentInstagram(brand.id, now)`. 틱 하나에 상태 쓰기가 6군데라 개별 호출 대신 틱 끝 한 번으로 모은다.

- [ ] **Step 4: 통과 확인**

Run: `pnpm exec vitest run src/lib/instagram-reels-sync.test.ts src/lib/channels src/app/api/cron/instagram-publish`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/instagram-reels-sync.ts src/lib/instagram-reels-sync.test.ts src/lib/channels/publication-mirror.ts src/lib/channels/publication-mirror.test.ts
git commit -m "feat: 인스타 릴스 틱 끝에 Publication 거울 기록"
```

---

### Task 5: 백필 라우트 (브랜드 그룹 + 계정 + 과거 게시)

**Files:**
- Create: `src/lib/channels/backfill.ts`, `src/lib/channels/backfill.test.ts`
- Create: `src/app/api/cron/backfill-channel-structure/route.ts`

**Interfaces:**
- Consumes: `ensureLegacyChannelAccount`, `mirrorThreadsFromPost`, `mirrorInstagramFromPost` (Task 2)
- Produces:
  - `planBrandGrouping(brands: { id: string; slug: string; name: string; ownerId: string; groupId: string | null }[]): GroupPlan[]` (순수) — `GroupPlan = { slug: string; name: string; ownerId: string; markets: { brandId: string; marketLabel: string | null; locale: string | null }[] }`
  - `runChannelBackfill(options: { apply: boolean }): Promise<BackfillReport>` — `BackfillReport = { groupsToCreate: number; accountsToCreate: number; threadsPosts: number; instagramPosts: number; applied: boolean }`
  - `GET /api/cron/backfill-channel-structure` (기본 dry-run, `?apply=1`일 때만 쓰기), `verifyCronSecret` 필수.

**그룹 규칙 (스펙 4.1, 4.5-2):** `cosmicpath`와 `cosmicpath-global`은 한 그룹 `{ slug: "cosmicpath", name: "CosmicPath" }`, 라벨/언어는 각각 `("국내","ko")`, `("해외","en")`. 그 밖의 브랜드는 자기 slug·name으로 마켓 1개짜리 그룹(라벨·언어 null). `groupId`가 이미 있는 브랜드는 건너뛴다.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
it("groups the two CosmicPath accounts into one brand", () => {
  const plan = planBrandGrouping([b("cosmicpath"), b("cosmicpath-global"), b("catchdex")]);
  expect(plan).toHaveLength(2);
  expect(plan.find((g) => g.slug === "cosmicpath")?.markets).toEqual([
    { brandId: "cosmicpath", marketLabel: "국내", locale: "ko" },
    { brandId: "cosmicpath-global", marketLabel: "해외", locale: "en" },
  ]);
});
it("is a no-op for brands that already have a group", () => expect(planBrandGrouping([b("cosmicpath", { groupId: "g1" })])).toEqual([]));
it("dry-run writes nothing", async () => {
  const report = await runChannelBackfill({ apply: false });
  expect(report.applied).toBe(false);
  expect(prisma.brandGroup.create).not.toHaveBeenCalled();
  expect(mirrorThreadsFromPost).not.toHaveBeenCalled();
});
it("a second apply creates nothing new", async () => { /* 모든 브랜드 groupId 있음, 계정 있음 */ const r = await runChannelBackfill({ apply: true }); expect(r.groupsToCreate).toBe(0); expect(r.accountsToCreate).toBe(0); });
it("rejects calls without the cron secret", async () => expect((await GET(new Request("http://x/api/cron/backfill-channel-structure"))).status).toBe(401));
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm exec vitest run src/lib/channels/backfill.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현** — 그룹 생성과 `Brand` 연결은 그룹마다 `prisma.$transaction`. 계정: Threads는 `accessToken` 또는 `threadsUserId`가 있는 브랜드, 인스타는 `instagramConnectedAt`이 있는 브랜드. 게시: `threadsId != null`인 글 전부 `mirrorThreadsFromPost`, `instagramStatus != null`인 글 전부 `mirrorInstagramFromPost`(순서대로, 동시 실행 없음). 라우트 위에 `// ponytail: one-off backfill route; delete in the legacy-column cleanup phase` 주석.

- [ ] **Step 4: 통과 확인**

Run: `pnpm exec vitest run src/lib/channels`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/channels/backfill.ts src/lib/channels/backfill.test.ts src/app/api/cron/backfill-channel-structure/route.ts
git commit -m "feat: 브랜드 그룹·채널 계정·과거 게시 백필 라우트 추가"
```

---

### Task 6: 패리티 확인 라우트

**Files:**
- Create: `src/lib/channels/parity.ts`, `src/lib/channels/parity.test.ts`
- Create: `src/app/api/cron/publication-parity/route.ts`

**Interfaces:**
- Consumes: `threadsPublicationFromPost`, `instagramPublicationFromPost` (Task 2)
- Produces:
  - `comparePublication(expected: PublicationMirror | null, actual: { status: string; externalId: string | null; views: number | null } | null): string[]` (순수, 차이 설명 목록. 같으면 `[]`)
  - `GET /api/cron/publication-parity` → `{ checked: number; mismatches: { postId: string; platform: ChannelPlatform; diffs: string[] }[] }`, 읽기 전용, `verifyCronSecret` 필수. 최근 30일 `publishedAt` 글만 본다.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
it("reports nothing when the mirror matches", () => expect(comparePublication(mirror({ status: "PUBLISHED", externalId: "t1", views: 5 }), { status: "PUBLISHED", externalId: "t1", views: 5 })).toEqual([]));
it("reports a missing mirror row", () => expect(comparePublication(mirror({ status: "PUBLISHED" }), null)).toEqual(["missing publication"]));
it("reports drifted views", () => expect(comparePublication(mirror({ views: 5 }), { status: "PUBLISHED", externalId: "t1", views: 4 })).toEqual(["views 5 != 4"]));
it("reports a stray row when no mirror is expected", () => expect(comparePublication(null, { status: "PUBLISHED", externalId: "t1", views: null })).toEqual(["unexpected publication"]));
```

- [ ] **Step 2~4: 실패 확인 → 구현 → 통과**

Run: `pnpm exec vitest run src/lib/channels/parity.test.ts`
Expected: 처음 FAIL, 구현 후 PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/channels/parity.ts src/lib/channels/parity.test.ts src/app/api/cron/publication-parity/route.ts
git commit -m "feat: Post와 Publication 패리티 확인 라우트 추가"
```

---

### Task 7: 학습 입력을 Threads Publication 지표로 전환

**Files:**
- Modify: `src/lib/growth-service.ts:31-45` (`learnBrandGrowth`의 `prisma.post.findMany`)
- Create: `src/lib/channels/learning-metrics.ts`, `src/lib/channels/learning-metrics.test.ts`

**Interfaces:**
- Produces: `withThreadsMetrics<T extends { views: number | null; likes: number | null; replies: number | null; reposts: number | null; metricsAt: Date | null }>(post: T & { publications: { views: number | null; likes: number | null; replies: number | null; reposts: number | null; metricsAt: Date | null }[] }): T` — Threads publication이 있고 `metricsAt`이 있으면 지표 4개와 `metricsAt`을 그 값으로 덮고, 없으면 `Post` 값을 그대로 둔다. 반환값에 `publications`는 없다.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
it("uses the Threads publication metrics when present", () => expect(withThreadsMetrics(p({ views: 10, publications: [pub({ views: 99, metricsAt: d })] })).views).toBe(99));
it("falls back to post metrics when the mirror is missing", () => expect(withThreadsMetrics(p({ views: 10, publications: [] })).views).toBe(10));
it("ignores a publication that has no metrics yet", () => expect(withThreadsMetrics(p({ views: 10, publications: [pub({ views: null, metricsAt: null })] })).views).toBe(10));
it("drops the publications field", () => expect("publications" in withThreadsMetrics(p({ publications: [] }))).toBe(false));
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm exec vitest run src/lib/channels/learning-metrics.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현** — `learnBrandGrowth`의 `findMany`에 `include: { publications: { where: { channelAccount: { platform: "threads" } }, take: 1 } }`를 넣고, 결과를 `.map(withThreadsMetrics)`한 뒤 기존 흐름에 넘긴다. 다른 줄은 바꾸지 않는다.

- [ ] **Step 4: 통과 확인 + 학습 회귀**

Run: `pnpm exec vitest run src/lib/channels src/lib/growth-service.test.ts src/lib/growth-learning.test.ts src/lib/growth-feedback-loop.test.ts`
Expected: PASS (기존 growth 테스트는 publications가 빈 배열이므로 결과 동일)

- [ ] **Step 5: 전체 검증**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`
Expected: 모두 성공

- [ ] **Step 6: Commit**

```bash
git add src/lib/channels/learning-metrics.ts src/lib/channels/learning-metrics.test.ts src/lib/growth-service.ts
git commit -m "feat: 학습 입력을 Threads Publication 지표 기준으로 전환"
```

---

### Task 8: 학습 입력 차이 보고 + 거울 실패 경보 (실행 중 추가, 2026-10-26)

> 다른 세션의 검토 의견 2개를 받아 추가했다. (1) 학습은 Thompson 샘플링(`thompson-sampling-router.ts`의 `Math.random`) 때문에 같은 입력이어도 결과가 매번 달라서, 롤아웃 6단계는 출력이 아니라 **입력**을 비교해야 한다. (2) 거울 쓰기 실패가 `console.error`뿐이라 조용히 비어 갈 수 있다.

**Files:**
- Create: `src/lib/channels/learning-input-diff.ts`, `src/lib/channels/learning-input-diff.test.ts`
- Modify: `src/lib/growth-service.ts` (`learnBrandGrowth` 반환값에 차이 요약 추가), 필요하면 `src/app/api/cron/learn/route.ts` (응답에 브랜드별 요약이 실리게)
- Modify: `src/lib/channels/publication-mirror.ts` (catch 3곳), `src/lib/channels/publication-mirror.test.ts`

**Interfaces:**
- Consumes: Task 7의 `include: { publications: … }` 결과(같은 쿼리 한 번)
- Produces:
  - `diffLearningInputs(posts: { id: string; views: number | null; likes: number | null; replies: number | null; reposts: number | null; publications?: { views: number | null; likes: number | null; replies: number | null; reposts: number | null; metricsAt: Date | null }[] }[]): { missing: string[]; changed: { postId: string; fields: string[] }[] }` — `missing` = 지표가 든 Threads publication이 없는 글(대체로 Post 값 사용), `changed` = publication 지표 4개 중 Post와 다른 필드가 있는 글. `metricsAt`은 비교하지 않는다(Task 7 판정: 학습은 `metricsAt`을 Post에서 읽는다).
  - `learnBrandGrowth` 반환 객체에 `learningInputDiff: { missing: number; changed: number; changedPostIds: string[] }` (`changedPostIds`는 최대 20개)

- [ ] **Step 1: 실패하는 테스트**: 같은 값이면 `{ missing: [], changed: [] }`; publication 없음 → `missing`; `views` 다름 → `changed: [{ postId, fields: ["views"] }]`; publication `metricsAt` null → `missing`. 거울: `upsert` 실패 시 `sendSystemAlert`가 `{ level: "warning", title: "Publication write failed" }`로 한 번 호출되고, `sendSystemAlert` 자체가 reject해도 `mirrorThreadsFromPost`는 resolve한다.
- [ ] **Step 2: 실패 확인** — `pnpm exec vitest run src/lib/channels`
- [ ] **Step 3: 구현** — 거울 catch에서 `console.error` 뒤에 `await sendSystemAlert({ level: "warning", title: "Publication write failed", message: \`${platform} ${postId}: ${message}\` }).catch(() => false)`, 그 위에 `// ponytail: add a cooldown if it gets noisy`. `learnBrandGrowth`는 `withThreadsMetrics`를 적용하기 **전에** `diffLearningInputs`를 계산한다.
- [ ] **Step 4: 전체 검증** — `pnpm test && pnpm typecheck && pnpm lint`
- [ ] **Step 5: Commit** — `feat: 학습 입력 차이 보고와 게시 거울 실패 경보 추가`

---

## 롤아웃 절차 (코드 완료 후, 단계마다 사용자 승인)

1. **승인 요청 → 마이그레이션 적용**: `pnpm exec prisma migrate deploy` (운영 DB). 새 테이블·칸 추가만 있고 삭제는 없음을 다시 보여 준 뒤 실행.
2. **승인 요청 → push·배포**: `feat/multichannel-structure` push → PR → Vercel 프리뷰 확인 → main 머지. 마이그레이션이 먼저 적용돼 있어야 한다(새 코드가 새 테이블을 쓴다).
3. **백필 dry-run**: `curl -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/backfill-channel-structure"` → 그룹 2개 이상, Threads 게시 수가 DB의 `threadsId` 있는 글 수와 같은지 확인.
4. **승인 요청 → 백필 적용**: 같은 주소에 `?apply=1`. 한 번 더 돌려 `groupsToCreate: 0, accountsToCreate: 0` 확인.
5. **패리티 2일 관찰**: `/api/cron/publication-parity`를 배포 직후, 다음 날, 그다음 날 호출해 `mismatches: []` 확인. 그동안 Threads 국내 5슬롯·해외 2슬롯·인스타 하루 1개가 평소대로 올라가고 중복 0건인지 확인.
6. **학습 입력 비교**: 학습 결과(`formulaWeights`)는 Thompson 샘플링 때문에 같은 입력이어도 매번 달라서 비교 기준이 될 수 없다. 대신 learn 크론(UTC 12:00) 응답의 브랜드별 `learningInputDiff`가 두 마켓 모두 **연속 2회 `changed: 0`**인지 본다(`missing`은 백필 전 글이면 0이 아닐 수 있고, 그 글은 Post 값을 그대로 쓴다). `changed`가 0이 아니면 Task 7 커밋을 되돌리고 패리티부터 다시 본다.
