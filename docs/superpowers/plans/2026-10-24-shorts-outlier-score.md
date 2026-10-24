# 쇼츠 아웃라이어 점수 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 쇼츠마다 "채널 평소(최근 쇼츠 12개 중앙값)의 N배"를 계산해 `viralScore`에 저장하고, 쇼츠 피드에서 그 순서로 정렬·배지 표시한다.

**Architecture:** 순수 계산(중앙값, 배수, 측정 대상 고르기)은 새 파일 `shorts-baseline.ts`. DB·API를 만지는 부분은 기존 `shorts-service.ts`에 넣는다(발견 실행 끝에 기준값 패스 1회, 스냅샷마다 배수 재계산). 피드는 `sort` 파라미터 하나와 카드 배지 하나를 더한다.

**Tech Stack:** Next.js App Router, TypeScript, Prisma(Postgres), vitest, YouTube Data API v3(기존 `YoutubeClient`)

**Spec:** `docs/superpowers/specs/2026-10-24-shorts-outlier-score-design.md`

## Global Constraints

- 패키지 매니저는 **npm**(`package-lock.json`). 새 의존성 추가 금지.
- **스키마 변경 금지.** 새 값은 `ViralExample.rawMetrics`(JSON 문자열)와 기존 `viralScore` 컬럼에만 쓴다.
- 쇼츠 행이 Threads 학습·생성 경로에 섞이면 안 된다. `viral-service.ts`·`viral-llm-analysis.ts`의 `source: { not: SHORTS_SOURCE }` 필터는 건드리지 않는다.
- 기준값 정의: uploads 최근 **50**개 중 `durationSec ≤ maxDurationSec` 이고 `publishedAt ≤ now − 3일` 인 영상, 게시일 최신순 **12**개, 샘플 **< 5** 이면 기준 없음, 중앙값 0이면 기준 없음.
- 기준값 재사용: 브랜드 안 채널 단위, `measured`·`insufficient`는 **7일** 유효. `skipped`는 다음 실행에서 재시도.
- 발견 실행당 측정 채널 최대 **40**개.
- `viralScore = round(outlierRatio × 100)`, 기준 없으면 0. `outlierRatio`는 소수 둘째 자리 반올림.
- 피드 기본 정렬은 `velocity`. `minViews` 필터는 두 정렬 모두 유지.
- 배지 문구: `평소의 {N.N}배` / `평소 기준 없음`. 2배 이상 주황.
- 함수 20줄 규칙(레이더 설계와 같음). 커밋 메시지는 한국어 conventional commits.

## Review Focus

1. **rawMetrics가 깨졌거나 `channelId`가 없는 행** → 기준값 패스가 그 행만 건너뛰고 나머지는 처리해야 한다. (Task 3 테스트)
2. **`listChannels`가 채널을 안 돌려주거나 uploads 재생목록이 빈 문자열** → 그 채널만 `skipped` + 에러 1건, 실행은 계속. (Task 3 테스트)
3. **기준값 없는 행이 스냅샷을 탈 때** → `viralScore` 0, `outlierRatio` null로 쓰고 예외 없이 지나가야 한다. (Task 2 테스트)
4. **기준값 패스가 rawMetrics를 쓸 때 다른 키를 지우는 것** → `velocityWindowHours`·`llmAnalyzedAt`·`firstSeenAt`이 그대로 남아야 한다. (Task 3 테스트)
5. **`?sort=` 값이 이상하거나 배열일 때** → `velocity`로 떨어지고, 필터 칩을 눌러도 현재 정렬이 유지되어야 한다. (Task 4·5 테스트)

---

### Task 1: 기준값·배수 순수 함수

**Files:**
- Create: `src/lib/youtube/shorts-baseline.ts`
- Test: `src/lib/youtube/shorts-baseline.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type BaselineStatus = "measured" | "insufficient" | "skipped";
  export interface StoredBaseline {
    baselineStatus: BaselineStatus;
    channelMedianViews: number | null;
    baselineSampleSize: number;
    baselineComputedAt: string | null;   // ISO, skipped면 null
  }
  export const BASELINE_KEYS: ReadonlyArray<keyof StoredBaseline>;   // 위 4개 키
  export interface BaselineVideo { id: string; publishedAt: Date; durationSec: number | null; views: number }
  export function computeChannelBaseline(videos: BaselineVideo[], opts: { now: Date; maxDurationSec: number }): { medianViews: number | null; sampleSize: number };
  export function computeOutlier(views: number, medianViews: number | null): { outlierRatio: number | null; viralScore: number };
  export function readStoredBaseline(raw: Record<string, unknown>): StoredBaseline | null;
  export function planBaselineWork(
    channels: Array<{ channelId: string; baselines: Array<StoredBaseline | null> }>,
    now: Date,
  ): { reuse: Map<string, StoredBaseline>; measure: string[]; skip: string[] };
  export const BASELINE_UPLOADS = 50;
  ```
- 상수(파일 안, 주석에 이유 한 줄씩): `MIN_AGE_MS = 3일`, `SAMPLE = 12`, `MIN_SAMPLE = 5`, `TTL_MS = 7일`, `MAX_CHANNELS = 40`.
- 설계의 "자기 자신 제외"는 넣지 않는다. 평가 대상은 48h 이내, 기준값은 3일 이상이라 자동으로 빠진다. 주석 한 줄로 남긴다.

- [ ] **Step 1: 실패하는 테스트 작성** (`NOW = new Date("2026-10-24T00:00:00Z")`, `DAY = 86_400_000`, 헬퍼 `v(id, daysAgo, views, durationSec = 30)`)

```ts
describe("computeChannelBaseline", () => {
  it("takes the median of an odd sample", () => {
    const videos = [4, 5, 6, 7, 8].map((d, i) => v(`a${i}`, d, [100, 300, 200, 500, 400][i]));
    expect(computeChannelBaseline(videos, { now: NOW, maxDurationSec: 180 })).toEqual({ medianViews: 300, sampleSize: 5 });
  });
  it("averages the two middle values of an even sample", () => {
    const videos = [4, 5, 6, 7, 8, 9].map((d, i) => v(`a${i}`, d, (i + 1) * 100));
    expect(computeChannelBaseline(videos, { now: NOW, maxDurationSec: 180 }).medianViews).toBe(350);
  });
  it("drops videos younger than 3 days and longer than maxDurationSec", () => {
    const videos = [v("young", 2, 9_999_999), v("long", 5, 9_999_999, 600), ...[4, 5, 6, 7, 8].map((d) => v(`k${d}`, d, 100))];
    expect(computeChannelBaseline(videos, { now: NOW, maxDurationSec: 180 })).toEqual({ medianViews: 100, sampleSize: 5 });
  });
  it("uses only the 12 most recent eligible videos", () => {
    const recent = Array.from({ length: 12 }, (_, i) => v(`r${i}`, 4 + i, 100));
    const old = Array.from({ length: 5 }, (_, i) => v(`o${i}`, 30 + i, 1_000_000));
    expect(computeChannelBaseline([...old, ...recent], { now: NOW, maxDurationSec: 180 })).toEqual({ medianViews: 100, sampleSize: 12 });
  });
  it("returns null with fewer than 5 eligible videos", () => {
    const videos = [4, 5, 6, 7].map((d) => v(`a${d}`, d, 100));
    expect(computeChannelBaseline(videos, { now: NOW, maxDurationSec: 180 })).toEqual({ medianViews: null, sampleSize: 4 });
  });
  it("returns null when the median is 0", () => {
    const videos = [4, 5, 6, 7, 8].map((d) => v(`a${d}`, d, 0));
    expect(computeChannelBaseline(videos, { now: NOW, maxDurationSec: 180 }).medianViews).toBeNull();
  });
});

describe("computeOutlier", () => {
  it("rounds the ratio to 2 decimals and scores ×100", () => {
    expect(computeOutlier(32_000, 10_000)).toEqual({ outlierRatio: 3.2, viralScore: 320 });
    expect(computeOutlier(10_000, 3_000)).toEqual({ outlierRatio: 3.33, viralScore: 333 });
  });
  it("returns null ratio and score 0 without a baseline", () => {
    expect(computeOutlier(32_000, null)).toEqual({ outlierRatio: null, viralScore: 0 });
  });
});

describe("readStoredBaseline", () => {
  it("reads a valid baseline and rejects unknown status or wrong types", () => {
    const ok = { baselineStatus: "measured", channelMedianViews: 100, baselineSampleSize: 12, baselineComputedAt: "2026-10-23T00:00:00.000Z" };
    expect(readStoredBaseline(ok)).toEqual(ok);
    expect(readStoredBaseline({ ...ok, baselineStatus: "weird" })).toBeNull();
    expect(readStoredBaseline({ ...ok, baselineSampleSize: "12" })).toBeNull();
    expect(readStoredBaseline({})).toBeNull();
  });
});

describe("planBaselineWork", () => {
  const measured = (daysAgo: number): StoredBaseline => ({ baselineStatus: "measured", channelMedianViews: 100, baselineSampleSize: 12, baselineComputedAt: new Date(NOW.getTime() - daysAgo * DAY).toISOString() });
  const skipped: StoredBaseline = { baselineStatus: "skipped", channelMedianViews: null, baselineSampleSize: 0, baselineComputedAt: null };
  it("reuses a fresh measured or insufficient baseline from any row of the channel", () => {
    const plan = planBaselineWork([{ channelId: "c1", baselines: [null, measured(1)] }], NOW);
    expect(plan.reuse.get("c1")).toEqual(measured(1));
    expect(plan.measure).toEqual([]);
  });
  it("re-measures baselines older than 7 days, skipped, or missing", () => {
    const plan = planBaselineWork([
      { channelId: "old", baselines: [measured(8)] },
      { channelId: "skip", baselines: [skipped] },
      { channelId: "none", baselines: [null] },
    ], NOW);
    expect(plan.measure).toEqual(["old", "skip", "none"]);
  });
  it("caps measurement at 40 channels and skips the rest", () => {
    const channels = Array.from({ length: 41 }, (_, i) => ({ channelId: `c${i}`, baselines: [null] }));
    const plan = planBaselineWork(channels, NOW);
    expect(plan.measure).toHaveLength(40);
    expect(plan.skip).toEqual(["c40"]);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/youtube/shorts-baseline.test.ts`
Expected: FAIL — `Cannot find module './shorts-baseline'`

- [ ] **Step 3: `src/lib/youtube/shorts-baseline.ts` 구현**

위 Interfaces 그대로. 중앙값은 정렬 후 가운데(짝수면 두 값 평균). `computeOutlier`의 반올림은 `Math.round(views / median * 100) / 100`, `viralScore`는 `Math.round(ratio * 100)`. `planBaselineWork`는 입력 순서를 유지한다.

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/youtube/shorts-baseline.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/lib/youtube/shorts-baseline.ts src/lib/youtube/shorts-baseline.test.ts
git commit -m "feat: 쇼츠 채널 기준값·배수 계산 함수 추가"
```

---

### Task 2: 재발견 때 기준값 보존 + 스냅샷마다 배수 갱신

**Files:**
- Modify: `src/lib/youtube/shorts-service.ts` (`buildRawMetrics` 62-75, `refreshVelocity` 43-52, `recordSnapshot` 54-60)
- Test: `src/lib/youtube/shorts-service.test.ts`

**Interfaces:**
- Consumes: `BASELINE_KEYS`, `readStoredBaseline`, `computeOutlier` (Task 1)
- Produces: `recordSnapshot(exampleId, stats, publishedAt, now)` 시그니처는 그대로. 내부의 `refreshVelocity`는 `views: number`를 추가로 받아 `velocityScore`·`viralScore`·`rawMetrics.outlierRatio`를 **한 번의 update**로 쓴다.

- [ ] **Step 1: 실패하는 테스트 작성** (`describe("saveShortsCandidate")` 안에 추가)

```ts
const baseline = { baselineStatus: "measured", channelMedianViews: 250, baselineSampleSize: 12, baselineComputedAt: "2026-10-21T00:00:00.000Z" };

it("carries the stored baseline through a re-save (regression: merge used to drop it)", async () => {
  db.viralExample.findUnique.mockResolvedValue({ rawMetrics: JSON.stringify({ firstSeenAt: "old", ...baseline }) });
  await saveShortsCandidate("b1", candidate, NOW);
  expect(JSON.parse(upsertArgs().update.rawMetrics as string)).toMatchObject(baseline);
});

it("rewrites outlierRatio and viralScore from the snapshot views", async () => {
  db.viralExample.findUnique.mockResolvedValue({ rawMetrics: JSON.stringify(baseline) });
  await saveShortsCandidate("b1", candidate, NOW);   // candidate.views = 1000
  const call = db.viralExample.update.mock.calls[0][0];
  expect(call.data.viralScore).toBe(400);
  expect(JSON.parse(call.data.rawMetrics).outlierRatio).toBe(4);
});

it("writes viralScore 0 and outlierRatio null when there is no baseline", async () => {
  db.viralExample.findUnique.mockResolvedValue({ rawMetrics: "not json" });
  await saveShortsCandidate("b1", candidate, NOW);
  const call = db.viralExample.update.mock.calls[0][0];
  expect(call.data.viralScore).toBe(0);
  expect(JSON.parse(call.data.rawMetrics).outlierRatio).toBeNull();
});
```

`snapshotShorts` describe에도 하나:

```ts
it("refreshes the ratio on hourly snapshots without extra API calls", async () => {
  db.viralExample.findMany.mockResolvedValue([row("e1", "v1")]);
  db.viralExample.findUnique.mockResolvedValue({ rawMetrics: JSON.stringify({ baselineStatus: "measured", channelMedianViews: 5, baselineSampleSize: 6, baselineComputedAt: "x" }) });
  const listVideos = vi.fn().mockResolvedValue([video("v1")]);   // views 10
  stubClient(listVideos);
  await snapshotShorts(NOW);
  expect(listVideos).toHaveBeenCalledTimes(1);
  expect(db.viralExample.update.mock.calls[0][0].data.viralScore).toBe(200);
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/youtube/shorts-service.test.ts`
Expected: 새 테스트 4개 FAIL (`viralScore` undefined, 기준값 키 누락)

- [ ] **Step 3: 구현**

- `buildRawMetrics`: `firstSeenAt`처럼 `BASELINE_KEYS`의 이전 값을 `incoming`에 얹는다(이전 값이 있는 키만).
- `refreshVelocity(exampleId, publishedAt, now, views)`: 기존 row 읽기 후 `readStoredBaseline(record)?.channelMedianViews ?? null`로 `computeOutlier(views, …)`. `data`에 `viralScore` 추가, `rawMetrics`에 `outlierRatio` 추가.
- `recordSnapshot`: `stats.views`를 넘긴다.
- 기존 테스트 "keeps firstSeenAt and discoveredAt on the second save"의 update 키 목록은 바뀌지 않는다(upsert update에는 `viralScore`를 넣지 않는다).

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/youtube/shorts-service.test.ts`
Expected: PASS (기존 테스트 포함 전부)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/youtube/shorts-service.ts src/lib/youtube/shorts-service.test.ts
git commit -m "feat: 쇼츠 재수집 시 기준값 보존하고 스냅샷마다 배수 갱신"
```

---

### Task 3: 발견 실행 끝의 기준값 패스

**Files:**
- Modify: `src/lib/youtube/shorts-service.ts` (`discoverShorts` 105-117, 새 함수 추가)
- Test: `src/lib/youtube/shorts-service.test.ts`

**Interfaces:**
- Consumes: `computeChannelBaseline`, `computeOutlier`, `readStoredBaseline`, `planBaselineWork`, `BASELINE_UPLOADS`, `StoredBaseline` (Task 1). `YoutubeClient.listChannels / recentUploads / listVideos`, `YoutubeQuotaError` (기존).
- Produces: `export async function updateChannelBaselines(input: { brandId: string; client: YoutubeClient; now: Date; maxDurationSec: number }): Promise<{ errors: ViralSourceError[] }>` — 예외를 밖으로 던지지 않는다. 모든 에러는 `adapter: "youtube_shorts"`, `source: "baseline"` 또는 `` `baseline:${channelId}` ``.
- `discoverShorts`: 클라이언트를 **한 번만** 만들어 `harvestShorts`와 기준값 패스에 같이 넘긴다. 클라이언트가 있으면 저장 뒤 `updateChannelBaselines` 호출, 에러를 합친다. `quotaUsed = harvest.quotaUsed + (패스 후 client.quotaUsed − 패스 전 client.quotaUsed)`. 기존 테스트가 `harvestShorts`를 mock해서 `quotaUsed`를 주입하므로 `client.quotaUsed`를 그대로 반환하면 깨진다. 키 없으면 기준값 패스 생략.

흐름 (각 단계를 20줄 이하 함수로 쪼갠다):

```
rows = findMany({ where: { brandId, source: SHORTS_SOURCE, publishedAt: { gte: now − 48h } },
                  select: { id: true, rawMetrics: true, views: true } })
rawMetrics 파싱 실패 또는 channelId(string) 없는 행 → 무시
channelId별로 묶기 → planBaselineWork
measure 채널: listChannels(50개씩) → uploadsPlaylistId
  채널마다: recentUploads(id, BASELINE_UPLOADS) → listVideos(ids) → computeChannelBaseline
            → { baselineStatus: medianViews === null ? "insufficient" : "measured", …, baselineComputedAt: now.toISOString() }
  uploads 없음(채널 누락·빈 문자열)·일반 에러 → 그 채널 skipped + 에러 `baseline:${channelId}`
  YoutubeQuotaError → 남은 채널 전부 skipped + 에러 1건 `baseline`, 루프 중단
skip 채널 → { baselineStatus: "skipped", channelMedianViews: null, baselineSampleSize: 0, baselineComputedAt: null }
행마다: 목표 기준값이 저장값과 다를 때만 update
  data: { rawMetrics: { …현재 rawMetrics, …기준값, outlierRatio }, viralScore }   (computeOutlier(row.views ?? 0, medianViews))
```

- [ ] **Step 1: 실패하는 테스트 작성** (새 `describe("updateChannelBaselines")`; `client`는 `listChannels`·`recentUploads`·`listVideos` mock을 가진 객체를 `as never`로)

헬퍼: `stored(id, channelId, extra = {})` → `{ id, views: 1000, rawMetrics: JSON.stringify({ channelId, velocityWindowHours: 2, llmAnalyzedAt: "y", firstSeenAt: "f", ...extra }) }`, `upload(id, daysAgo, views)` → `YoutubeVideo`(durationSec 30).

```ts
it("measures each channel once and writes the baseline, ratio and score to every row", async () => {
  db.viralExample.findMany.mockResolvedValue([stored("e1", "c1"), stored("e2", "c1")]);
  const client = clientWith({ uploads: ["u1", "u2", "u3", "u4", "u5"], videos: [4, 5, 6, 7, 8].map((d, i) => upload(`u${i + 1}`, d, 250)) });
  const result = await updateChannelBaselines({ brandId: "b1", client, now: NOW, maxDurationSec: 180 });
  expect(result.errors).toEqual([]);
  expect(client.recentUploads).toHaveBeenCalledTimes(1);
  expect(client.recentUploads).toHaveBeenCalledWith("UUc1", 50);
  const updates = db.viralExample.update.mock.calls.map((c) => c[0]);
  expect(updates.map((u) => u.where.id)).toEqual(["e1", "e2"]);
  expect(updates[0].data.viralScore).toBe(400);
  expect(JSON.parse(updates[0].data.rawMetrics)).toMatchObject({
    baselineStatus: "measured", channelMedianViews: 250, baselineSampleSize: 5, baselineComputedAt: NOW.toISOString(),
    outlierRatio: 4, velocityWindowHours: 2, llmAnalyzedAt: "y", firstSeenAt: "f",
  });
});

it("reads only this brand's shorts rows inside the 48h feed window", async () => {
  db.viralExample.findMany.mockResolvedValue([]);
  await updateChannelBaselines({ brandId: "b1", client: clientWith({}), now: NOW, maxDurationSec: 180 });
  expect(db.viralExample.findMany).toHaveBeenCalledWith({
    where: { brandId: "b1", source: "youtube_shorts", publishedAt: { gte: new Date(NOW.getTime() - 48 * HOUR) } },
    select: { id: true, rawMetrics: true, views: true },
  });
});

it("reuses a fresh baseline from a sibling row without calling the API", async () => {
  const fresh = { baselineStatus: "measured", channelMedianViews: 500, baselineSampleSize: 12, baselineComputedAt: new Date(NOW.getTime() - 6 * HOUR).toISOString() };
  db.viralExample.findMany.mockResolvedValue([stored("e1", "c1", fresh), stored("e2", "c1")]);
  const client = clientWith({});
  await updateChannelBaselines({ brandId: "b1", client, now: NOW, maxDurationSec: 180 });
  expect(client.listChannels).not.toHaveBeenCalled();
  expect(db.viralExample.update).toHaveBeenCalledTimes(1);
  expect(db.viralExample.update.mock.calls[0][0].where.id).toBe("e2");
  expect(db.viralExample.update.mock.calls[0][0].data.viralScore).toBe(200);
});

it("stores insufficient when fewer than 5 eligible uploads", async () => { /* 4개 → baselineStatus "insufficient", viralScore 0 */ });

it("ignores rows with broken rawMetrics or no channelId", async () => {
  db.viralExample.findMany.mockResolvedValue([{ id: "bad", views: 1, rawMetrics: "{" }, { id: "nochan", views: 1, rawMetrics: "{}" }]);
  const result = await updateChannelBaselines({ brandId: "b1", client: clientWith({}), now: NOW, maxDurationSec: 180 });
  expect(result.errors).toEqual([]);
  expect(db.viralExample.update).not.toHaveBeenCalled();
});

it("marks a channel without an uploads playlist as skipped and continues", async () => {
  // c1: listChannels가 안 돌려줌 → skipped + { source: "baseline:c1" }, c2: 정상 measured
});

it("on quota error marks the remaining channels skipped and reports once", async () => {
  // recentUploads가 YoutubeQuotaError를 던짐 → c1, c2 둘 다 baselineStatus "skipped", errors = [{ adapter: "youtube_shorts", source: "baseline", message: "youtube quota exceeded" }]
});

it("never throws: a findMany failure becomes one baseline error", async () => {
  db.viralExample.findMany.mockRejectedValue(new Error("db down"));
  await expect(updateChannelBaselines({ brandId: "b1", client: clientWith({}), now: NOW, maxDurationSec: 180 }))
    .resolves.toEqual({ errors: [{ adapter: "youtube_shorts", source: "baseline", message: "db down" }] });
});
```

`clientWith({ uploads?, videos? })`는 `listChannels`가 요청된 id마다 `{ id, title: "", country: "KR", uploadsPlaylistId: \`UU${id}\` }`를 돌려주는 mock. 주석 처리된 세 케이스는 위 두 개와 같은 모양으로 채운다(입력과 기대값은 주석 그대로).

`discoverShorts` describe에 하나:

```ts
it("runs the baseline pass with the same client and adds its quota", async () => {
  vi.stubEnv("YOUTUBE_API_KEY", "key");
  db.brand.findUnique.mockResolvedValue({ id: "b1", brandConfig: "{}" });
  db.viralExample.findMany.mockResolvedValue([{ id: "e1", views: 1, rawMetrics: JSON.stringify({ channelId: "c1" }) }]);
  const client = { listVideos: vi.fn(), recentUploads: vi.fn(), quotaUsed: 3, listChannels: vi.fn() };
  client.listChannels.mockImplementation(async () => { client.quotaUsed += 1; return []; });
  vi.mocked(createYoutubeClient).mockReturnValue(client as never);
  vi.mocked(harvestShorts).mockResolvedValue({ candidates: [], errors: [], quotaUsed: 3 });
  const result = await discoverShorts("b1", NOW);
  expect(vi.mocked(harvestShorts).mock.calls[0][0].client).toBe(client);
  expect(result.quotaUsed).toBe(4);
  expect(result.errors).toEqual([expect.objectContaining({ source: "baseline:c1" })]);
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/youtube/shorts-service.test.ts`
Expected: FAIL — `updateChannelBaselines` is not exported

- [ ] **Step 3: 구현** — 위 흐름대로. `parseRecord`는 파일에 이미 있는 것을 쓴다.

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/youtube/`
Expected: PASS (harvester·velocity·feed 기존 테스트 포함)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/youtube/shorts-service.ts src/lib/youtube/shorts-service.test.ts
git commit -m "feat: 쇼츠 발견 후 채널 기준값 측정 패스 추가"
```

---

### Task 4: 피드 정렬 파라미터와 아이템 필드

**Files:**
- Modify: `src/lib/youtube/shorts-feed.ts`
- Test: `src/lib/youtube/shorts-feed.test.ts`

**Interfaces:**
- Consumes: `readStoredBaseline` (Task 1)
- Produces:
  ```ts
  export type ShortsSort = "velocity" | "outlier";
  export function parseShortsFilters(searchParams): { window: ShortsWindow; region: ShortsRegion; sort: ShortsSort };
  export function buildShortsOrderBy(sort: ShortsSort): Prisma.ViralExampleOrderByWithRelationInput[];
  export const OUTLIER_HIGHLIGHT_RATIO = 2;
  // ShortsFeedItem에 추가:
  outlierRatio: number | null;
  channelMedianViews: number | null;
  baselineSampleSize: number;
  ```
- `loadShortsFeed` 입력에 `sort: ShortsSort` 추가, `orderBy: buildShortsOrderBy(input.sort)`. 페이지는 이미 `...filters`를 넘기므로 `page.tsx`는 안 바꾼다.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
it("defaults to 24h, kr and velocity", () => {
  expect(parseShortsFilters({})).toEqual({ window: "24", region: "kr", sort: "velocity" });   // 기존 테스트 기대값 교체
});
it("accepts sort=outlier and falls back to velocity otherwise", () => {
  expect(parseShortsFilters({ sort: "outlier" }).sort).toBe("outlier");
  expect(parseShortsFilters({ sort: "views" }).sort).toBe("velocity");
  expect(parseShortsFilters({ sort: ["outlier", "x"] }).sort).toBe("outlier");
});
it("orders by viralScore then velocity for outlier, unchanged for velocity", () => {
  expect(buildShortsOrderBy("outlier")).toEqual([{ viralScore: "desc" }, { velocityScore: "desc" }]);
  expect(buildShortsOrderBy("velocity")).toEqual([{ velocityScore: "desc" }, { views: "desc" }]);
});
```

`toFeedItem`은 export하지 않으므로 아이템 필드는 Task 5의 렌더 테스트와 타입체크로 확인한다.

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/youtube/shorts-feed.test.ts`
Expected: FAIL — `buildShortsOrderBy` is not a function, 기본값에 `sort` 없음

- [ ] **Step 3: 구현** — `parseRawMetrics`가 `outlierRatio`(number면 그 값, 아니면 null)와 `readStoredBaseline` 결과에서 `channelMedianViews`·`baselineSampleSize`(없으면 null·0)를 같이 돌려주게 넓힌다.

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/youtube/shorts-feed.test.ts "src/app/brands/[slug]/shorts/page.test.ts"`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/lib/youtube/shorts-feed.ts src/lib/youtube/shorts-feed.test.ts
git commit -m "feat: 쇼츠 피드에 평소 대비 정렬 추가"
```

---

### Task 5: 카드 배지와 정렬 토글

**Files:**
- Modify: `src/components/shorts/ShortsCard.tsx`, `src/components/shorts/ShortsFilters.tsx`, `src/components/shorts/ShortsFeed.tsx`
- Test: `src/components/shorts/ShortsCard.test.ts`, `src/components/shorts/ShortsFilters.test.ts` (새 파일, `renderToStaticMarkup` + `React.createElement` — `src/components/ProductCampaignStartPanel.test.ts`와 같은 방식)

**Interfaces:**
- Consumes: `ShortsFeedItem`의 새 필드, `ShortsSort`, `OUTLIER_HIGHLIGHT_RATIO` (Task 4)
- Produces: `ShortsFilters` props `{ window; region; sort: ShortsSort }`. `ShortsFeed`의 `filters` 타입에 `sort` 추가, `ShortsFilters`에 그대로 전달.

UI 고정값:
- 배지 문구: 기준 있음 `평소의 ${ratio.toFixed(1)}배`, 없음 `평소 기준 없음`.
- 배지 `title`: `채널 최근 쇼츠 ${baselineSampleSize}개 중앙값 ${compact.format(channelMedianViews)}회 기준` (기준 없을 때는 title 없음).
- `ratio ≥ OUTLIER_HIGHLIGHT_RATIO` → 기존 velocity 배지와 같은 주황 클래스(`bg-orange-100 … text-orange-700 …`). 미만·없음 → `bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300`.
- 배지는 기존 "조회 / +N/h" 줄의 flex 안에 세 번째 요소로.
- 정렬 칩: 기존 칩 nav 아래에 `aria-label="쇼츠 정렬"`인 nav 하나, 라벨 `급상승순`(velocity)·`평소 대비순`(outlier), 같은 `CHIP/ACTIVE/INACTIVE` 클래스.
- 모든 링크 href는 세 파라미터를 다 담는다: `?window=${w}&region=${r}&sort=${s}`.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// ShortsCard.test.ts
const base: ShortsFeedItem = { id: "1", videoId: "v", title: "t", channelTitle: "c", permalink: "p", thumbnailUrl: "", publishedAt: new Date(), views: 1000, likes: null, comments: null, velocity: 10, velocityWindowHours: 1, country: "KR", outlierRatio: null, channelMedianViews: null, baselineSampleSize: 0 };
const html = (item: ShortsFeedItem) => renderToStaticMarkup(React.createElement(ShortsCard, { item }));

it("shows an orange badge at 2x or more with the baseline tooltip", () => {
  const out = html({ ...base, outlierRatio: 3.2, channelMedianViews: 10000, baselineSampleSize: 12 });
  expect(out).toMatch(/<span[^>]*text-orange-700[^>]*>평소의 3\.2배<\/span>/);
  expect(out).toContain('title="채널 최근 쇼츠 12개 중앙값 1만회 기준"');
});
it("uses a neutral badge under 2x", () => {
  const out = html({ ...base, outlierRatio: 1.5, channelMedianViews: 10000, baselineSampleSize: 12 });
  expect(out).toMatch(/<span[^>]*bg-slate-100[^>]*>평소의 1\.5배<\/span>/);
  expect(out).not.toMatch(/<span[^>]*orange[^>]*>평소의/);
});
it("says no baseline instead of showing 0x", () => {
  const out = html(base);
  expect(out).toContain("평소 기준 없음");
  expect(out).not.toContain("0.0배");
});

// ShortsFilters.test.ts
it("keeps the current sort on window/region chips and the current filters on sort chips", () => {
  const out = renderToStaticMarkup(React.createElement(ShortsFilters, { window: "48", region: "all", sort: "outlier" }));
  expect(out).toContain('href="?window=24&amp;region=kr&amp;sort=outlier"');
  expect(out).toContain('href="?window=48&amp;region=all&amp;sort=velocity"');
  expect(out).toMatch(/aria-current="page"[^>]*>평소 대비순/);
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/components/shorts/`
Expected: FAIL — 배지 문구 없음, sort 파라미터 없음

- [ ] **Step 3: 구현** — 위 UI 고정값대로. `ShortsFeed`는 `filters.sort`를 넘기는 것만 바꾼다.

- [ ] **Step 4: 전체 검증**

Run: `npx vitest run src/components/shorts/ && npm run typecheck && npm run lint && npm test`
Expected: 전부 PASS, typecheck 에러 0, lint 새 경고 0

- [ ] **Step 5: 브라우저 확인** — 개발 서버에서 `/brands/cosmicpath/shorts?sort=outlier`를 열어 정렬 칩, 배지, 375px 폭 줄바꿈, 콘솔 에러 없음을 확인한다. 로컬 DB에 기준값이 아직 없으면 배지는 전부 "평소 기준 없음"이 맞다.

- [ ] **Step 6: 커밋**

```bash
git add src/components/shorts/ShortsCard.tsx src/components/shorts/ShortsFilters.tsx src/components/shorts/ShortsFeed.tsx src/components/shorts/ShortsCard.test.ts src/components/shorts/ShortsFilters.test.ts
git commit -m "feat: 쇼츠 카드에 평소 대비 배지와 정렬 토글 추가"
```

---

## 머지 후 확인 (push·배포는 사용자 승인 후)

- 수동 discover 1회: `quotaUsed`가 이전보다 +81 이하인지, errors에 `baseline` 에러가 없는지.
- 다음 snapshot 크론 뒤 피드에서 `평소 대비순`이 바뀌는지.
