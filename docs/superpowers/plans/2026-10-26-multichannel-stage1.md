# 멀티 채널 1단계 (구조 정리 + 이전) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `BrandGroup`·`ChannelAccount`·`Publication` 테이블을 추가하고, Threads·인스타 발행과 지표가 기존 칸과 `Publication`에 같이 쓰이며, 학습 입력이 `Publication` 기준으로 바뀌어도 결과가 같다는 것을 확인한다.

**Architecture:** 기존 발행 경로(`/api/cron/publish` → `thread-resume-engine`, `instagram-reels-sync`, `fetch-metrics`)는 그대로 두고, 상태가 바뀌는 지점마다 `src/lib/channels/publication-store.ts`의 기록 함수를 한 줄씩 끼운다. 기록 함수는 절대 던지지 않는다(실패하면 경보만). 과거 이력은 멱등한 백필 스크립트가 채운다. 학습은 두 경로의 입력을 매일 비교한 뒤 `Publication` 경로로 바꾼다.

**Tech Stack:** Next.js App Router, TypeScript strict, Prisma 5.22 (PostgreSQL), vitest, pnpm, Node 22.

**Spec:** `docs/superpowers/specs/2026-10-26-multichannel-structure-design.md` (4.1, 4.2, 4.5의 1~4단계, 6의 "1. 구조 정리 + 이전")

## 설계 문서에서 벗어난 결정 (빌더 판단, 근거 포함)

1. **토큰을 `ChannelAccount`로 복사하지 않는다.** 설계 4.5-2는 "기존 토큰 복사"라고 했지만, 토큰 갱신(`refreshBrandAccessToken`, `refreshAndStoreToken`)은 `Brand` 칸에만 쓴다. 복사본은 다음 갱신 때 낡아서 "만료 토큰으로 발행 시도"라는 새 장애를 만든다. 1단계 `ChannelAccount`는 `externalUserId`·`handle`·`connectedAt`만 채우고 `accessToken`은 null이다. 토큰 이동은 4.5-5 정리 단계(별도 승인)에서 갱신 코드와 함께 옮긴다.
2. **"학습 결과 일치"는 출력이 아니라 입력으로 비교한다.** `thompson-sampling-router.ts`가 `Math.random`을 쓰므로 같은 입력도 출력(`formulaWeights`)이 매번 다르다. 학습은 입력(글 ID 집합 + 지표 값)의 순수 함수이므로, 두 경로의 입력이 같으면 결과가 같다. 비교는 매일 학습 크론 안에서 돌고 차이가 있으면 경보를 보낸다.
3. **채널 어댑터 인터페이스(4.3), 인스타 후보 고르기 통합(4.4-4), 화면(4.7)은 2단계로 미룬다.** 1단계에는 호출자가 없어 죽은 코드가 된다. 2단계 채널 발행 크론이 첫 호출자다.

## Global Constraints

- 패키지 매니저는 pnpm만. 새 라이브러리 없음(설계 5).
- `any` 금지, `unknown` + 좁히기. 타입 단언 대신 Prisma 타입 사용.
- DB 마이그레이션 적용(`prisma migrate deploy`), git push는 사용자 승인 후. 백필 스크립트는 `--dry-run` 결과를 보인 뒤 실행.
- 비밀값은 `.env.local`에만. `ChannelAccount.accessToken`은 1단계에서 항상 null.
- 기록 함수(`publication-store.ts`)는 어떤 경우에도 throw하지 않는다. 실패 조건 "발행이 하루라도 멈추는 것"을 막는 핵심 규칙.
- `Post.status`의 의미와 읽기 지점 25개는 건드리지 않는다(설계 4.2 [내 판단]).
- 기존 칸(`Brand.instagram*`, `Post.instagram*`, Threads 전용 칸) 삭제 금지.
- 커밋은 conventional commits + 한국어, 파일 이름을 지정해 `git add`. 브랜치 `feat/multichannel-structure`에서 작업.
- `Publication.status` 값: `QUEUED | READY_MANUAL | PUBLISHING | PUBLISHED | FAILED | SKIPPED | ARCHIVED`.
- `ChannelAccount.platform` 값: 1단계는 `threads | instagram`. `mode`는 둘 다 `direct`.

## Review Focus

1. 백필 뒤 새로 연결된 브랜드(계정 행 없음)의 첫 발행: 기록 함수가 `ChannelAccount`를 그 자리에서 만들고 `Publication`을 남겨야 한다. 조용히 버리면 안 된다. → Task 2 테스트 "creates the threads account on first write".
2. DB가 `Publication` 테이블을 아직 모를 때(마이그레이션 전 배포, DB 장애)의 Threads 발행: 기록 실패가 발행 결과를 바꾸면 안 된다. → Task 2 테스트 "never throws".
3. 백필을 두 번 돌리기: 행 수가 같고, Threads 미연결 브랜드(`catchdex`)는 계정도 게시도 없어야 한다. `PARTIAL_FAILED` 글은 `PUBLISHED`로 적히면 안 된다. → Task 5 테스트.
4. 인스타 실패 후 재시도 리셋(`instagramStatus` → null): `Publication`은 `FAILED`가 아니라 `QUEUED`로 돌아가야 하고, 같은 글·같은 계정 행은 하나여야 한다. → Task 4 테스트.
5. `fetch-metrics`가 `Post` 지표는 썼는데 `Publication` 지표 쓰기가 실패한 경우: 비교가 `changed`로 잡아야 하고, 차이가 0이 되기 전에는 학습 입력을 바꾸면 안 된다. → Task 6 테스트, Task 7 게이트.

---

### Task 1: 스키마 확장 (BrandGroup, ChannelAccount, Publication)

**Files:**
- Modify: `prisma/schema.prisma` (`User`, `Brand`, `Post` 모델에 관계 추가, 새 모델 3개)
- Create: `prisma/migrations/20261027000000_add_multichannel_structure/migration.sql`

**Interfaces:**
- Produces: Prisma 모델 `BrandGroup`, `ChannelAccount`, `Publication`. 복합 유니크 `ChannelAccount.brandId_platform_externalUserId`, `Publication.postId_channelAccountId`. 뒤 Task들은 `prisma.brandGroup`, `prisma.channelAccount`, `prisma.publication`을 이 이름으로 쓴다.

- [ ] **Step 1: 스키마에 모델 추가**

설계 4.2의 초안을 그대로 쓰되 아래만 다르다.
- `Brand`에 추가: `groupId String?`, `group BrandGroup? @relation(fields: [groupId], references: [id])`, `marketLabel String?`, `locale String?`, `channelAccounts ChannelAccount[]`, `@@index([groupId])`.
- `User`에 추가: `brandGroups BrandGroup[]`.
- `Post`에 추가: `publications Publication[]`.
- `ChannelAccount.externalUserId`는 `String` (필수). 유니크 키에 들어가는 칸이 null이면 Postgres가 중복을 못 막는다.
- `Publication.mediaUrls`, `platformData`, `ChannelAccount.settings`는 설계대로 `String @default("[]")`/`@default("{}")` (기존 `imageUrls`, `brandConfig`와 같은 JSON 문자열 방식).

- [ ] **Step 2: 스키마 검증과 클라이언트 생성**

Run: `pnpm prisma validate && pnpm prisma generate`
Expected: 둘 다 에러 없이 끝남.

- [ ] **Step 3: 마이그레이션 SQL 생성 (DB 연결 없이)**

```bash
git show HEAD:prisma/schema.prisma > /tmp/schema-before.prisma
mkdir -p prisma/migrations/20261027000000_add_multichannel_structure
pnpm prisma migrate diff --from-schema-datamodel /tmp/schema-before.prisma --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/20261027000000_add_multichannel_structure/migration.sql
```

생성된 SQL을 읽고 확인: `CREATE TABLE` 3개, `ALTER TABLE "Brand" ADD COLUMN` 3개, `DROP` 문 0개.

- [ ] **Step 4: 타입 검사**

Run: `pnpm typecheck`
Expected: 에러 0.

- [ ] **Step 5: 커밋**

```bash
git add prisma/schema.prisma prisma/migrations/20261027000000_add_multichannel_structure/migration.sql
git commit -m "feat(db): BrandGroup·ChannelAccount·Publication 테이블 추가"
```

- [ ] **Step 6: 운영 DB 적용은 사용자 승인 후** (이 Task의 코드는 적용 전에도 동작한다. 기록 함수가 테이블 없음을 경보로만 처리하기 때문.)

사용자에게 SQL 파일 경로와 "DROP 0개, 기존 칸 변경 0개"를 보이고 승인을 받은 뒤:

Run: `pnpm prisma migrate deploy`
Expected: `1 migration applied`.

---

### Task 2: Publication 기록 함수 (절대 던지지 않는 쓰기 층)

**Files:**
- Create: `src/lib/channels/publication-store.ts`
- Test: `src/lib/channels/publication-store.test.ts`

**Interfaces:**
- Consumes: Task 1의 Prisma 모델. `sendSystemAlert` (`@/lib/alert-service`).
- Produces:

```ts
export type ChannelPlatform = "threads" | "instagram";
export type PublicationStatus = "QUEUED" | "READY_MANUAL" | "PUBLISHING" | "PUBLISHED" | "FAILED" | "SKIPPED" | "ARCHIVED";
export type InstagramPublicationState = "PROCESSING" | "RETRY" | "PUBLISHED" | "FAILED" | "SKIPPED";

/** Brand 칸(threadsUserId / instagramUserId+instagramConnectedAt)으로 계정 행을 찾거나 만든다. 미연결이면 null. */
export async function ensureChannelAccount(brandId: string, platform: ChannelPlatform): Promise<{ id: string } | null>;
export async function recordThreadsPublished(postId: string, result: { rootThreadsId: string; partIds: string[] }, publishedAt: Date): Promise<void>;
export async function recordThreadsArchived(postId: string, reason: string): Promise<void>;
export async function recordThreadsMetrics(postId: string, metrics: { views: number; likes: number; replies: number; reposts: number }, metricsAt: Date): Promise<void>;
export async function recordInstagramState(
  postId: string,
  state: InstagramPublicationState,
  detail?: { containerId?: string | null; mediaId?: string | null; error?: string | null; attempts?: number; at?: Date },
): Promise<void>;
```

상태 대응: `PROCESSING → PUBLISHING`, `RETRY → QUEUED`, 나머지는 같은 이름. `platformData`는 Threads가 `{ rootId, partIds }`, 인스타가 `{ containerId }`. Threads `externalId = rootThreadsId`, 인스타 `externalId = mediaId`. `externalUrl`은 1단계에서 null.

- [ ] **Step 1: 실패하는 테스트 작성**

모킹은 `src/lib/instagram-reels-sync.test.ts` 방식(`vi.hoisted` + `vi.mock("@/lib/prisma")`). `prisma.post.findUnique`(brandId 조회), `prisma.brand.findUnique`, `prisma.channelAccount.findUnique/create`, `prisma.publication.upsert`, `sendSystemAlert`를 모킹한다.

```ts
describe("publication-store", () => {
  it("creates the threads account on first write and upserts the publication", async () => {
    // brand: threadsUserId "17841400000", channelAccount.findUnique → null
    await recordThreadsPublished("post_1", { rootThreadsId: "t_root", partIds: ["t_root", "t_2"] }, publishedAt);
    expect(channelAccount.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ brandId: "brand_1", platform: "threads", externalUserId: "17841400000", mode: "direct", accessToken: null }),
    }));
    expect(publication.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { postId_channelAccountId: { postId: "post_1", channelAccountId: "acc_threads" } },
      create: expect.objectContaining({ status: "PUBLISHED", externalId: "t_root", publishedAt, platformData: JSON.stringify({ rootId: "t_root", partIds: ["t_root", "t_2"] }) }),
    }));
  });

  it("returns null and writes nothing when the brand has no threads user id", async () => {
    // brand: threadsUserId null
    await recordThreadsPublished("post_1", { rootThreadsId: "t_root", partIds: ["t_root"] }, publishedAt);
    expect(channelAccount.create).not.toHaveBeenCalled();
    expect(publication.upsert).not.toHaveBeenCalled();
  });

  it("never throws: a prisma failure becomes a warning alert", async () => {
    publication.upsert.mockRejectedValueOnce(new Error('relation "Publication" does not exist'));
    await expect(recordThreadsPublished("post_1", { rootThreadsId: "t_root", partIds: ["t_root"] }, publishedAt)).resolves.toBeUndefined();
    expect(sendSystemAlert).toHaveBeenCalledWith(expect.objectContaining({ level: "warning", title: "Publication write failed" }));
  });

  it("maps instagram RETRY to QUEUED and PROCESSING to PUBLISHING", async () => {
    await recordInstagramState("post_1", "RETRY", { attempts: 1, error: "boom" });
    expect(publication.upsert).toHaveBeenLastCalledWith(expect.objectContaining({ update: expect.objectContaining({ status: "QUEUED", attempts: 1, errorLog: "boom" }) }));
    await recordInstagramState("post_1", "PROCESSING", { containerId: "c1" });
    expect(publication.upsert).toHaveBeenLastCalledWith(expect.objectContaining({ update: expect.objectContaining({ status: "PUBLISHING", platformData: JSON.stringify({ containerId: "c1" }) }) }));
  });

  it("writes metrics and archive without touching externalId", async () => {
    await recordThreadsMetrics("post_1", { views: 10, likes: 1, replies: 2, reposts: 3 }, metricsAt);
    expect(publication.upsert).toHaveBeenLastCalledWith(expect.objectContaining({ update: { views: 10, likes: 1, replies: 2, reposts: 3, metricsAt } }));
    await recordThreadsArchived("post_1", "Deleted on Threads");
    expect(publication.upsert).toHaveBeenLastCalledWith(expect.objectContaining({ update: { status: "ARCHIVED", errorLog: "Deleted on Threads" } }));
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm vitest run src/lib/channels/publication-store.test.ts`
Expected: FAIL, 모듈 없음.

- [ ] **Step 3: 구현**

구조: 내부 `safely(label, fn)`이 모든 export를 감싼다(`try/catch` → `console.error` + `sendSystemAlert({ level: "warning", title: "Publication write failed", message: \`${label} ${postId}: ${msg}\` })`). 내부 `upsertPublication(postId, platform, create, update)`가 `post.findUnique({ select: { brandId } })` → `ensureChannelAccount` → `publication.upsert`를 한다. 인스타 계정의 `handle`은 `instagramUsername`, `connectedAt`은 `instagramConnectedAt`. `upsert`의 `create`에는 `update` 내용 + `postId`, `channelAccountId`가 들어간다(`QUEUED`가 아닌 상태로 바로 생길 수 있어야 백필 전 글도 기록된다).

- [ ] **Step 4: 통과 확인**

Run: `pnpm vitest run src/lib/channels/publication-store.test.ts`
Expected: PASS 5건.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/channels/publication-store.ts src/lib/channels/publication-store.test.ts
git commit -m "feat(channels): Publication 기록 함수 추가 (실패해도 발행을 막지 않음)"
```

---

### Task 3: Threads 경로 같이 쓰기 (발행 완료, 지표, 삭제 아카이브)

**Files:**
- Modify: `src/lib/threads/thread-resume-engine.ts` (완료 분기, `status: "PUBLISHED"` 쓰는 블록 ~145행)
- Modify: `src/app/api/cron/fetch-metrics/route.ts` (지표 update ~95행, `ThreadsPostGoneError` 분기 ~110행)
- Test: `src/lib/threads/thread-resume-engine.test.ts`, `src/app/api/cron/fetch-metrics/route.test.ts`

**Interfaces:**
- Consumes: Task 2의 `recordThreadsPublished`, `recordThreadsMetrics`, `recordThreadsArchived`.

- [ ] **Step 1: 실패하는 테스트 추가**

두 테스트 파일에 `vi.mock("@/lib/channels/publication-store", () => ({ recordThreadsPublished: vi.fn(), recordThreadsMetrics: vi.fn(), recordThreadsArchived: vi.fn() }))`를 추가하고:

```ts
// thread-resume-engine.test.ts — 기존 "publishes a brand new multi-part post..." 케이스 끝에 추가
expect(recordThreadsPublished).toHaveBeenCalledWith("post-1", { rootThreadsId: "th-root-1", partIds: ["th-root-1", "th-part-2", "th-part-3"] }, expect.any(Date));
// 기존 "handles partial failure..." 케이스 끝에 추가
expect(recordThreadsPublished).not.toHaveBeenCalled();

// fetch-metrics/route.test.ts
it("mirrors metrics into the threads publication", async () => {
  await GET(request);
  expect(recordThreadsMetrics).toHaveBeenCalledWith("post_1", { views: 500, likes: 0, replies: 3, reposts: 0 }, expect.any(Date));
});
it("archives the publication when Threads says the post is gone", async () => {
  // fetch → 400 { error: { message: "Object does not exist" } }
  await GET(request);
  expect(recordThreadsArchived).toHaveBeenCalledWith("post_1", expect.stringContaining("Deleted on Threads"));
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm vitest run src/lib/threads/thread-resume-engine.test.ts src/app/api/cron/fetch-metrics/route.test.ts`
Expected: 새 assertion만 FAIL.

- [ ] **Step 3: 구현**

- `thread-resume-engine.ts`: 완료 분기에서 `const publishedAt = new Date()`를 만들어 `prisma.post.update`의 `publishedAt`과 `recordThreadsPublished(postId, { rootThreadsId: result.rootThreadsId, partIds: result.partIds }, publishedAt)`에 같은 값을 넘긴다. `post.update` 다음 줄에 둔다(기존 칸이 먼저).
- `fetch-metrics/route.ts`: `prisma.post.update` 뒤에 `recordThreadsMetrics(post.id, insights, metricsAt)`(같은 `metricsAt` 객체), 아카이브 분기에 `recordThreadsArchived(post.id, \`Deleted on Threads: ${err.message}\`)`.

- [ ] **Step 4: 통과 확인**

Run: `pnpm vitest run src/lib/threads src/app/api/cron/fetch-metrics`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/threads/thread-resume-engine.ts src/lib/threads/thread-resume-engine.test.ts src/app/api/cron/fetch-metrics/route.ts src/app/api/cron/fetch-metrics/route.test.ts
git commit -m "feat(threads): 발행·지표·아카이브를 Publication에도 기록"
```

---

### Task 4: 인스타 경로 같이 쓰기

**Files:**
- Modify: `src/lib/instagram-reels-sync.ts` (`markReelPublished`, `recordPublishFailure`, `recordReelFailure`, `markReelFailed`, `skipStaleReels`, `claimNextReel`, `createContainerForReel`)
- Test: `src/lib/instagram-reels-sync.test.ts`

**Interfaces:**
- Consumes: Task 2의 `recordInstagramState`.

상태 대응표 (기존 `instagramStatus` 쓰기 → `recordInstagramState`):

| 기존 쓰기 지점 | 호출 |
|---|---|
| `createContainerForReel` 컨테이너 ID 저장 (클레임 직후라 클레임 자체는 따로 기록하지 않음) | `("PROCESSING", { containerId })` |
| `markReelPublished` | `("PUBLISHED", { mediaId, at: now })` |
| `recordPublishFailure` (재시도 유지) | `("PROCESSING", { attempts, error })` |
| `recordReelFailure` (리셋, 다음 틱 재시도) | `("RETRY", { attempts, error })` |
| `markReelFailed` (`count > 0`일 때만) | `("FAILED", { attempts, error })` |
| `skipStaleReels` (`ids` 각각) | `("SKIPPED")` |

- [ ] **Step 1: 실패하는 테스트 추가**

```ts
vi.mock("@/lib/channels/publication-store", () => ({ recordInstagramState: vi.fn() }));

it("mirrors a published reel into the instagram publication", async () => {
  // processing reel c1, getContainerStatus → "FINISHED", publishContainer → "media_1"
  await runInstagramReelsTick(brand, credentials, now);
  expect(recordInstagramState).toHaveBeenCalledWith("reel_1", "PUBLISHED", { mediaId: "media_1", at: now });
});
it("mirrors a reset retry as RETRY, not FAILED", async () => {
  // getContainerStatus → "ERROR", attempts 0 → reset
  await runInstagramReelsTick(brand, credentials, now);
  expect(recordInstagramState).toHaveBeenCalledWith("reel_1", "RETRY", { attempts: 1, error: "Container status ERROR" });
  expect(recordInstagramState).not.toHaveBeenCalledWith("reel_1", "FAILED", expect.anything());
});
it("mirrors stale reels as SKIPPED", async () => {
  // stale: ["old_1"] with VIDEO, updateMany → { count: 1 }
  await runInstagramReelsTick(brand, credentials, now);
  expect(recordInstagramState).toHaveBeenCalledWith("old_1", "SKIPPED");
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm vitest run src/lib/instagram-reels-sync.test.ts`
Expected: 새 3건 FAIL.

- [ ] **Step 3: 구현**

대응표대로 각 `prisma.post.update/updateMany` 바로 뒤에 한 줄씩. `updateMany`로 조건부 쓰기를 하는 곳(`markReelFailed`, `skipStaleReels`)은 `count > 0`인 경우에만 호출한다. `claimNextReel`의 트랜잭션 안에서는 호출하지 않는다(기록 함수가 다른 커넥션을 쓰므로 어드바이저리 락 안에서 부르면 교착 가능). 클레임 실패 뒤 컨테이너 생성도 실패하면 `recordReelFailure`가 `RETRY`를 기록하므로 빠지는 상태가 없다.

- [ ] **Step 4: 통과 확인**

Run: `pnpm vitest run src/lib/instagram-reels-sync.test.ts`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/instagram-reels-sync.ts src/lib/instagram-reels-sync.test.ts
git commit -m "feat(instagram): 릴스 상태 변화를 Publication에도 기록"
```

---

### Task 5: 백필 스크립트 (멱등)

**Files:**
- Create: `scripts/backfill-multichannel.mjs`
- Test: `scripts/backfill-multichannel.test.ts`

**Interfaces:**
- Produces (export, 순수 함수):

```ts
// 입력은 prisma.brand.findMany / prisma.post.findMany 결과를 그대로 넘긴다.
export function planBackfill(input: { brands: BrandRow[]; posts: PostRow[] }): {
  groups: { slug: string; name: string; ownerId: string }[];
  markets: { brandId: string; groupSlug: string; marketLabel: string | null; locale: string | null }[];
  accounts: { brandId: string; platform: "threads" | "instagram"; externalUserId: string; handle: string | null; connectedAt: Date | null }[];
  publications: {
    postId: string; brandId: string; platform: "threads" | "instagram"; status: string;
    externalId: string | null; publishedAt: Date | null; platformData: string; attempts: number; errorLog: string | null;
    views: number | null; likes: number | null; replies: number | null; reposts: number | null; clicks: number | null; metricsAt: Date | null;
  }[];
};
```

규칙(스크립트 상단 상수):
- `GROUP_OF = { cosmicpath: "cosmicpath", "cosmicpath-global": "cosmicpath" }`; 그 외 slug는 자기 slug가 그룹. 그룹 이름은 그룹의 첫 브랜드 `name`(CosmicPath).
- `MARKET_OF = { cosmicpath: ["국내", "ko"], "cosmicpath-global": ["해외", "en"] }`; 그 외는 `[null, null]`.
- threads 계정: `threadsUserId`가 있을 때. instagram 계정: `instagramUserId`와 `instagramConnectedAt`이 둘 다 있을 때.
- Threads 게시: `threadsId`가 있고 `status`가 `PUBLISHED`→`PUBLISHED`, `ARCHIVED`→`ARCHIVED`인 글만. 다른 status(`PARTIAL_FAILED` 등)는 건너뛴다. `platformData = { rootId: threadRootId ?? threadsId, partIds: JSON.parse(threadPartIds) }`, 지표 5칸 + `metricsAt` 복사, `errorLog` 복사.
- 인스타 게시: `instagramStatus`가 `PUBLISHED|FAILED|SKIPPED`→같은 값, `PROCESSING`→`PUBLISHING`, null→없음. `externalId = instagramMediaId`, `publishedAt = instagramPublishedAt`, `platformData = { containerId: instagramContainerId }`, `attempts = instagramAttempts`, `errorLog = instagramError`.
- 계정이 없는 브랜드의 게시는 만들지 않는다.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
import { planBackfill } from "./backfill-multichannel.mjs";

it("groups cosmicpath and cosmicpath-global, gives catchdex its own group", () => {
  const plan = planBackfill({ brands: [kr, global, catchdex], posts: [] });
  expect(plan.groups).toEqual([{ slug: "cosmicpath", name: "CosmicPath", ownerId: "u1" }, { slug: "catchdex", name: "Catchdex", ownerId: "u1" }]);
  expect(plan.markets).toContainEqual({ brandId: kr.id, groupSlug: "cosmicpath", marketLabel: "국내", locale: "ko" });
  expect(plan.markets).toContainEqual({ brandId: global.id, groupSlug: "cosmicpath", marketLabel: "해외", locale: "en" });
});
it("creates no account and no publication for a brand without threadsUserId", () => {
  const plan = planBackfill({ brands: [{ ...catchdex, threadsUserId: null }], posts: [publishedPost(catchdex.id)] });
  expect(plan.accounts).toEqual([]);
  expect(plan.publications).toEqual([]);
});
it("maps post status to publication status and skips partial failures", () => {
  const plan = planBackfill({ brands: [kr], posts: [publishedPost(kr.id, "p1"), { ...publishedPost(kr.id, "p2"), status: "ARCHIVED" }, { ...publishedPost(kr.id, "p3"), status: "PARTIAL_FAILED" }] });
  expect(plan.publications.map((p) => [p.postId, p.status])).toEqual([["p1", "PUBLISHED"], ["p2", "ARCHIVED"]]);
});
it("maps instagram PROCESSING to PUBLISHING", () => {
  const plan = planBackfill({ brands: [kr], posts: [{ ...publishedPost(kr.id, "p1"), instagramStatus: "PROCESSING", instagramContainerId: "c1" }] });
  expect(plan.publications.find((p) => p.platform === "instagram")).toMatchObject({ status: "PUBLISHING", platformData: JSON.stringify({ containerId: "c1" }) });
});
it("is idempotent: planning twice gives the same plan", () => {
  const input = { brands: [kr, global], posts: [publishedPost(kr.id, "p1")] };
  expect(planBackfill(input)).toEqual(planBackfill(input));
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm vitest run scripts/backfill-multichannel.test.ts`
Expected: FAIL, 모듈 없음.

- [ ] **Step 3: 구현**

`planBackfill`은 순수 함수. `main()`은 `--dry-run` 플래그를 읽고, Prisma로 brands/posts를 전부 읽어 `planBackfill`에 넘긴 뒤:
- dry-run: `{ groups, markets, accounts, publications }` 개수와 플랫폼별 상태별 게시 수를 출력하고 끝.
- 실제: `brandGroup.upsert({ where: { slug } })` → `brand.update({ groupId, marketLabel, locale })` → `channelAccount.upsert({ where: { brandId_platform_externalUserId } })`(create에 `mode: "direct"`, `accessToken: null`) → `publication.upsert({ where: { postId_channelAccountId } })`(update에도 같은 값). 순서대로 `for` 루프, 끝에 같은 개수 요약.
- `import.meta.url`과 `process.argv[1]`을 비교해 직접 실행일 때만 `main()`을 돌린다(테스트가 import해도 DB를 건드리지 않게). `scripts/render-tiktok-worker.mjs`가 같은 방식.

- [ ] **Step 4: 통과 확인**

Run: `pnpm vitest run scripts/backfill-multichannel.test.ts`
Expected: PASS 5건.

- [ ] **Step 5: 커밋**

```bash
git add scripts/backfill-multichannel.mjs scripts/backfill-multichannel.test.ts
git commit -m "feat(scripts): 멀티 채널 백필 스크립트 추가 (멱등)"
```

- [ ] **Step 6: 운영 적용 (Task 1 Step 6 마이그레이션 뒤)**

Run: `node scripts/backfill-multichannel.mjs --dry-run`
Expected 예: `groups 3, markets 4, accounts 3(threads 2·3, instagram 1), publications threads PUBLISHED 2xx / ARCHIVED n, instagram PUBLISHED/FAILED/SKIPPED n`. 사용자에게 보이고 실행:

Run: `node scripts/backfill-multichannel.mjs` 두 번.
Expected: 두 번째 실행의 요약이 첫 번째와 같고, 아래 SQL이 0행:

```sql
SELECT "postId", "channelAccountId", COUNT(*) FROM "Publication" GROUP BY 1, 2 HAVING COUNT(*) > 1;
```

---

### Task 6: 학습 입력 두 경로 + 매일 비교

**Files:**
- Create: `src/lib/learning-inputs.ts`
- Test: `src/lib/learning-inputs.test.ts`
- Modify: `src/lib/growth-service.ts:32-46` (`fetchedPosts` 쿼리를 `loadLearningPosts`로 옮김, 비교 추가)
- Modify: `src/app/api/cron/learn/route.ts` (응답에 `publicationInputDiff` 추가)
- Test: `src/lib/growth-service.test.ts`

**Interfaces:**
- Consumes: Task 1의 `prisma.publication`.
- Produces:

```ts
import type { Post } from "@prisma/client";
/** growth-service.ts에 있던 쿼리를 그대로 옮긴 것. 동작 변화 없음. */
export async function loadLearningPosts(brandId: string): Promise<Post[]>;
/** 같은 조건을 Threads Publication에서 읽고, Post 행 위에 Publication의 views/likes/replies/reposts/metricsAt를 덮어쓴 Post[]를 돌려준다. */
export async function loadLearningPostsFromPublications(brandId: string): Promise<Post[]>;
export interface LearningInputDiff { missing: string[]; extra: string[]; changed: string[] }
/** ID 집합과 (views, likes, replies, reposts, metricsAt) 비교. 순서는 무시한다. */
export function diffLearningInputs(fromPosts: Post[], fromPublications: Post[]): LearningInputDiff;
export function hasLearningInputDiff(diff: LearningInputDiff): boolean;
```

`loadLearningPostsFromPublications` 쿼리:
```ts
prisma.publication.findMany({
  where: {
    channelAccount: { brandId, platform: "threads" },
    status: "PUBLISHED",
    OR: [{ views: { not: null } }, { metricsAt: { not: null } }, { post: { manualPaidConversions: { gt: 0 } } }, { post: { performanceScore: { not: null } } }],
  },
  include: { post: true },
  orderBy: { metricsAt: "desc" },
  take: 300,
})
```
// ponytail: take 300에서 metricsAt이 같은 글의 순서가 두 경로에서 다를 수 있다. 글이 300건을 넘으면 비교가 경계에서 흔들리니 그때 `id`를 2차 정렬로 넣는다.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// learning-inputs.test.ts
it("reports missing, extra and changed ids regardless of order", () => {
  const a = [row("p1", 10), row("p2", 20), row("p3", 30)];
  const b = [row("p3", 30), row("p2", 21), row("p4", 40)];
  expect(diffLearningInputs(a, b)).toEqual({ missing: ["p1"], extra: ["p4"], changed: ["p2"] });
});
it("treats equal metricsAt timestamps as equal even as different Date objects", () => {
  expect(hasLearningInputDiff(diffLearningInputs([row("p1", 10)], [row("p1", 10)]))).toBe(false);
});
it("builds learning rows from publications with publication metrics on top of post fields", async () => {
  // publication.findMany → [{ views: 99, likes: 1, replies: 2, reposts: 3, metricsAt, post: { id: "p1", views: 5, formulaId: "f1", ... } }]
  const rows = await loadLearningPostsFromPublications("brand_1");
  expect(rows[0]).toMatchObject({ id: "p1", formulaId: "f1", views: 99, likes: 1, replies: 2, reposts: 3 });
});

// growth-service.test.ts 추가
it("reports the publication input diff and alerts when it is not empty", async () => {
  // post.findMany → [post("p1","f1",100)], publication.findMany → []
  const result = await learnBrandGrowth("brand_1");
  expect(result.publicationInputDiff).toEqual({ missing: ["p1"], extra: [], changed: [] });
  expect(sendSystemAlert).toHaveBeenCalledWith(expect.objectContaining({ title: "Learning input mismatch" }));
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm vitest run src/lib/learning-inputs.test.ts src/lib/growth-service.test.ts`
Expected: 새 테스트 FAIL.

- [ ] **Step 3: 구현**

- `learning-inputs.ts`: 위 시그니처. `diffLearningInputs`는 `Map<id, row>` 두 개로 비교, `metricsAt`은 `getTime()`으로 비교. 결과 배열은 정렬해서 돌려준다(테스트 결정성).
- `growth-service.ts`: `fetchedPosts = await loadLearningPosts(brandId)` 로 바꾸고, 바로 뒤에 `publicationInputDiff = diffLearningInputs(fetchedPosts, await loadLearningPostsFromPublications(brandId))`. 차이가 있으면 `sendSystemAlert({ level: "warning", title: "Learning input mismatch", message: \`${brandId}: missing ${n} / extra ${n} / changed ${n}\` })`. 반환값에 `publicationInputDiff` 추가. 학습 자체는 계속 `fetchedPosts`(Post 경로)를 쓴다.
- `learn/route.ts`: `results.push`에 `publicationInputDiff: result.publicationInputDiff` 추가.
- `growth-service.ts`는 지금 `sendSystemAlert`를 import하지 않으므로 `@/lib/alert-service`에서 새로 가져온다.
- `growth-service.test.ts`의 prisma 모킹에 `publication: { findMany: mocks.findPublications }`와 `vi.mock("@/lib/alert-service", () => ({ sendSystemAlert: mocks.sendSystemAlert }))`를 추가한다. 기존 테스트는 `findPublications`가 Post와 같은 행을 돌려주도록 기본값을 둔다.

- [ ] **Step 4: 통과 확인**

Run: `pnpm vitest run src/lib/learning-inputs.test.ts src/lib/growth-service.test.ts src/app/api/cron/learn`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/learning-inputs.ts src/lib/learning-inputs.test.ts src/lib/growth-service.ts src/lib/growth-service.test.ts src/app/api/cron/learn/route.ts
git commit -m "feat(learn): 학습 입력을 Post·Publication 두 경로로 읽고 매일 비교"
```

---

### Task 7: 학습 입력을 Publication으로 전환 (게이트 있음)

**게이트:** 운영에서 백필(Task 5 Step 6) 뒤 학습 크론이 **연속 2회** `publicationInputDiff`가 `cosmicpath`, `cosmicpath-global` 모두 `{ missing: [], extra: [], changed: [] }`이고 "Learning input mismatch" 경보가 없어야 시작한다. 확인은 `/api/cron/learn` 응답 또는 워크플로 로그.

**Files:**
- Modify: `src/lib/growth-service.ts` (학습 입력을 `loadLearningPostsFromPublications`로, 비교·경보 제거)
- Modify: `src/lib/learning-inputs.ts` (`loadLearningPosts` 삭제. `diffLearningInputs`는 남긴다: 2단계에서 채널별 학습 분리 때 다시 쓴다)
- Modify: `src/app/api/cron/learn/route.ts` (`publicationInputDiff` 제거)
- Test: `src/lib/growth-service.test.ts` (비교 테스트 삭제, 기존 테스트의 입력 모킹을 `publication.findMany`로)

- [ ] **Step 1: 테스트 수정**

`growth-service.test.ts`의 `mocks.findPosts`를 `mocks.findPublications`로 바꾸고, 각 케이스의 입력을 `{ ...metrics, post: postRow }` 모양으로 바꾼다. "reports the publication input diff" 케이스 삭제.

- [ ] **Step 2: 실패 확인**

Run: `pnpm vitest run src/lib/growth-service.test.ts`
Expected: FAIL (아직 Post 경로를 읽음).

- [ ] **Step 3: 구현**

`fetchedPosts = await loadLearningPostsFromPublications(brandId)`. 비교·경보·`publicationInputDiff` 제거. `loadLearningPosts` 삭제.

- [ ] **Step 4: 전체 검사**

Run: `pnpm test && pnpm typecheck`
Expected: 모두 통과.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/growth-service.ts src/lib/growth-service.test.ts src/lib/learning-inputs.ts src/app/api/cron/learn/route.ts
git commit -m "feat(learn): 학습 입력을 Threads Publication 기준으로 전환"
```

---

### Task 8: 완료 기준 확인과 문서

**Files:**
- Modify: `README.md` (DB 구조 설명에 `BrandGroup`→`Brand`(마켓)→`ChannelAccount`, `Publication` 한 단락)
- Modify: `docs/superpowers/specs/2026-10-26-multichannel-structure-design.md` (상태 줄을 "1단계 구현 완료 YYYY-MM-DD, 토큰 미복사·학습 입력 비교 방식은 계획서 참고"로)

- [ ] **Step 1: 자동 검사**

Run: `pnpm test && pnpm typecheck && pnpm build`
Expected: 모두 통과. 실패하면 여기서 멈추고 고친다.

- [ ] **Step 2: 운영 2일 확인 (설계 6의 1단계 기준)**

배포 뒤 이틀 동안 매일 아래 SQL을 돌린다.

```sql
-- 날짜별 Threads 발행: Post와 Publication 수가 같아야 한다 (국내 5, 해외 2 근처)
SELECT b.slug, date_trunc('day', p."publishedAt" AT TIME ZONE 'Asia/Seoul') AS day,
       COUNT(*) AS posts,
       COUNT(pub.id) AS publications
FROM "Post" p
JOIN "Brand" b ON b.id = p."brandId"
LEFT JOIN "Publication" pub ON pub."postId" = p.id
  AND pub."channelAccountId" IN (SELECT id FROM "ChannelAccount" WHERE platform = 'threads' AND "brandId" = b.id)
WHERE p.status = 'PUBLISHED' AND p."publishedAt" >= now() - interval '2 days'
GROUP BY 1, 2 ORDER BY 1, 2;

-- 중복 0건
SELECT "postId", "channelAccountId", COUNT(*) FROM "Publication" GROUP BY 1, 2 HAVING COUNT(*) > 1;
```

Expected: 매 행 `posts = publications`, 두 번째 쿼리 0행, 인스타 릴스가 평소대로 하루 1개 올라감, "Publication write failed"·"Learning input mismatch" 경보 없음.

- [ ] **Step 3: 문서 갱신과 커밋**

```bash
git add README.md docs/superpowers/specs/2026-10-26-multichannel-structure-design.md
git commit -m "docs: 멀티 채널 1단계 완료 상태와 DB 구조 설명 갱신"
```

- [ ] **Step 4: PR**

사용자 승인 후 `git push -u origin feat/multichannel-structure`, PR 제목 `feat: 멀티 채널 1단계 (구조 정리 + 이전)`.

---

## 배포 순서 (운영 안전)

1. Task 1~6 머지 → Vercel 배포. 이 시점에 DB에 테이블이 없어도 발행은 멈추지 않는다("Publication write failed" 경보만 온다).
2. 사용자 승인 → `pnpm prisma migrate deploy` (Task 1 Step 6).
3. `node scripts/backfill-multichannel.mjs --dry-run` → 확인 → 실행 2회 (Task 5 Step 6).
4. 학습 크론 2회 차이 0 확인 → Task 7 머지.
5. Task 8 운영 2일 확인 → 1단계 완료.

## 1단계에서 하지 않는 것 (2단계로)

- 채널 어댑터 인터페이스(`src/lib/channels/<platform>.ts`), Threads 따라가기 팬아웃(`QUEUED`/`READY_MANUAL` 생성), 채널 발행 크론, X·Bluesky·LinkedIn 연결, 수동 대기열 화면, 브랜드 화면의 마켓 탭.
- 인스타 후보 고르기(`selectReelCandidate`)를 `Publication` 읽기로 바꾸는 것. 채널 발행 크론이 생길 때 같이 옮긴다.
- 토큰 이동과 기존 칸 삭제(설계 4.5-5, 별도 승인).
