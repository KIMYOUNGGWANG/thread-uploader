# 유튜브 쇼츠 급상승 레이더 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 브랜드별로 48시간 안에 올라온 유튜브 쇼츠를 매시간 조회수 스냅샷으로 "시간당 증가" 순서로 보여주는 피드를 만든다.

**Architecture:** 쇼츠 한 편 = 기존 `ViralExample` 행(`source="youtube_shorts"`), 시간별 수치는 새 `ViralExampleSnapshot` 테이블. 수집·스냅샷은 크론 전용 라우트 두 개가 담당하고 기존 `discoverViralExamples`·학습 경로는 건드리지 않는다. 피드는 RSC 페이지가 DB에서 바로 거른다.

**Tech Stack:** Next.js 16 App Router, Prisma 5 + Postgres, YouTube Data API v3 (`fetch`), vitest, GitHub Actions 크론. 패키지 매니저는 이 저장소 관행대로 npm.

**Spec:** `docs/superpowers/specs/2026-10-22-youtube-shorts-radar-design.md`

## Global Constraints

- `any` 금지, `unknown` + 좁히기. 함수 20줄 이하. 축약어 금지(`req`→`request`).
- `docs/api-spec.md`가 단일 진실 공급원. 새 타입·라우트는 Task 1에서 먼저 적는다.
- 스키마 변경(Task 2)은 적용 전 사용자 승인. `prisma migrate dev`는 승인 후에만.
- YouTube 호출은 테스트에서 전부 fixture. 실제 키 호출은 수동 1회.
- `youtube_shorts` 예시는 `learnViralPatterns`·`analyzeTopViralExamples`·`getViralReport`에서 제외.
- 쿼터: 브랜드당 한 번 search ≤ 8회(100유닛) → 약 620유닛. `quotaUsed`를 응답에 포함.
- 기본값: `regions ["KR","GLOBAL"]`, `maxDurationSec 180`, `minViews { kr: 10000, global: 50000 }`, `youtube_shorts` 어댑터 **꺼짐**.
- 보관: `publishedAt < now−7d`인 쇼츠 예시와 스냅샷 삭제.
- 커밋 메시지: conventional commits + 한국어. 브랜치 `feat/youtube-shorts-radar`. `git add`는 파일명 지정.
- 전역 규칙: 작업 시작 전 `superpowers:using-git-worktrees`로 격리 작업공간.

## Review Focus

1. **videos.list가 일부 id를 빼고 돌려줄 때** (삭제·비공개 영상): 빠진 id는 조용히 건너뛰고 나머지는 저장돼야 한다. → Task 4 테스트 `drops ids missing from videos.list`.
2. **ISO 8601 duration에 시간 단위가 있을 때** (`PT1H2M`): 파싱 실패로 0초가 되어 쇼츠로 통과하면 안 된다. → Task 3 테스트 `P1DT2H`.
3. **조회수가 줄어든 스냅샷** (유튜브가 스팸 조회수를 빼는 경우): velocity가 음수로 나오면 안 된다. → Task 3 테스트 `clamps negative velocity to 0`.
4. **키워드가 비고 brand.topics도 빈 브랜드**: search 호출 0회, errors에 "no keywords". → Task 4 테스트.
5. **같은 시(hour)에 스냅샷 크론이 두 번 돌 때** (GitHub Actions 지연 재실행): 유니크 위반으로 라우트가 500을 내면 안 된다. → Task 5 테스트 `skips snapshot already captured this hour`.

---

## File Structure

| 파일 | 책임 |
|---|---|
| `docs/api-spec.md` (수정) | 타입·라우트·스키마 계약 |
| `prisma/schema.prisma` (수정) | `ViralExampleSnapshot`, `ViralExample.country`, 인덱스 |
| `src/types/viral.ts` (수정) | `ViralAdapterId`에 `youtube_shorts` |
| `src/types/brand.ts` (수정) | `ViralDiscoveryConfig.youtube` 타입·기본값·정규화 |
| `src/lib/youtube/duration.ts` (신규) | `parseIsoDuration` |
| `src/lib/youtube/shorts-velocity.ts` (신규) | `calculateShortsVelocity` |
| `src/lib/youtube/youtube-api.ts` (신규) | YouTube REST 호출 래퍼 + 쿼터 카운터 |
| `src/lib/youtube/shorts-harvester.ts` (신규) | 키워드·채널 → `ShortsCandidate[]` |
| `src/lib/youtube/shorts-service.ts` (신규) | `discoverShorts`, `snapshotShorts`, `cleanupShorts`, `saveShortsCandidate` |
| `src/lib/youtube/shorts-feed.ts` (신규) | 피드 where 절 빌더 + 조회 |
| `src/lib/viral-service.ts` (수정) | 학습·리포트에서 쇼츠 제외 |
| `src/lib/viral-llm-analysis.ts` (수정) | 분석에서 쇼츠 제외 |
| `src/app/api/cron/shorts/discover/route.ts` (신규) | 6h 크론 |
| `src/app/api/cron/shorts/snapshot/route.ts` (신규) | 1h 크론 + 정리 |
| `src/app/brands/[slug]/shorts/page.tsx` (신규) | 피드 RSC |
| `src/components/shorts/ShortsFeed.tsx`, `ShortsCard.tsx`, `ShortsFilters.tsx` (신규) | 피드 UI |
| `src/components/BrandSettingsForm.tsx` (수정) | 유튜브 키워드·채널·토글 |
| `src/components/Dashboard.tsx` (수정) | "쇼츠 레이더" 링크 |
| `.github/workflows/shorts.yml` (신규) | 두 스케줄 |
| `.env.example`, `README.md` (수정) | 키·라우트 문서 |
| `src/lib/youtube/__fixtures__/*.json` (신규) | API 응답 fixture |

---

### Task 1: API 계약 먼저 적기

**Files:**
- Modify: `docs/api-spec.md` (Viral Discovery API 절 ~1015행, Cron API 절 ~1130행, Prisma 절 ~1294행)

**Interfaces:**
- Produces: 아래 타입 이름들. 뒤 Task는 이 이름을 그대로 쓴다.

- [ ] **Step 1: `ViralAdapterId` 유니온에 `"youtube_shorts"` 추가**

- [ ] **Step 2: `ViralDiscoveryConfig`에 `youtube` 필드 추가**

```ts
youtube: {
  keywords: string[];
  channelHandles: string[];
  regions: Array<"KR" | "GLOBAL">;
  maxDurationSec: number;
  minViews: { kr: number; global: number };
};
```

- [ ] **Step 3: Cron API 표에 두 행 추가**

| `GET` | `/api/cron/shorts/discover?brands=slug,slug` | 6h. `youtube_shorts` 어댑터가 켜진 브랜드(또는 `brands`)의 키워드·채널에서 48h 내 쇼츠 수집. `brands` 없으면 켜진 브랜드 전부 |
| `GET` | `/api/cron/shorts/snapshot` | 1h. 72h 내 쇼츠 통계 스냅샷 → velocity 갱신 → 7일 지난 쇼츠 삭제 |

그리고 `ShortsCronResponse` 타입(스펙 8절 그대로).

- [ ] **Step 4: Prisma 절에 추가**

```prisma
model ViralExample {
  // 기존 필드 ...
  country   String?
  snapshots ViralExampleSnapshot[]
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
```

- [ ] **Step 5: `docs-contract.test.ts` 통과 확인**

Run: `npm test -- src/docs-contract.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add docs/api-spec.md
git commit -m "docs: 쇼츠 레이더 API 계약 추가"
```

---

### Task 2: 스키마·타입·설정 기본값

**Files:**
- Modify: `prisma/schema.prisma` (`model ViralExample` 132행 근처)
- Modify: `src/types/viral.ts:2`
- Modify: `src/types/brand.ts` (`ViralDiscoveryConfig` 70행, 기본값 199행, `normalizeViralDiscovery` 344행)
- Test: `src/types/brand.test.ts` (없으면 생성)

**Interfaces:**
- Produces: `ViralDiscoveryConfig["youtube"]` (Task 1 모양), `parseBrandConfig(raw).viralDiscovery.youtube`, `prisma.viralExampleSnapshot`.

- [ ] **Step 1: 실패하는 테스트**

```ts
import { parseBrandConfig } from "@/types/brand";

describe("viralDiscovery.youtube", () => {
  it("fills defaults when the stored config predates youtube", () => {
    const config = parseBrandConfig("{}");
    expect(config.viralDiscovery.youtube).toEqual({
      keywords: [], channelHandles: [], regions: ["KR", "GLOBAL"],
      maxDurationSec: 180, minViews: { kr: 10000, global: 50000 },
    });
    expect(config.viralDiscovery.adapters).toContainEqual({ id: "youtube_shorts", enabled: false });
  });

  it("strips @ from channel handles and clamps duration", () => {
    const config = parseBrandConfig(JSON.stringify({
      viralDiscovery: { youtube: { channelHandles: ["@zendi_tarot"], maxDurationSec: 9999, regions: ["KR", "XX"] } },
    }));
    expect(config.viralDiscovery.youtube.channelHandles).toEqual(["zendi_tarot"]);
    expect(config.viralDiscovery.youtube.maxDurationSec).toBe(600);
    expect(config.viralDiscovery.youtube.regions).toEqual(["KR"]);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- src/types/brand.test.ts`
Expected: FAIL (`youtube` undefined)

- [ ] **Step 3: 타입·기본값·정규화 구현**

- `ViralAdapterId`에 `"youtube_shorts"` 추가. `BrandSettingsForm.tsx`의 `adapterLabel`/`adapterDescription`의 `Record<ViralAdapterId, string>`이 깨지므로 거기에 `youtube_shorts: "유튜브 쇼츠"` / `"키워드·채널로 48시간 내 쇼츠 수집 (YOUTUBE_API_KEY 필요)"` 추가.
- `DEFAULT_BRAND_CONFIG.viralDiscovery.adapters`에 `{ id: "youtube_shorts", enabled: false }`, `youtube` 기본값.
- `normalizeYoutubeConfig(input: unknown): ViralDiscoveryConfig["youtube"]` 별도 함수(20줄 규칙). `regions`는 `"KR" | "GLOBAL"`만 통과, 비면 기본값. `maxDurationSec` 범위 15~600. `minViews` 각각 0~10,000,000.

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- src/types/brand.test.ts`
Expected: PASS

- [ ] **Step 5: 스키마 수정 (Task 1 Step 4와 동일 내용)**

- [ ] **Step 6: 사용자 승인 요청 후 마이그레이션**

승인 메시지에 넣을 것: 테이블 1개 추가, `ViralExample`에 nullable 컬럼 1개와 인덱스 1개 추가. 기존 행 변경 없음.

Run (승인 후): `npx prisma migrate dev --name add_shorts_snapshot_and_country`
Expected: `prisma/migrations/<ts>_add_shorts_snapshot_and_country/migration.sql` 생성, `npx prisma generate` 통과

- [ ] **Step 7: 타입체크**

Run: `npm run typecheck`
Expected: 에러 0

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/types/viral.ts src/types/brand.ts src/types/brand.test.ts src/components/BrandSettingsForm.tsx
git commit -m "feat: 쇼츠 스냅샷 스키마와 유튜브 수집 설정 추가"
```

---

### Task 3: 순수 함수 — duration 파싱, velocity

**Files:**
- Create: `src/lib/youtube/duration.ts`, `src/lib/youtube/shorts-velocity.ts`
- Test: `src/lib/youtube/duration.test.ts`, `src/lib/youtube/shorts-velocity.test.ts`

**Interfaces:**
- Produces:
  - `parseIsoDuration(iso: string): number | null` — 초. 파싱 불가면 `null`.
  - `calculateShortsVelocity(input: { snapshots: Array<{ capturedAt: Date; views: number }>; publishedAt: Date; now: Date }): { velocity: number; windowHours: number }` — 스냅샷은 순서 무관.

- [ ] **Step 1: duration 실패 테스트**

```ts
it.each([
  ["PT59S", 59], ["PT1M30S", 90], ["PT3M1S", 181], ["PT1H2M", 3720], ["P1DT2H", 93600],
])("parses %s", (iso, seconds) => expect(parseIsoDuration(iso)).toBe(seconds));
it("returns null for garbage", () => expect(parseIsoDuration("3:01")).toBeNull());
```

- [ ] **Step 2: 실패 확인** — `npm test -- src/lib/youtube/duration.test.ts` → FAIL

- [ ] **Step 3: 구현** — 정규식 `^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$`. 매치 없으면 `null`.

- [ ] **Step 4: 통과 확인** — PASS

- [ ] **Step 5: velocity 실패 테스트**

```ts
const now = new Date("2026-10-22T12:00:00Z");
const at = (hoursAgo: number, views: number) => ({ capturedAt: new Date(now.getTime() - hoursAgo * 36e5), views });

it("uses views per hour since publish when only one snapshot exists", () => {
  expect(calculateShortsVelocity({ snapshots: [at(0, 40000)], publishedAt: new Date(now.getTime() - 4 * 36e5), now }))
    .toEqual({ velocity: 10000, windowHours: 4 });
});
it("uses the oldest snapshot inside the 6h window", () => {
  expect(calculateShortsVelocity({ snapshots: [at(8, 100), at(5, 1000), at(0, 7000)], publishedAt: new Date(now.getTime() - 20 * 36e5), now }))
    .toEqual({ velocity: 1200, windowHours: 5 });
});
it("clamps negative velocity to 0", () => {
  expect(calculateShortsVelocity({ snapshots: [at(2, 5000), at(0, 4000)], publishedAt: new Date(now.getTime() - 10 * 36e5), now }).velocity).toBe(0);
});
it("never divides by less than one hour", () => {
  expect(calculateShortsVelocity({ snapshots: [at(0, 3000)], publishedAt: new Date(now.getTime() - 10 * 60e3), now }))
    .toEqual({ velocity: 3000, windowHours: 1 });
});
```

- [ ] **Step 6: 실패 확인** → FAIL

- [ ] **Step 7: 구현** — 창 = `now − 6h`. 창 안 스냅샷 중 가장 오래된 것과 가장 최신 것의 차를 시간으로 나눔. 창 안에 1개뿐이면 `latest.views / max(1, (now − publishedAt)/1h)`. 결과 `Math.round`, 음수는 0. `windowHours`도 `max(1, …)` 후 소수 첫째자리 반올림.

- [ ] **Step 8: 통과 확인** → PASS

- [ ] **Step 9: Commit**

```bash
git add src/lib/youtube/duration.ts src/lib/youtube/duration.test.ts src/lib/youtube/shorts-velocity.ts src/lib/youtube/shorts-velocity.test.ts
git commit -m "feat: 쇼츠 길이 파싱과 시간당 조회수 증가 계산 추가"
```

---

### Task 4: YouTube API 래퍼 + 수집 어댑터

**Files:**
- Create: `src/lib/youtube/youtube-api.ts`, `src/lib/youtube/shorts-harvester.ts`
- Create: `src/lib/youtube/__fixtures__/search.json`, `videos.json`, `channels.json`, `playlist-items.json`
- Test: `src/lib/youtube/shorts-harvester.test.ts`

**Interfaces:**
- Consumes: `parseIsoDuration` (Task 3), `ViralDiscoveryConfig["youtube"]` (Task 2), `ViralSourceError` (`src/types/viral.ts`).
- Produces:

```ts
// youtube-api.ts
export interface YoutubeClient {
  searchShortIds(input: { query: string; region: "KR" | "GLOBAL"; publishedAfter: Date; maxResults: number }): Promise<Array<{ videoId: string; rank: number }>>;
  listVideos(ids: string[]): Promise<YoutubeVideo[]>;          // 50개 단위로 나눠 호출
  listChannels(ids: string[]): Promise<YoutubeChannel[]>;      // country, uploadsPlaylistId
  resolveHandle(handle: string): Promise<YoutubeChannel | null>;
  recentUploads(uploadsPlaylistId: string, maxResults: number): Promise<string[]>;
  readonly quotaUsed: number;
}
export interface YoutubeVideo { id: string; channelId: string; channelTitle: string; title: string; description: string; publishedAt: Date; durationSec: number | null; thumbnailUrl: string; views: number; likes: number | null; comments: number | null }
export interface YoutubeChannel { id: string; title: string; country: string; uploadsPlaylistId: string }
export function createYoutubeClient(apiKey: string, fetchImpl?: typeof fetch): YoutubeClient;

// shorts-harvester.ts
export interface ShortsCandidate {
  videoId: string; channelId: string; channelTitle: string; title: string; description: string;
  publishedAt: Date; durationSec: number; thumbnailUrl: string; country: string;
  views: number; likes: number | null; comments: number | null;
  searchKeyword: string | null; searchRank: number | null; keywordHits: number;
}
export interface ShortsHarvestResult { candidates: ShortsCandidate[]; errors: ViralSourceError[]; quotaUsed: number }
export async function harvestShorts(input: {
  client: YoutubeClient | null;      // null = 키 없음
  config: ViralDiscoveryConfig["youtube"];
  fallbackKeywords: string[];        // brand.topics
  now: Date;
}): Promise<ShortsHarvestResult>;
```

- [ ] **Step 1: fixture 작성** — 실제 응답 모양대로. `videos.json`에는 길이 45초(쇼츠), 200초(탈락), 그리고 `search.json`에 있지만 `videos.json`엔 없는 id 하나. `channels.json`에 country 있는 채널과 없는 채널.

- [ ] **Step 2: 실패 테스트**

```ts
function fakeClient(overrides: Partial<YoutubeClient> = {}): YoutubeClient { /* fixture 기반 vi.fn, quotaUsed 누적 */ }

it("returns one auth error and no calls when the client is null", async () => {
  const result = await harvestShorts({ client: null, config: defaults, fallbackKeywords: ["사주"], now });
  expect(result.errors).toEqual([{ adapter: "youtube_shorts", source: "auth", message: "YOUTUBE_API_KEY is not set" }]);
  expect(result.candidates).toEqual([]);
});
it("returns a config error when there are no keywords at all", async () => { /* errors[0].source === "config", search 호출 0 */ });
it("falls back to brand topics (max 3) when keywords are empty", async () => { /* searchShortIds 호출 query 검사 */ });
it("drops videos longer than maxDurationSec", async () => { /* 200초 영상 없음 */ });
it("drops ids missing from videos.list", async () => { /* 누락 id 없음, errors 없음 */ });
it("defaults country to UNKNOWN when the channel has none", ...);
it("merges keywordHits and best searchRank when two keywords surface the same video", ...);
it("caps search calls at 8 per run", async () => { /* 키워드 5 × 지역 2 = 10 → 8회만 */ });
it("resolves channel handles once and reads their recent uploads", ...);
```

- [ ] **Step 3: 실패 확인** → FAIL

- [ ] **Step 4: `youtube-api.ts` 구현**

- 베이스 `https://www.googleapis.com/youtube/v3`. `search.list`: `part=id&type=video&videoDuration=short&order=viewCount&publishedAfter=<ISO>&maxResults=25&key=`; KR이면 `&regionCode=KR&relevanceLanguage=ko`. 쿼터 +100.
- `videos.list part=snippet,contentDetails,statistics`, `channels.list part=snippet,contentDetails`, `channels.list forHandle=`, `playlistItems.list part=contentDetails`. 각 +1.
- 응답이 `403`이고 본문에 `quotaExceeded`가 있으면 `YoutubeQuotaError` throw. 그 외 non-2xx는 `Error(\`youtube ${endpoint} ${status}\`)`.
- 응답 파싱은 `unknown` → 타입 가드. `statistics.likeCount`가 없으면 `null`.

- [ ] **Step 5: `shorts-harvester.ts` 구현**

- 키워드 = `config.keywords`가 비면 `fallbackKeywords.slice(0, 3)`. 둘 다 비면 `config` 에러.
- 키워드 × `config.regions` 조합을 순회하되 search 호출 8회 상한. `publishedAfter = now − 48h`.
- 핸들: `resolveHandle` → `recentUploads(uploadsPlaylistId, 10)`. 실패는 `errors`에 `source: "channel:<handle>"`로 넣고 계속.
- id 합집합 → `listVideos` → `durationSec ≤ maxDurationSec`, `publishedAt ≥ now − 48h`. 채널 country는 `listChannels(uniqueChannelIds)`.
- `YoutubeQuotaError`는 잡아서 `errors`에 `source: "quota"`, 지금까지 모은 후보는 그대로 반환.

- [ ] **Step 6: 통과 확인** → PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/youtube/youtube-api.ts src/lib/youtube/shorts-harvester.ts src/lib/youtube/shorts-harvester.test.ts src/lib/youtube/__fixtures__
git commit -m "feat: 유튜브 쇼츠 수집 어댑터 추가"
```

---

### Task 5: 저장·스냅샷·정리 서비스

**Files:**
- Create: `src/lib/youtube/shorts-service.ts`
- Test: `src/lib/youtube/shorts-service.test.ts` (prisma `vi.mock` 패턴: `src/app/api/posts/[id]/route.test.ts` 참고)

**Interfaces:**
- Consumes: `harvestShorts`, `createYoutubeClient` (Task 4), `calculateShortsVelocity` (Task 3), `parseBrandConfig`.
- Produces:

```ts
export const SHORTS_SOURCE = "youtube_shorts";
export async function discoverShorts(brandId: string, now?: Date): Promise<{ discovered: number; saved: number; quotaUsed: number; errors: ViralSourceError[] }>;
export async function snapshotShorts(now?: Date): Promise<{ snapshots: number; quotaUsed: number; errors: ViralSourceError[] }>;   // 모든 브랜드
export async function cleanupShorts(now?: Date): Promise<{ deleted: number }>;
export async function saveShortsCandidate(brandId: string, candidate: ShortsCandidate, now: Date): Promise<void>;  // 내부용, 테스트 위해 export
```

- [ ] **Step 1: 실패 테스트**

```ts
it("creates the example with firstSeenAt and one snapshot on first save", ...);  // upsert create 데이터 검사: source, sourceKey, country, viralScore 0, rawMetrics.firstSeenAt
it("keeps firstSeenAt and discoveredAt on the second save", ...);                 // update 데이터에 discoveredAt·firstSeenAt 없음
it("skips snapshot already captured this hour", ...);                             // snapshot.findFirst가 같은 시각 반환 → create 미호출, throw 없음
it("writes velocityScore and rawMetrics.velocityWindowHours after snapshot", ...);
it("discoverShorts returns the auth error without touching prisma when YOUTUBE_API_KEY is unset", ...);
it("snapshotShorts only reads youtube_shorts examples published within 72h", ...);   // findMany where 검사
it("cleanupShorts deletes youtube_shorts examples older than 7 days only", ...);     // deleteMany where: source, publishedAt lt now−7d
```

- [ ] **Step 2: 실패 확인** → FAIL

- [ ] **Step 3: 구현**

- `saveShortsCandidate`: `content = title + "\n" + description.slice(0, 300)`, `permalink = https://www.youtube.com/shorts/{videoId}`, `authorUsername = channelTitle`. `rawMetrics` 병합은 기존 `mergeStoredRawMetrics` 재사용. 스냅샷: `findFirst({ where: { exampleId, capturedAt: { gte: 이번 시 시작 } } })` 있으면 건너뜀. 그 뒤 최근 6h 스냅샷 `findMany` → `calculateShortsVelocity` → `update({ velocityScore, rawMetrics })`.
- `discoverShorts`: brand 조회 → `parseBrandConfig` → `process.env.YOUTUBE_API_KEY` 없으면 `client: null` → `harvestShorts` → 후보마다 `saveShortsCandidate`.
- `snapshotShorts`: `findMany({ where: { source: SHORTS_SOURCE, publishedAt: { gte: now−72h } }, select: { id, brandId, sourceKey, publishedAt } })` → 50개씩 `listVideos` → 각 예시에 스냅샷 + velocity (`saveShortsCandidate`의 스냅샷 부분을 `recordSnapshot(exampleId, video, now)`로 분리해 공유).
- `cleanupShorts`: `deleteMany({ where: { source: SHORTS_SOURCE, publishedAt: { lt: now−7d } } })`. 스냅샷은 cascade.

- [ ] **Step 4: 통과 확인** → PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/youtube/shorts-service.ts src/lib/youtube/shorts-service.test.ts
git commit -m "feat: 쇼츠 저장·스냅샷·정리 서비스 추가"
```

---

### Task 6: 기존 학습·분석·리포트에서 쇼츠 제외

**Files:**
- Modify: `src/lib/viral-service.ts:62-70` (`getViralReport` findMany·count), `:193-198` (`learnViralPatterns` findMany)
- Modify: `src/lib/viral-llm-analysis.ts:125-130` (`analyzeTopViralExamples` findMany)
- Test: `src/lib/viral-service.test.ts` (없으면 생성), `src/lib/viral-llm-analysis.test.ts` (추가)

**Interfaces:**
- Consumes: `SHORTS_SOURCE` (Task 5).

- [ ] **Step 1: 실패 테스트** — prisma mock으로 `viralExample.findMany`의 `where`에 `source: { not: "youtube_shorts" }`가 들어가는지 세 함수 각각 검사. `getViralReport`는 `count`에도.

- [ ] **Step 2: 실패 확인** → FAIL

- [ ] **Step 3: 구현** — 세 곳의 `where: { brandId }`를 `where: { brandId, source: { not: SHORTS_SOURCE } }`로. `analyzeTopViralExamples`는 기존 `NOT` 조건과 병합.

- [ ] **Step 4: 통과 확인 + 기존 테스트 전부**

Run: `npm test`
Expected: 전부 PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/viral-service.ts src/lib/viral-service.test.ts src/lib/viral-llm-analysis.ts src/lib/viral-llm-analysis.test.ts
git commit -m "fix: Threads 바이럴 학습·분석에서 쇼츠 예시 제외"
```

---

### Task 7: 크론 라우트 + GitHub Actions

**Files:**
- Create: `src/app/api/cron/shorts/discover/route.ts`, `src/app/api/cron/shorts/snapshot/route.ts`
- Create: `.github/workflows/shorts.yml`
- Test: `src/app/api/cron/shorts/discover/route.test.ts`, `src/app/api/cron/shorts/snapshot/route.test.ts`

**Interfaces:**
- Consumes: `discoverShorts`, `snapshotShorts`, `cleanupShorts` (Task 5), `verifyCronSecret`, `parseBrandConfig`, `isAdapterEnabled` (viral-service, export 필요하면 export).
- Produces: `ShortsCronResponse` (Task 1).

- [ ] **Step 1: 실패 테스트**

```ts
// discover
it("returns 401 without the cron secret", ...);
it("runs only brands with youtube_shorts enabled when brands is omitted", ...);   // brand.findMany mock 2개 중 1개만 enabled → discoverShorts 1회
it("limits to ?brands= slugs", ...);
it("keeps going when one brand throws and reports it in errors", ...);
// snapshot
it("calls snapshotShorts then cleanupShorts and returns both counts", ...);
```

- [ ] **Step 2: 실패 확인** → FAIL

- [ ] **Step 3: 라우트 구현** — `src/app/api/cron/trends/route.ts` 구조를 따른다. `export const maxDuration = 300`. 응답 `{ success: true, brands: [...] }`.

- [ ] **Step 4: `shorts.yml`**

```yaml
name: Shorts Radar
on:
  schedule:
    - cron: '7 */6 * * *'    # discover
    - cron: '37 * * * *'     # snapshot
  workflow_dispatch:
    inputs:
      mode: { type: choice, options: [discover, snapshot], default: snapshot }
concurrency: { group: shorts, cancel-in-progress: false }
jobs:
  discover:
    if: github.event.schedule == '7 */6 * * *' || github.event.inputs.mode == 'discover'
    # curl ${APP_URL}/api/cron/shorts/discover?brands=${SHORTS_BRAND_SLUGS}  (vars.SHORTS_BRAND_SLUGS 기본 cosmicpath)
  snapshot:
    if: github.event.schedule == '37 * * * *' || github.event.inputs.mode == 'snapshot'
    # curl ${APP_URL}/api/cron/shorts/snapshot
```

env·curl 옵션은 `trends.yml` 그대로.

- [ ] **Step 5: 통과 확인** → PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/api/cron/shorts .github/workflows/shorts.yml
git commit -m "feat: 쇼츠 수집·스냅샷 크론 라우트와 워크플로 추가"
```

---

### Task 8: 피드 쿼리 + 페이지 + 카드

**Files:**
- Create: `src/lib/youtube/shorts-feed.ts`, `src/app/brands/[slug]/shorts/page.tsx`, `src/components/shorts/ShortsFeed.tsx`, `ShortsCard.tsx`, `ShortsFilters.tsx`
- Modify: `src/components/Dashboard.tsx:884` (TikTok 링크 옆)
- Test: `src/lib/youtube/shorts-feed.test.ts`

**Interfaces:**
- Consumes: `SHORTS_SOURCE`, `ViralDiscoveryConfig["youtube"]["minViews"]`.
- Produces:

```ts
export type ShortsWindow = "24" | "48";
export type ShortsRegion = "kr" | "global" | "all";
export function parseShortsFilters(searchParams: Record<string, string | string[] | undefined>): { window: ShortsWindow; region: ShortsRegion };   // 기본 "24", "kr"
export function buildShortsWhere(input: { brandId: string; window: ShortsWindow; region: ShortsRegion; minViews: { kr: number; global: number }; now: Date }): Prisma.ViralExampleWhereInput;
export async function loadShortsFeed(input: { brandId: string; window: ShortsWindow; region: ShortsRegion; minViews: ...; now?: Date }): Promise<{ items: ShortsFeedItem[]; lastCapturedAt: Date | null }>;
export interface ShortsFeedItem { id: string; videoId: string; title: string; channelTitle: string; permalink: string; thumbnailUrl: string; publishedAt: Date; views: number; likes: number | null; comments: number | null; velocity: number; velocityWindowHours: number; country: string }
```

- [ ] **Step 1: 실패 테스트**

```ts
it("defaults to 24h and kr", () => expect(parseShortsFilters({})).toEqual({ window: "24", region: "kr" }));
it("kr region filters country = KR with the kr floor", () => { const where = buildShortsWhere({...region:"kr"...}); expect(where.country).toBe("KR"); expect(where.views).toEqual({ gte: 10000 }); });
it("global region excludes KR (UNKNOWN included) with the global floor", ...);   // country: { not: "KR" }, views gte 50000
it("all region ORs the two floors", ...);                                          // OR: [{country:"KR", views:{gte:kr}}, {country:{not:"KR"}, views:{gte:global}}]
it("window 48 widens publishedAt", ...);
```

- [ ] **Step 2: 실패 확인** → FAIL

- [ ] **Step 3: `shorts-feed.ts` 구현** — `findMany({ where, orderBy: [{ velocityScore: "desc" }, { views: "desc" }], take: 60 })`. `rawMetrics` JSON 파싱해 `thumbnailUrl`·`velocityWindowHours`. `lastCapturedAt`은 `viralExampleSnapshot.findFirst({ orderBy: { capturedAt: "desc" } })`.

- [ ] **Step 4: 통과 확인** → PASS

- [ ] **Step 5: 페이지·컴포넌트**

- `page.tsx`: `tiktok/page.tsx`의 쿠키 인증 그대로. `searchParams`는 `Promise`로 받아 `await`. `parseBrandConfig`에서 `minViews`. `<ShortsFeed items lastCapturedAt filters brandSlug hasApiKey={Boolean(process.env.YOUTUBE_API_KEY)} adapterEnabled />`.
- `ShortsFilters`: `<Link href="?window=24&region=kr">` 식 링크 6개. 활성 상태는 Tailwind.
- `ShortsCard`: 썸네일 `aspect-[9/16]` `next/image` 대신 `<img>` (외부 도메인 설정 회피), 제목 `line-clamp-2`, 채널명, `N시간 전`(`date-fns formatDistanceToNowStrict`, locale ko), 조회수·velocity는 `Intl.NumberFormat("ko", { notation: "compact" })`, 좋아요·댓글, "유튜브에서 보기" `target="_blank" rel="noopener noreferrer"`.
- 빈 상태 문구(스펙 7절). `hasApiKey`가 false면 "YOUTUBE_API_KEY가 설정되지 않았어요" 한 줄 추가. `adapterEnabled` false면 설정 링크 강조.
- `Dashboard.tsx` TikTok 버튼 옆에 `<Link href={`/brands/${brandSlug}/shorts`}>` 버튼 "쇼츠 레이더", 아이콘 `Radar`.

- [ ] **Step 6: 수동 확인**

Run: `npm run dev` → `/brands/cosmicpath/shorts?window=48&region=all`
Expected: 빈 상태 문구(데이터 전) 또는 카드 그리드. 모바일 375px에서 2열.

- [ ] **Step 7: Commit**

```bash
git add src/lib/youtube/shorts-feed.ts src/lib/youtube/shorts-feed.test.ts "src/app/brands/[slug]/shorts/page.tsx" src/components/shorts src/components/Dashboard.tsx
git commit -m "feat: 브랜드별 쇼츠 급상승 피드 페이지 추가"
```

---

### Task 9: 설정 폼 — 유튜브 키워드·채널

**Files:**
- Modify: `src/components/BrandSettingsForm.tsx` (상태 70~85행, 저장 payload 115~121행, deps 135행, 바이럴 탭 `ViralSourcesTab` ~700행)
- Test: 기존 `BrandSettingsForm` 테스트 없음. 타입체크 + 수동 확인.

**Interfaces:**
- Consumes: `ViralDiscoveryConfig["youtube"]` (Task 2).

- [ ] **Step 1: 상태 추가** — `youtubeKeywords`, `youtubeChannelHandles` `useState<string[]>`(초기값 `initialData.config.viralDiscovery.youtube.*`). 저장 payload의 `viralDiscovery`에 `youtube: { ...initialData.config.viralDiscovery.youtube, keywords: youtubeKeywords, channelHandles: youtubeChannelHandles }`. deps 배열에 둘 추가.

- [ ] **Step 2: UI** — 바이럴 소스 탭의 어댑터 토글 아래에 기존 키워드/핸들 입력과 같은 컴포넌트(태그 입력)로 "유튜브 키워드", "유튜브 채널 핸들(@)" 두 블록. `youtube_shorts` 토글이 꺼져 있으면 두 블록을 흐리게(`opacity-50`)만 하고 숨기지 않는다.

- [ ] **Step 3: 타입체크·린트**

Run: `npm run typecheck && npm run lint`
Expected: 에러·경고 0

- [ ] **Step 4: 수동 확인** — 설정 저장 후 새로고침해도 값 유지.

- [ ] **Step 5: Commit**

```bash
git add src/components/BrandSettingsForm.tsx
git commit -m "feat: 설정에 유튜브 쇼츠 키워드·채널 입력 추가"
```

---

### Task 10: 환경변수·README·검증

**Files:**
- Modify: `.env.example`, `README.md:66-73` (Cron Endpoints)

- [ ] **Step 1: `.env.example`에 `YOUTUBE_API_KEY=` 추가** (주석: Google Cloud → YouTube Data API v3)

- [ ] **Step 2: README Cron Endpoints에 두 줄 추가** — 스펙 6절 표 내용을 기존 항목 문체로. `shorts.yml` 주기와 `vars.SHORTS_BRAND_SLUGS` 언급.

- [ ] **Step 3: 전체 검증**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: 전부 통과

- [ ] **Step 4: 실제 키로 수동 1회** — `.env`에 키를 넣고 `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/shorts/discover?brands=cosmicpath` → `saved > 0`, `quotaUsed ≤ 700`. 이어서 `/snapshot` → `snapshots > 0`. 피드 페이지에서 카드 확인.

- [ ] **Step 5: Commit**

```bash
git add .env.example README.md
git commit -m "docs: 쇼츠 레이더 환경변수와 크론 문서 추가"
```

이후 `superpowers:finishing-a-development-branch`로 PR. push는 사용자 승인 후.
