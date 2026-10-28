# 급상승 소재 레이더 (rising source radar) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 키워드 TOP 수집을 4시간마다 돌리고, 순위 상승을 점수에 얹어 "지금 뜨는" 남의 글을 고른 뒤, 수집 직후 그 글의 상황·감정선을 소재로 `ref_replay` 초안을 하루 1개 만든다.

**Architecture:** 기존 부품만 재조립한다. `mergeStoredRawMetrics`가 `rawMetrics.rankHistory`를 쌓고, `pickReferenceReplaySource`가 같은 글 그룹의 이력으로 `risingScore`를 계산해 정렬하며, `/api/cron/viral`이 수집 뒤 `refillReferenceReplay`를 호출한다. 프롬프트는 "구조만"에서 "상황+감정선"으로 바꾸고 `[상황/맥락]`을 참고 글로 치환한다. 스키마·화면·라이브러리 변경 없음.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Prisma 5, Vitest 4, GitHub Actions cron.

**Spec:** `docs/superpowers/specs/2026-10-28-rising-source-radar-design.md` (바탕: `docs/superpowers/specs/2026-10-27-reference-replay-design.md`)

## Global Constraints

- `any` 금지. `unknown` + 타입 좁히기.
- 패키지 매니저 pnpm. 새 라이브러리 없음. DB 스키마 변경 없음.
- `ref_replay` 하루 1개 상한은 `refillReferenceReplay` 안의 기존 게이트로만 보장한다. 게이트 코드를 새로 쓰지 않는다.
- `MIN_TIMES_SEEN = 2` 유지. `MIN_SEEN_AGE_MS`는 `3 * 60 * 60 * 1000`.
- `rankHistory`는 최근 12건만 유지. 가중치: `rankGain × 3`, 발행 24h 이내 +15, 48h 이내 +5.
- 프롬프트 문구는 스펙 3.4의 문장을 그대로 쓴다(아래 Task 4에 복사됨).
- 커밋 메시지는 conventional commits + 한국어. `git add`는 파일명 명시.
- 테스트: `pnpm test -- <file>`, 타입: `pnpm typecheck`, 린트: `pnpm lint`.

## Review Focus

1. **`rankHistory`가 깨진 값일 때** (배열 아님, 항목에 `rank`가 숫자 아님): 무시하고 새 이력으로 시작해야 한다. → Task 1 테스트 "invalid history".
2. **이력이 1건뿐인 글** (처음 본 글): `rankGain`은 0이어야 한다(이전 최고가 없음). → Task 2 테스트 "single entry".
3. **같은 글이 두 행에 있고 이력이 한쪽에만 있을 때**: 그룹 합산이 빈 쪽 때문에 0이 되면 안 된다. → Task 3 테스트 "history split across rows".
4. **`analyze=false`로 호출했을 때** Claude 분석은 건너뛰되 수집·학습·`ref_replay` 시도는 그대로 돌아야 한다. → Task 5 테스트.
5. **`refillReferenceReplay`가 throw할 때** 수집 결과까지 500으로 뒤집히면 안 된다(refill 라우트와 같은 처리). → Task 5 테스트 "refill throws".

---

### Task 1: `rankHistory` 누적 (`mergeStoredRawMetrics`)

**Files:**
- Modify: `src/lib/viral-analysis.ts:152-170` (`mergeStoredRawMetrics`)
- Test: `src/lib/viral-analysis.test.ts:99-125` (`describe("mergeStoredRawMetrics")`)

**Interfaces:**
- Produces: `rawMetrics.rankHistory: Array<{ at: string; rank: number; hits: number }>` (ISO 시각, TOP 순위, 키워드 겹침 수). 최신이 마지막. 최대 12건. 수집마다 1건 추가. `next.searchRank`가 숫자가 아니면 추가하지 않는다. `export const RANK_HISTORY_LIMIT = 12`.
- Produces: `export type RankHistoryEntry = { at: string; rank: number; hits: number }` 와 `export function readRankHistory(raw: Record<string, unknown>): RankHistoryEntry[]` (깨진 값은 빈 배열, 항목 단위로 `rank`가 숫자인 것만).

- [ ] **Step 1: Write the failing tests** (`describe("mergeStoredRawMetrics")` 안에 추가)

```ts
it("appends one rankHistory entry per sighting, newest last", () => {
  const first = mergeStoredRawMetrics(null, { searchRank: 5, keywordHits: 1 }, new Date("2026-10-28T00:00:00.000Z"));
  const second = mergeStoredRawMetrics(JSON.stringify(first.merged), { searchRank: 2, keywordHits: 2 }, new Date("2026-10-28T04:00:00.000Z"));
  expect(second.merged.rankHistory).toEqual([
    { at: "2026-10-28T00:00:00.000Z", rank: 5, hits: 1 },
    { at: "2026-10-28T04:00:00.000Z", rank: 2, hits: 2 },
  ]);
});

it("keeps only the last 12 rankHistory entries", () => {
  let raw: string | null = null;
  for (let i = 0; i < 14; i++) raw = JSON.stringify(mergeStoredRawMetrics(raw, { searchRank: i + 1, keywordHits: 1 }, new Date(Date.UTC(2026, 9, 28, i))).merged);
  const history = readRankHistory(JSON.parse(raw ?? "{}"));
  expect(history).toHaveLength(12);
  expect(history[0].rank).toBe(3);
  expect(history[11].rank).toBe(14);
});

it("starts a fresh rankHistory when the stored one is invalid and skips sightings without a rank", () => {
  const broken = JSON.stringify({ timesSeen: 1, rankHistory: "nope" });
  const stored = mergeStoredRawMetrics(broken, { searchRank: 4, keywordHits: 1 }, new Date("2026-10-28T00:00:00.000Z"));
  expect(stored.merged.rankHistory).toEqual([{ at: "2026-10-28T00:00:00.000Z", rank: 4, hits: 1 }]);
  const noRank = mergeStoredRawMetrics(JSON.stringify(stored.merged), { keywordHits: 1 }, new Date("2026-10-28T04:00:00.000Z"));
  expect(noRank.merged.rankHistory).toEqual(stored.merged.rankHistory);
  expect(readRankHistory({ rankHistory: [{ at: "x", rank: "1", hits: 1 }, { at: "y", rank: 2, hits: 1 }] })).toEqual([{ at: "y", rank: 2, hits: 1 }]);
});
```

`readRankHistory`를 import에 추가한다.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- src/lib/viral-analysis.test.ts`
Expected: FAIL — `readRankHistory` is not exported / `rankHistory` undefined.

- [ ] **Step 3: Implement in `src/lib/viral-analysis.ts`**

`mergeStoredRawMetrics` 안에서 `previous.rankHistory`를 `readRankHistory(previous)`로 읽고, `readNumber(next.searchRank)`가 숫자면 `{ at: now.toISOString(), rank, hits: readNumber(next.keywordHits) ?? 1 }`를 뒤에 붙인 뒤 `slice(-RANK_HISTORY_LIMIT)`로 자른다. `merged.rankHistory`에 넣는다. 이 키는 `PERSISTED_RAW_KEYS`에 넣지 않는다(복사가 아니라 누적이라서). 주석 한 줄: `// 48h = 4h 주기 × 12건. 순위 상승(rankGain)은 선택 시점에 sourceKey 그룹으로 합쳐 계산한다(src/lib/reference-replay.ts).`

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- src/lib/viral-analysis.test.ts`
Expected: PASS (기존 4건 + 신규 3건).

- [ ] **Step 5: Commit**

```bash
git add src/lib/viral-analysis.ts src/lib/viral-analysis.test.ts
git commit -m "feat(viral): 재수집마다 TOP 순위 이력(rankHistory)을 rawMetrics에 누적"
```

---

### Task 2: `calculateRisingScore`와 자격 대기 시간 3h (`reference-radar.ts`)

**Files:**
- Modify: `src/lib/reference-radar.ts:11-13` (`MIN_SEEN_AGE_MS` 상수와 주석), 파일 끝에 함수 추가
- Test: `src/lib/reference-radar.test.ts`

**Interfaces:**
- Consumes: `RankHistoryEntry` (Task 1).
- Produces:
  ```ts
  export const RANK_GAIN_WEIGHT = 3;
  export const FRESH_24H_BONUS = 15;
  export const FRESH_48H_BONUS = 5;
  export function calculateRisingScore(input: {
    referenceScore: number;
    rankHistory: RankHistoryEntry[];   // 그룹 합산본. 호출자가 at 오름차순으로 정렬해 준다.
    publishedAt: Date | null;
    now: Date;
  }): number;
  ```
  `rankGain = max(0, (마지막 항목 이전의 최소 rank) − 마지막 항목 rank)`, 항목이 1건 이하면 0. `freshness`: `publishedAt`이 `now` 기준 24h 이내면 15, 48h 이내면 5, 그 외·null이면 0. 반환 `referenceScore + rankGain × 3 + freshness`.

- [ ] **Step 1: Write the failing tests** (`reference-radar.test.ts`에 추가)

```ts
import { calculateReferenceScore, calculateRisingScore, isEligibleSource, MIN_SEEN_AGE_MS } from "@/lib/reference-radar";

describe("calculateRisingScore", () => {
  const h = (rank: number, hour: number) => ({ at: new Date(Date.UTC(2026, 9, 28, hour)).toISOString(), rank, hits: 1 });
  const fresh = new Date(now.getTime() - 6 * HOUR_MS);

  it("adds rank gain from the previous best to the latest and a freshness bonus", () => {
    // best before latest = 5, latest = 2 → gain 3 × 3 = 9; published 6h ago → +15
    expect(calculateRisingScore({ referenceScore: 40, rankHistory: [h(9, 0), h(5, 4), h(2, 8)], publishedAt: fresh, now })).toBe(40 + 9 + 15);
  });

  it("gives no gain for a single entry or a rank that got worse", () => {
    expect(calculateRisingScore({ referenceScore: 40, rankHistory: [h(2, 0)], publishedAt: null, now })).toBe(40);
    expect(calculateRisingScore({ referenceScore: 40, rankHistory: [h(2, 0), h(6, 4)], publishedAt: null, now })).toBe(40);
  });

  it("gives 5 for a 48h-old post and 0 beyond", () => {
    expect(calculateRisingScore({ referenceScore: 0, rankHistory: [], publishedAt: new Date(now.getTime() - 30 * HOUR_MS), now })).toBe(5);
    expect(calculateRisingScore({ referenceScore: 0, rankHistory: [], publishedAt: new Date(now.getTime() - 49 * HOUR_MS), now })).toBe(0);
  });
});

describe("isEligibleSource with the 4-hour harvest cadence", () => {
  it("accepts a post first seen 4 hours ago", () => {
    expect(isEligibleSource({ ...src("the.saju", 3, 2), firstSeenAt: new Date(now.getTime() - 4 * HOUR_MS).toISOString() }, rules)).toBe(true);
  });
  it("still rejects a post first seen 2 hours ago", () => {
    expect(isEligibleSource({ ...src("the.saju", 3, 2), firstSeenAt: new Date(now.getTime() - 2 * HOUR_MS).toISOString() }, rules)).toBe(false);
    expect(MIN_SEEN_AGE_MS).toBe(3 * HOUR_MS);
  });
});
```

(`rules`는 기존 테스트 파일에 이미 정의돼 있다.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- src/lib/reference-radar.test.ts`
Expected: FAIL — `calculateRisingScore` not exported; 4h 테스트 FAIL(아직 11h).

- [ ] **Step 3: Implement in `src/lib/reference-radar.ts`**

`MIN_SEEN_AGE_MS = 3 * 60 * 60 * 1000`, 주석을 "4시간 주기 수집에서 지연 여유 1h"로 고친다. `calculateRisingScore`를 추가하고 상수 세 개를 export. 상수 옆 주석: `// 3·15·5는 calculateSearchSignalScore의 순위 1단계(3점)에 맞춘 값. 추측이며 20개 판정(스펙 6장)으로 검증한다.`

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- src/lib/reference-radar.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/reference-radar.ts src/lib/reference-radar.test.ts
git commit -m "feat(viral): 순위 상승·신선도를 더한 risingScore 추가, 자격 대기 3시간으로 단축"
```

---

### Task 3: `pickReferenceReplaySource`가 `risingScore`로 고른다

**Files:**
- Modify: `src/lib/reference-replay.ts:35-70` (`pickReferenceReplaySource`)
- Test: `src/lib/reference-replay.test.ts`

**Interfaces:**
- Consumes: `calculateRisingScore`, `readRankHistory` (Task 1·2).
- Produces: 시그니처 불변. 그룹 점수 = `calculateRisingScore({ referenceScore: 그룹 max referenceScore, rankHistory: 그룹 모든 행의 rankHistory를 합쳐 at 오름차순 정렬, publishedAt: 그룹 max publishedAt, now })`. 정렬은 이 점수 내림차순, 동률은 더 최근 `publishedAt`. 자격·차단 조건은 그대로.

- [ ] **Step 1: Write the failing tests**

기존 헬퍼 `ex`에 `rankHistory`를 넣을 수 있게 `rawMetrics`를 받는 변형을 추가한다:

```ts
function exWithHistory(id: string, score: number, sourceKey: string, rankHistory: Array<{ at: string; rank: number; hits: number }>): ReferenceCandidate {
  return { ...ex(id, score, true, 2, sourceKey), rawMetrics: JSON.stringify({ referenceScore: score, eligibleSource: true, timesSeen: 2, rankHistory }) };
}
const h = (rank: number, hour: number) => ({ at: new Date(now.getTime() - hour * 60 * 60 * 1000).toISOString(), rank, hits: 1 });

it("prefers a rising post over a higher referenceScore that is flat", () => {
  // a: 50, rank 8 → 2 (gain 6 × 3 = 18) → 68. b: 60, flat → 60. 둘 다 2일 전 글(신선도 0).
  const a = exWithHistory("a", 50, "post-a", [h(8, 8), h(2, 0)]);
  const b = exWithHistory("b", 60, "post-b", [h(3, 8), h(3, 0)]);
  expect(pickReferenceReplaySource([a, b], [], now)?.id).toBe("a");
});

it("merges rankHistory across rows of the same post, so a row without history does not zero the gain", () => {
  const withHistory = exWithHistory("x1", 50, "post-x", [h(9, 8), h(1, 0)]);
  const noHistory = { ...ex("x2", 55, true, 2, "post-x"), rawMetrics: JSON.stringify({ referenceScore: 55, eligibleSource: true, timesSeen: 2 }) };
  const flat = exWithHistory("y", 70, "post-y", [h(2, 8), h(2, 0)]);
  // x 그룹: max ref 55 + gain 8 × 3 = 79 > y 70
  expect(pickReferenceReplaySource([withHistory, noHistory, flat], [], now)?.id).toBe("x2");
});
```

기존 테스트 "picks the highest referenceScore among eligible posts"는 이력이 없으면 `risingScore = referenceScore`라 그대로 통과해야 한다.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- src/lib/reference-replay.test.ts`
Expected: 신규 2건 FAIL(첫 번째는 `b`, 두 번째는 `y`가 뽑힘).

- [ ] **Step 3: Implement in `src/lib/reference-replay.ts`**

`scored` 계산부에서 그룹의 `rankHistory`를 `rows.flatMap(row => readRankHistory(row.metrics))`로 합쳐 `at` 오름차순 정렬하고, `calculateRisingScore`로 그룹 점수를 만든다. `best`(그룹 안에서 반환할 행)는 종전처럼 `referenceScore` 최대 행. 함수 상단 주석(35-37행)을 "risingScore 1위" 기준으로 고친다.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- src/lib/reference-replay.test.ts`
Expected: PASS (기존 전부 + 신규 2건).

- [ ] **Step 5: Commit**

```bash
git add src/lib/reference-replay.ts src/lib/reference-replay.test.ts
git commit -m "feat(viral): ref_replay 원본을 risingScore(그룹 합산 순위 이력)로 선택"
```

---

### Task 4: 프롬프트 "상황+감정선" (모드 규칙, 참고 글 헤더, 상황 치환)

**Files:**
- Modify: `src/lib/viral-intent-modes.ts:288-300` (`REFERENCE_REPLAY_MODE`)
- Modify: `src/lib/generate-posts.ts:678` (참고 글 헤더), `:1194-1200` (`recentSituations` 전달), `:1217-1219` (`experiment.situation` 치환)
- Test: `src/lib/viral-intent-modes.test.ts:144-148`, `src/lib/generate-posts-reference-replay.test.ts`

**Interfaces:**
- Produces: `export const REFERENCE_SITUATION_PROMPT = "아래 [참고 글]의 상황(무슨 일이 있었는지)을 이번 글의 상황으로 쓴다. 등장인물·관계·지명·직업·숫자·이름은 전부 바꾼다."` (`generate-posts.ts`에 둔다). `ref_replay` 글의 `Post.situation`에는 이 문자열이 저장된다.

모드 문구(스펙 3.4 그대로):
- instruction: `아래 참고 글의 상황(무슨 일이 있었는지)과 감정의 흐름(예: 황당 → 찔림 → 체념)을 가져와, cosmicpath 독자가 자기 일처럼 느낄 새 글을 쓴다. 구조(첫 줄 방식, 줄 구성, 마무리)도 참고하되 그대로 베끼지 않는다.`
- rules:
  1. `참고 글의 문장·표현을 그대로 옮기지 않는다.`
  2. `등장인물·관계·지명·직업·숫자·이름 같은 고유 디테일은 전부 바꾼다. 원글 작성자가 읽어도 자기 이야기라고 못 알아봐야 한다.`
  3. `감정선은 가져오되 결론·시선은 cosmicpath(사주·궁합·타이밍)로 가져온다. 원글의 결론을 반복하지 않는다.`
  4. `본문은 140~260자를 목표로 한다.`
- 헤더(678행, `referenceReplay`일 때): `다른 계정에서 반응이 좋았던 글. 상황과 감정의 흐름을 가져오되 인물·표현·문장·고유 디테일은 새로 써`. `winner_replay` 쪽 문구는 그대로.
- `label: "외부 구조 재현"` → `"외부 소재 재현"`. `id`는 `ref_replay` 유지.

- [ ] **Step 1: Write the failing tests**

`viral-intent-modes.test.ts`의 `describe("ref_replay mode")`에 추가:

```ts
it("takes the situation and emotional arc but forbids copying details", () => {
  const mode = resolveViralIntentMode("ref_replay", 0);
  expect(mode.instruction).toContain("감정의 흐름");
  expect(mode.rules.some((rule) => rule.includes("고유 디테일은 전부 바꾼다"))).toBe(true);
  expect(mode.rules.some((rule) => rule.includes("소재(인물·상황·사례)도 가져오지 않는다"))).toBe(false);
});
```

`generate-posts-reference-replay.test.ts`의 "writes one ref_replay draft tagged with its source and skips arm planning" 테스트에 단언 추가(`state.requests[0]`이 프롬프트 JSON):

```ts
const prompt = state.requests[0];
expect(prompt).toContain("[상황/맥락]\\n아래 [참고 글]의 상황");
expect(prompt).not.toContain("퇴사와 이직 사이에서 흔들리는 상황");
expect(prompt).toContain("상황과 감정의 흐름을 가져오되");
expect(prompt).not.toContain("구조만 따르고 주제·소재·문장은 새로 써");
```

(`JSON.stringify`된 문자열이라 줄바꿈은 `\\n`으로 매칭한다. 해당 테스트의 brandConfig `situations`에 "퇴사와 이직 사이에서 흔들리는 상황"이 있는지 96행에서 확인하고, 없으면 그 테스트의 config에 넣는다.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- src/lib/viral-intent-modes.test.ts src/lib/generate-posts-reference-replay.test.ts`
Expected: 신규 단언 FAIL.

- [ ] **Step 3: Implement**

1. `viral-intent-modes.ts`: `REFERENCE_REPLAY_MODE`의 `label`·`instruction`·`rules`를 위 문구로 교체. 288-289행 주석을 "상황·감정선은 가져오고 문장·고유 디테일은 새로 쓴다"로 고친다.
2. `generate-posts.ts`:
   - `REFERENCE_SITUATION_PROMPT` 상수 export.
   - 678행 헤더 문구 교체.
   - 1200행: `buildExperiment(..., referenceReplay ? [] : recentSituations)` — 참고 글 상황은 매트릭스 포화 검사 대상이 아니다(주석 한 줄).
   - 1219행 다음: `experiment.situation = REFERENCE_SITUATION_PROMPT;` — `[상황/맥락]`이 참고 글을 가리키게 하고, 저장되는 `Post.situation`에도 이 문자열이 남아 이후 글의 포화 검사에 안 잡힌다(주석 한 줄).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- src/lib/viral-intent-modes.test.ts src/lib/generate-posts-reference-replay.test.ts src/lib/generate-posts-winner-replay.test.ts`
Expected: PASS. (`winner_replay` 테스트는 헤더 문구가 안 바뀌었음을 보증.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/viral-intent-modes.ts src/lib/viral-intent-modes.test.ts src/lib/generate-posts.ts src/lib/generate-posts-reference-replay.test.ts
git commit -m "feat(generate): ref_replay를 구조만에서 상황+감정선 재현으로 전환"
```

---

### Task 5: `viral` 크론이 수집 직후 `ref_replay`를 시도하고 `analyze` 플래그를 받는다

**Files:**
- Modify: `src/app/api/cron/viral/route.ts`
- Test: `src/app/api/cron/viral/route.test.ts`

**Interfaces:**
- Consumes: `refillReferenceReplay(brand: Brand, now: Date): Promise<ReferenceRefillResult>` (`@/lib/reference-replay-refill`).
- Produces: `GET /api/cron/viral?analyze=false` → Claude 분석 생략(기본·`true`·그 외 값은 분석함). 브랜드별 응답에 `referenceReplay: ReferenceRefillResult` 추가. `refillReferenceReplay`가 throw하면 `{ generated: 0, skipped: "dropped", reason }`로 담고 그 브랜드는 성공 처리(refill 라우트 29행과 같은 패턴).
- 브랜드 조회를 `prisma.brand.findMany()`(select 없음)로 바꾼다. `refillReferenceReplay`가 `Brand` 전체 행을 받기 때문이다.
- 호출 순서: discover → (analyze) → learn → refillReferenceReplay. 스펙 3.3: 300s 예산이 넘치면 refill을 discover 직후로 당겨도 된다(빌더 재량).

- [ ] **Step 1: Write the failing tests**

`route.test.ts` 상단에 mock 추가:

```ts
const analyzeTopViralExamples = vi.hoisted(() => vi.fn(async () => ({ analyzed: 0 })));
const refillReferenceReplay = vi.hoisted(() => vi.fn(async () => ({ generated: 0, skipped: "no_source" })));
vi.mock("@/lib/viral-llm-analysis", () => ({ analyzeTopViralExamples }));
vi.mock("@/lib/reference-replay-refill", () => ({ refillReferenceReplay }));
```

(기존 `vi.mock("@/lib/viral-llm-analysis", ...)` 줄은 이것으로 대체.) 테스트 추가:

```ts
it("tries a ref_replay draft for every harvested brand and reports it", async () => {
  discoverViralExamples.mockResolvedValue({ saved: 1, errors: [], externalAllFailed: false });
  refillReferenceReplay.mockResolvedValueOnce({ generated: 1, sourceId: "ex_1" });
  const body = await (await GET(request())).json();
  expect(refillReferenceReplay).toHaveBeenCalledTimes(2);
  expect(refillReferenceReplay.mock.calls[0][0]).toMatchObject({ id: "a" });
  expect(body.brands[0].referenceReplay).toEqual({ generated: 1, sourceId: "ex_1" });
});

it("skips Claude analysis when analyze=false but still harvests, learns and tries ref_replay", async () => {
  discoverViralExamples.mockResolvedValue({ saved: 1, errors: [], externalAllFailed: false });
  const response = await GET(new NextRequest("http://localhost/api/cron/viral?analyze=false"));
  expect(response.status).toBe(200);
  expect(analyzeTopViralExamples).not.toHaveBeenCalled();
  expect(learnViralPatterns).toHaveBeenCalledTimes(2);
  expect(refillReferenceReplay).toHaveBeenCalledTimes(2);
});

it("keeps the brand green when refillReferenceReplay throws", async () => {
  discoverViralExamples.mockResolvedValue({ saved: 1, errors: [], externalAllFailed: false });
  refillReferenceReplay.mockRejectedValueOnce(new Error("generation exploded"));
  const response = await GET(request());
  const body = await response.json();
  expect(response.status).toBe(200);
  expect(body.brands[0].referenceReplay).toEqual({ generated: 0, skipped: "dropped", reason: "generation exploded" });
  expect(body.brands[0].success).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- src/app/api/cron/viral/route.test.ts`
Expected: 신규 3건 FAIL(`refillReferenceReplay` 미호출, `analyzeTopViralExamples` 호출됨).

- [ ] **Step 3: Implement in `route.ts`**

`const analyze = request.nextUrl.searchParams.get("analyze") !== "false";`. `findMany()`로 전체 행. 브랜드 루프에서 `analyze`가 false면 `llmAnalysis = { analyzed: 0, skipped: "analyze=false" }`. `learn` 뒤에 `refillReferenceReplay(brand, new Date()).catch(...)`. `results.push`에 `referenceReplay` 추가. 주석: `// 4시간 주기 중 분석은 09:41·21:41 두 번만(viral.yml). ref_replay는 분석 결과를 안 쓰므로 매 실행 시도한다.`

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- src/app/api/cron/viral/route.test.ts`
Expected: PASS (기존 3건 + 신규 3건).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/viral/route.ts src/app/api/cron/viral/route.test.ts
git commit -m "feat(cron): viral 수집 직후 ref_replay 초안 시도, analyze=false로 Claude 분석 생략"
```

---

### Task 6: `viral.yml` 4시간 주기 + README

**Files:**
- Modify: `.github/workflows/viral.yml`
- Modify: `README.md` (`GET /api/cron/viral` 항목과 "레퍼런스 레이더" 문단)

**Interfaces:**
- 스케줄 두 줄: `'41 0,12 * * *'` (KST 09:41·21:41, 분석 포함), `'41 4,8,16,20 * * *'` (KST 13:41·17:41·01:41·05:41, 분석 생략). `workflow_dispatch`는 분석 포함.
- 스텝: `ANALYZE=true; [ "${{ github.event.schedule }}" = "41 4,8,16,20 * * *" ] && ANALYZE=false` 뒤 URL에 `?analyze=${ANALYZE}`.

- [ ] **Step 1: Edit `viral.yml`**

cron 주석을 "4시간마다. ref_replay 원본 자격(두 번 잡힘 + 3h)이 하루 안에 차도록. Claude 분석은 0·12시 실행만"으로 바꾼다.

- [ ] **Step 2: Validate the workflow file**

Run: `node -e "require('fs').readFileSync('.github/workflows/viral.yml','utf8')" && pnpm dlx --package=js-yaml js-yaml .github/workflows/viral.yml > /dev/null && echo ok`
Expected: `ok`. (js-yaml이 없으면 `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/viral.yml'))" && echo ok`.)

- [ ] **Step 3: Update README**

`GET /api/cron/viral` 항목: "GitHub Actions (`viral.yml`) runs it every 4 hours; Claude analysis only on the 00:41/12:41 UTC runs (`analyze=false` otherwise). After harvesting it tries the day's `ref_replay` draft, so the refill cron's own attempt is usually `already_today`." 레퍼런스 레이더 문단: 하루 2회 → 4시간마다, `ref_replay`는 "구조만" → "상황·감정선은 가져오고 문장·고유 디테일은 새로". 전환일 2026-10-28 명시(스펙 6장 판정 표본 기준).

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/viral.yml README.md
git commit -m "ci(viral): 수집 4시간 주기로 변경, 분석은 하루 2회만"
```

---

### Task 7: 전체 검증

- [ ] **Step 1: Typecheck / lint / test**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: 에러·경고 0, 전부 PASS.

- [ ] **Step 2: Build**

Run: `pnpm build`
Expected: 성공.

- [ ] **Step 3: 운영 토큰으로 선택 로직 드라이런 (읽기 전용)**

기존 `scripts/check-threads-discovery.ts`로 `keyword_search`가 아직 통과하는지 확인: `npx tsx scripts/check-threads-discovery.ts`. Expected: `keyword_search` 통과 로그. (DB 쓰기 없음.)

- [ ] **Step 4: 완료 보고**

커밋 목록, 테스트 수, 바뀐 프롬프트 문구를 보고한다. push는 사용자 승인 뒤(전역 규칙).
