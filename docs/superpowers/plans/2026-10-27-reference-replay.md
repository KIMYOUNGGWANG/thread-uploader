# 외부 레퍼런스 레이더 + 구조 재작성 (ref_replay) 구현 계획 — v2 (키워드 TOP 전용)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 우리 키워드로 하루 2번 Threads 검색 TOP을 읽어 "참고 점수"가 가장 높고 두 번 이상 TOP에 남은 글을 고르고, 그 구조만 따라 쓴 `ref_replay` 글을 하루 최대 1개 대기열에 넣는다. 길이 실험 표본은 건드리지 않는다.

**Architecture:** 수집은 기존 `viral-harvester` → `viral-service.discoverViralExamples` 키워드 경로에 참고 점수와 원본 자격 표식을 끼운다. 재작성은 기존 `winner_replay`의 프롬프트 경로(`experiment.winnerReference`)·유사도 검사·출처 태그를 새 모드 `ref_replay`가 그대로 쓴다. refill 크론이 평소 배치 **앞에** 별도 호출로 하루 1개를 만든다. 새 순수 로직은 `src/lib/reference-radar.ts`(점수·자격)와 `src/lib/reference-replay.ts`(원본 고르기) 두 파일에 모은다.

**Tech Stack:** Next.js App Router, TypeScript strict, Prisma 5.22 (스키마 변경 없음), vitest, pnpm, Threads Graph API `keyword_search`.

**Spec:** `docs/superpowers/specs/2026-10-27-reference-replay-design.md` (v2 축소판)

**v2 변경 (2026-10-27):** 0단계 게이트에서 `profile_lookup`·`profile_posts`가 권한 오류, `keyword_search`만 통과. 계정 통계·계정 목록 관련 작업은 전부 빠지고 키워드 TOP 신호만 쓴다. Task 1은 v1에서 완료됐고(`fetchPublicProfileStats`는 심사 통과 뒤 확장용으로 남김) 아래 Task 2부터 시작한다.

## Global Constraints

- DB 스키마 변경 없음. 글은 `ViralExample.rawMetrics`, 설정은 `brandConfig.viralDiscovery`.
- 새 라이브러리 없음. pnpm. `any` 금지, `unknown` + 좁히기.
- 길이 실험 사전 등록(가설·지표·글 수·판정)은 그대로. 바꾸는 것은 `ref_replay` 제외 규칙 두 곳(`isExperimentPost`, `analyze-post-response.mjs`)과 실험 문서 한 줄뿐.
- `ref_replay`는 하루(KST, `startOfPublishDay`) 최대 1개 생성. 큐에 `PENDING` 상태의 `ref_replay`가 있으면 만들지 않는다. `keywords`가 0개면 만들지 않는다.
- 원본 자격(스펙 3.1): 발행 7일 이내, `timesSeen ≥ 2`, 우리 계정 글 아님, `excludedHandles`에 없음, 사용 태그(`ref_replay_source:`)·7일 내 시도(`replayAttemptedAt`) 없음.
- 참고 점수(스펙 3.1): 검색 신호 = 기존 `calculateSearchSignalScore`, `has_replies` **+10**, 구조 점수 = 기존 `calculateStructuralSignalScore`.
- 원문 문장·소재 재사용 금지(프롬프트 규칙 + `checkAntiRepeatSimilarity`).
- 수집 주기 하루 2회(UTC 0·12시). 키워드 상한 10. 초기 키워드 8개: "사주", "궁합", "대운", "일주", "신년운세", "사주 궁합", "재물운", "이직 사주".
- 커밋은 conventional commits + 한국어, 파일 이름을 지정해 `git add`. 브랜치 `feat/reference-replay`(이 워크트리). push·PR은 사용자 승인 후.
- 운영 데이터를 쓰는 단계(설정 시드)는 실행 전 사용자에게 알린다. DB를 읽는 스크립트는 `select`를 명시한다(공유 `node_modules`의 Prisma 클라이언트가 다른 브랜치 스키마라 전체 칸 조회가 실패한다).

## Review Focus

1. 우리 자신의 글이 키워드 TOP에 떠서 원본이 되면 안 된다. 브랜드의 Threads 사용자명과 같은 `authorUsername`은 자격 없음. → Task 2 테스트 "rejects the brand's own posts".
2. 원본 글이 유사도 검사에 걸려 버려진 날, 다음 날 같은 원본이 또 1위가 되어 영원히 반복되면 안 된다. 시도한 원본은 `rawMetrics.replayAttemptedAt`으로 7일간 제외한다. → Task 5 테스트, Task 7 Step 3.
3. `NEEDS_REVIEW`로 떨어진 `ref_replay` 글은 아무도 검토하지 않으므로, 그것 때문에 생성이 영원히 막히면 안 된다. "큐에 미발행" 조건은 `PENDING`만 센다. 오늘 생성 수는 모든 상태를 센다. → Task 7 테스트.
4. `timesSeen`은 재수집 때 `mergeStoredRawMetrics`가 올린다. 첫 수집 글은 1이라 자격이 없어야 하고, 두 번째 수집에서 2가 되어 자격을 얻어야 한다. → Task 3 테스트 "a post seen in two runs becomes eligible".
5. 핸들 표기 차이(`@`, 대소문자)로 제외 계정이 통과하면 안 된다. 비교는 `@` 제거 + 소문자. → Task 2 테스트.

---

### Task 1: 계정 7일 통계 API + 권한 확인 스크립트 — **v1에서 완료** (commits 4146ff5, 9b68cf9)

v2에서는 `fetchPublicProfileStats`를 호출하지 않는다. 심사 통과 뒤 확장용으로 남긴다. 게이트 결과는 스펙 3.0.

---

### Task 2: 참고 점수와 원본 자격 (순수 함수)

**Files:**
- Create: `src/lib/reference-radar.ts`
- Modify: `src/types/brand.ts` (`ViralDiscoveryConfig`에 `excludedHandles: string[]`, `normalizeViralDiscovery`, `DEFAULT_BRAND_CONFIG`)
- Test: `src/lib/reference-radar.test.ts`

**Interfaces:**
- Consumes: `calculateSearchSignalScore`, `calculateStructuralSignalScore`, `SearchSignal` (`@/lib/viral-analysis`).
- Produces:

```ts
// src/types/brand.ts — ViralDiscoveryConfig에 추가
excludedHandles: string[];   // 기본 [], '@' 제거·소문자로 정규화해 저장

// src/lib/reference-radar.ts
export const HAS_REPLIES_BONUS = 10;
export const MIN_TIMES_SEEN = 2;
export const SOURCE_MAX_AGE_DAYS = 7;
export function normalizeHandle(handle: string): string;   // '@' 제거, trim, 소문자
export function calculateReferenceScore(input: { signal: SearchSignal; content: string; hasReplies: boolean | null }): number;
export interface EligibilityInput { authorUsername: string | null; publishedAt: Date | null; timesSeen: number }
export interface EligibilityRules { ownHandle: string | null; excludedHandles: string[]; now: Date }
export function isEligibleSource(input: EligibilityInput, rules: EligibilityRules): boolean;
```

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
describe("calculateReferenceScore", () => {
  it("adds search signal, replies bonus and structure", () => {
    const base = calculateReferenceScore({ signal: {}, content: "평범한 글", hasReplies: null });
    expect(calculateReferenceScore({ signal: { searchRank: 1, keywordHits: 2, timesSeen: 3 }, content: "평범한 글", hasReplies: true }))
      .toBe(base + calculateSearchSignalScore({ searchRank: 1, keywordHits: 2, timesSeen: 3 }) + 10);
  });
});
describe("isEligibleSource", () => {
  const rules = { ownHandle: "cosmicpath", excludedHandles: ["forceteller_official"], now };
  it("accepts a 3-day-old post seen twice from another account", () => expect(isEligibleSource(src("the.saju", 3, 2), rules)).toBe(true));
  it("rejects a post seen only once", () => expect(isEligibleSource(src("the.saju", 3, 1), rules)).toBe(false));
  it("rejects posts older than 7 days and posts without a date", () => {
    expect(isEligibleSource(src("the.saju", 8, 2), rules)).toBe(false);
    expect(isEligibleSource({ ...src("the.saju", 3, 2), publishedAt: null }, rules)).toBe(false);
  });
  it("rejects the brand's own posts", () => expect(isEligibleSource(src("@CosmicPath", 3, 2), rules)).toBe(false));
  it("rejects excluded handles case-insensitively", () => expect(isEligibleSource(src("@Forceteller_Official", 3, 2), rules)).toBe(false));
  it("treats a missing own handle as no own-post rule", () => expect(isEligibleSource(src("anyone", 3, 2), { ...rules, ownHandle: null })).toBe(true));
});
describe("normalizeViralDiscovery excludedHandles", () => {
  it("normalizes handles and defaults to an empty list", () => {
    expect(parseBrandConfig(JSON.stringify({ viralDiscovery: { excludedHandles: ["@The.Saju ", "x"] } })).viralDiscovery.excludedHandles).toEqual(["the.saju", "x"]);
    expect(parseBrandConfig("{}").viralDiscovery.excludedHandles).toEqual([]);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm vitest run src/lib/reference-radar.test.ts`
Expected: FAIL, 모듈 없음.

- [ ] **Step 3: 구현**

`brand.ts`: 타입·기본값·`normalizeViralDiscovery`(`normalizeStringList` 뒤 `normalizeHandle`). `reference-radar.ts`: 위 시그니처. 상수마다 이유 주석(스펙 3.1).

- [ ] **Step 4: 통과 확인**

Run: `pnpm vitest run src/lib/reference-radar.test.ts src/types`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/reference-radar.ts src/lib/reference-radar.test.ts src/types/brand.ts
git commit -m "feat(radar): 참고 점수와 외부 원본 자격 판정 함수 추가"
```

---

### Task 3: 수집에 참고 점수·자격 끼우기

**Files:**
- Modify: `src/lib/viral-harvester.ts:151,201` (키워드 상한 5 → 10, 상수 `MAX_KEYWORDS = 10`; 핸들 상한은 그대로)
- Modify: `src/lib/viral-service.ts` (`discoverViralExamples`, `saveCandidate`)
- Modify: `src/lib/viral-llm-analysis.ts:124-129` (`analyzeTopViralExamples` 대상 선택)
- Test: `src/lib/viral-harvester.test.ts`, `src/lib/viral-service.test.ts`, `src/lib/viral-llm-analysis.test.ts`

**Interfaces:**
- Consumes: Task 2 `calculateReferenceScore`, `isEligibleSource`, `normalizeHandle`.
- Produces: `ViralExample.rawMetrics`에 `referenceScore: number`, `eligibleSource: boolean`, `hasReplies` 유지, `timesSeen` 유지(기존 `mergeStoredRawMetrics`).

우리 계정 사용자명: `discoverViralExamples`가 이미 `brand`를 읽으므로 `brand.threadsUserId`로 Threads `GET /{userId}?fields=username`을 부르지 않고, **`brandConfig.viralDiscovery.excludedHandles`에 우리 계정을 넣는 것으로 대신한다**(Task 9 시드가 `cosmicpath` 계정 사용자명을 넣는다). `ownHandle`은 `config.viralDiscovery.ownHandle?: string`(새 선택 칸)으로 두고 없으면 null. **[계획 결정: API 호출 하나 아끼고 설정으로 해결]**

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// viral-harvester.test.ts
it("queries up to 10 keywords", () => { /* keywords 12개 입력 → attemptedSources 10 */ });

// viral-service.test.ts (prisma·harvester 모킹은 기존 파일 방식)
it("stores referenceScore and eligibility on each saved example", async () => {
  // harvest → the.saju 글(has_replies true), 우리 계정(ownHandle "cosmicpath") 글 1개
  await discoverViralExamples("brand_1");
  const saved = upsertCalls.map((c) => ({ author: c.create.authorUsername, metrics: JSON.parse(c.create.rawMetrics) }));
  expect(saved.find((s) => s.author === "cosmicpath")?.metrics.eligibleSource).toBe(false);
  expect(saved.every((s) => typeof s.metrics.referenceScore === "number")).toBe(true);
});
it("a post seen in two runs becomes eligible", async () => {
  // 1차: findUnique → null → 저장 rawMetrics.timesSeen 1, eligibleSource false
  // 2차: findUnique → { rawMetrics: 1차 저장값 } → timesSeen 2, eligibleSource true (3일 전 글, 다른 계정)
});

// viral-llm-analysis.test.ts
it("analyzes the 5 newest-discovered examples with the highest referenceScore", async () => {
  // findMany → 30건 (discoveredAt desc), rawMetrics.referenceScore 제각각 → requestAnalyses에 상위 5개 id
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm vitest run src/lib/viral-harvester.test.ts src/lib/viral-service.test.ts src/lib/viral-llm-analysis.test.ts`
Expected: 새 케이스 FAIL.

- [ ] **Step 3: 구현**

- `saveCandidate`: 기존 `stored = mergeStoredRawMetrics(...)` 뒤에 `referenceScore = calculateReferenceScore({ signal: stored.signal, content, hasReplies })`, `eligibleSource = isEligibleSource({ authorUsername, publishedAt, timesSeen: stored.signal.timesSeen ?? 1 }, rules)`를 `rawMetrics`에 함께 저장. `rules`는 `discoverViralExamples`에서 한 번 만들어 넘긴다(`ownHandle`, `excludedHandles`, `now`). `viralScore` 계산은 그대로.
- `analyzeTopViralExamples`: `orderBy: { discoveredAt: "desc" }, take: 30`으로 읽고 메모리에서 `rawMetrics.referenceScore` 내림차순 상위 `ANALYSIS_BATCH_SIZE`(5).
- `buildDiscoveryRunConfig`: 바꾸지 않는다.

- [ ] **Step 4: 통과 확인**

Run: `pnpm vitest run src/lib/viral-harvester.test.ts src/lib/viral-service.test.ts src/lib/viral-llm-analysis.test.ts`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/viral-harvester.ts src/lib/viral-harvester.test.ts src/lib/viral-service.ts src/lib/viral-service.test.ts src/lib/viral-llm-analysis.ts src/lib/viral-llm-analysis.test.ts src/types/brand.ts
git commit -m "feat(radar): 수집 글마다 참고 점수와 원본 자격 저장, 키워드 상한 10"
```

---

### Task 4: 수집 크론 — 대상 브랜드 제한, 경보, 하루 2회

**Files:**
- Modify: `src/app/api/cron/viral/route.ts`
- Modify: `.github/workflows/viral.yml`
- Test: `src/app/api/cron/viral/route.test.ts`

**Interfaces:**
- Consumes: `sendSystemAlert` (`@/lib/alert-service`), `parseBrandConfig`.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
it("skips brands with no keywords configured", async () => {
  // brand a: viralDiscovery.keywords ["사주"]; brand b: []
  await GET(request());
  expect(discoverViralExamples).toHaveBeenCalledTimes(1);
  expect(discoverViralExamples).toHaveBeenCalledWith("a", expect.anything());
});
it("sends an error alert when every external source failed", async () => {
  discoverViralExamples.mockResolvedValue({ saved: 0, errors: [{ message: "no permission" }], externalAllFailed: true });
  await GET(request());
  expect(sendSystemAlert).toHaveBeenCalledWith(expect.objectContaining({ level: "error", title: "Viral discovery failed", brandName: "cosmicpath" }));
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm vitest run src/app/api/cron/viral/route.test.ts`
Expected: FAIL.

- [ ] **Step 3: 구현**

`prisma.brand.findMany`의 select에 `name`, `brandConfig`를 더하고, `parseBrandConfig(...).viralDiscovery.keywords.length === 0`이면 `results`에 `{ slug, skipped: "no_keywords" }`를 넣고 건너뛴다. `externalAllFailed`면 500 응답 전에 브랜드마다 `sendSystemAlert({ level: "error", title: "Viral discovery failed", message: errors를 ", "로 합친 것, brandName })`.

`viral.yml`: 주석 처리된 `schedule`을 아래로 바꾸고 10-22 동결 주석은 지운다. `workflow_dispatch`는 둔다.

```yaml
  schedule:
    - cron: '41 0,12 * * *'   # 하루 2회(KST 09:41, 21:41). 글 반응은 첫 48시간에 붙으므로 매시간은 낭비
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm vitest run src/app/api/cron/viral/route.test.ts`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/app/api/cron/viral/route.ts src/app/api/cron/viral/route.test.ts .github/workflows/viral.yml
git commit -m "feat(radar): 바이럴 수집을 하루 2회로 되살리고 실패 시 경보, 키워드 없는 브랜드는 건너뜀"
```

---

### Task 5: `ref_replay` 모드, 원본 고르기, 실험 제외

**Files:**
- Modify: `src/lib/viral-intent-modes.ts:276` (`WINNER_REPLAY_MODE` 옆에 `REFERENCE_REPLAY_MODE`, `resolveViralIntentMode` 분기 452행과 같은 처리, `ViralIntentModeId` 유니온에 `"ref_replay"`)
- Create: `src/lib/reference-replay.ts`
- Modify: `src/lib/length-experiment.ts:25-27` (`isExperimentPost`)
- Modify: `scripts/analyze-post-response.mjs:194-197`
- Modify: `docs/experiments/2026-10-16-post-length.md` ("설계" 절 끝에 한 줄)
- Test: `src/lib/reference-replay.test.ts`, `src/lib/length-experiment.test.ts`

**Interfaces:**
- Produces:

```ts
// viral-intent-modes.ts
export const REFERENCE_REPLAY_MODE: ViralIntentMode = {
  id: "ref_replay",
  label: "외부 구조 재현",
  primaryMetric: "shares",
  instruction: "아래 참고 글의 구조(첫 줄 방식, 줄 구성, 마무리 방식)만 따라 새 글을 쓴다. 주제·문장·표현은 그대로 쓰지 않는다.",
  rules: [
    "참고 글의 문장이나 표현을 그대로 옮기지 않는다.",
    "참고 글의 소재(인물·상황·사례)도 가져오지 않는다. 소재는 이번 글의 [주제]와 [타깃]에서만 가져온다.",
    "본문은 140~260자를 목표로 한다.",
  ],
};

// reference-replay.ts
export const REFERENCE_REPLAY_SOURCE_PREFIX = "ref_replay_source:";
export const ATTEMPT_COOLDOWN_DAYS = 7;
export interface ReferenceCandidate { id: string; content: string; authorUsername: string | null; publishedAt: Date | null; rawMetrics: string }
/** rawMetrics.eligibleSource가 true인 글 중 referenceScore 내림차순. 사용 태그·7일 내 replayAttemptedAt 제외. 동률이면 publishedAt 최신. */
export function pickReferenceReplaySource(candidates: ReferenceCandidate[], usedTags: string[], now: Date): ReferenceCandidate | null;
/** 7일 이내 ViralExample(쇼츠 제외)과 최근 30일 ref_replay 글의 qualityReasons를 읽어 pickReferenceReplaySource를 돌린다. */
export async function loadReferenceReplaySource(brandId: string, now: Date): Promise<ReferenceCandidate | null>;
export async function markReferenceAttempted(exampleId: string, now: Date): Promise<void>; // rawMetrics.replayAttemptedAt = now ISO (다른 키 보존)
```

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// reference-replay.test.ts
it("picks the highest referenceScore among eligible posts", () => {
  expect(pickReferenceReplaySource([ex("a", 50, true), ex("b", 80, true), ex("c", 99, false)], [], now)?.id).toBe("b");
});
it("skips sources already used and sources attempted in the last 7 days", () => {
  const attempted = { ...ex("a", 90, true), rawMetrics: JSON.stringify({ referenceScore: 90, eligibleSource: true, replayAttemptedAt: daysAgo(2) }) };
  expect(pickReferenceReplaySource([attempted, ex("b", 50, true)], ["ref_replay_source:b"], now)).toBeNull();
});
it("lets a source attempted 8 days ago back in", () => { /* replayAttemptedAt daysAgo(8) → picked */ });
it("breaks ties by the newer publishedAt", () => { /* 같은 점수, 더 최근 글 */ });

// length-experiment.test.ts
it("does not count ref_replay posts toward the sequence or the pending arms", () => {
  const posts = [draft("가".repeat(200), "ref_replay"), draft("가".repeat(200), "concept_hierarchy")];
  expect(sequencePosition(posts, config)).toBe(1);
  expect(pickPublishCandidate([draft("가".repeat(420), "ref_replay")], config, "S")?.formulaId).toBe("ref_replay");
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm vitest run src/lib/reference-replay.test.ts src/lib/length-experiment.test.ts`
Expected: FAIL.

- [ ] **Step 3: 구현**

- `isExperimentPost`: `formulaId !== REFERENCE_REPLAY_MODE.id` 조건 추가. `analyze-post-response.mjs:197`의 필터에 `p.formulaId !== "ref_replay"` 추가(주석에 "src/lib/length-experiment.ts isExperimentPost와 같아야 함").
- `loadReferenceReplaySource`: `prisma.viralExample.findMany({ where: { brandId, source: { not: "shorts" }, publishedAt: { gte: now - 7d } }, select: { id, content, authorUsername, publishedAt, rawMetrics } })`와 `prisma.post.findMany({ where: { brandId, formulaId: "ref_replay", createdAt: { gte: now - 30d } }, select: { qualityReasons } })` → `pickReferenceReplaySource`. `winner-replay.ts`의 `parseReasons`를 export해서 재사용.
- `markReferenceAttempted`: `findUnique({ select: { rawMetrics } })` → JSON 파싱 → `replayAttemptedAt` 추가 → `update`.
- 실험 문서 "설계" 절 끝: "- 2026-10-27부터 `ref_replay`(외부 구조 재현) 글은 신년 글과 같은 방식으로 실험 대상이 아니다. 시퀀스를 소비하지 않고 판정 표본에도 들어가지 않는다."

- [ ] **Step 4: 통과 확인**

Run: `pnpm vitest run src/lib/reference-replay.test.ts src/lib/length-experiment.test.ts src/lib/viral-intent-modes.test.ts`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/viral-intent-modes.ts src/lib/reference-replay.ts src/lib/reference-replay.test.ts src/lib/winner-replay.ts src/lib/length-experiment.ts src/lib/length-experiment.test.ts scripts/analyze-post-response.mjs docs/experiments/2026-10-16-post-length.md
git commit -m "feat(replay): ref_replay 모드와 외부 원본 고르기 추가, 길이 실험에서 제외"
```

---

### Task 6: 생성 — 참고 원본으로 1개 쓰기

**Files:**
- Modify: `src/lib/generate-posts.ts` (`GeneratePostsInput`, `generatePostsForBrand` 1095~1200행 공식 결정, 1281행 출처 태그, 669행 참고 글 프롬프트 문구, 1218행 전부 실패 시 throw)
- Test: `src/lib/generate-posts-reference-replay.test.ts` (새 파일, `generate-posts-winner-replay.test.ts`를 본떠 작성)

**Interfaces:**
- Consumes: Task 5 `REFERENCE_REPLAY_MODE`, `REFERENCE_REPLAY_SOURCE_PREFIX`.
- Produces:

```ts
export interface GeneratePostsInput {
  // 기존 5개 유지
  /** 있으면 count는 1로 고정되고, 이 글의 구조만 따르는 ref_replay 글 하나를 만든다. 실험 팔·Thompson 선택·승자 재현을 건너뛴다. */
  referenceReplay?: { id: string; content: string };
}
```

동작: `referenceReplay`가 있으면 `viralIntentMode = REFERENCE_REPLAY_MODE`, `formula = selectCampaignFormulaForViralMode(sourceFormulas, REFERENCE_REPLAY_MODE)`, `experiment.winnerReference = referenceReplay.content`, `experiment.lengthTarget = undefined`, `experiment.closingFormat` 미설정, 저장 시 `qualityReasons`에 `ref_replay_source:<id>`, `formulaId = "ref_replay"`. 프롬프트의 참고 글 머리말(669행)은 ref_replay일 때 `[참고 글: 다른 계정에서 반응이 좋았던 글. 구조만 따르고 주제·소재·문장은 새로 써]`. 모든 초안이 실패해도 `referenceReplay`일 때는 throw 하지 않고 `{ ok: true, summary: { count: 0, failureReasons } }`를 돌려준다.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
const SOURCE = { id: "ex_1", content: "혹시 알고 있어? 한국인 10명 중 7명은 자기가 태어난 시간을 잘못 알고 있다.\n\n..." };
it("writes one ref_replay draft tagged with its source and skips arm planning", async () => {
  state.reply = "점집에서 10만원 내고 들은 말이 '좋은 흐름 온다'뿐이었다면\n\n...";
  await generatePostsForBrand(brand, { count: 3, insertAtFront: false, requestedCampaignId: null, approvedCampaignStart: false, postCategory: "GROWTH", referenceReplay: SOURCE });
  expect(state.created).toHaveLength(1);
  expect(state.created[0].formulaId).toBe("ref_replay");
  expect(JSON.parse(state.created[0].qualityReasons)).toContain("ref_replay_source:ex_1");
  expect(state.requests[0]).toContain("다른 계정에서 반응이 좋았던 글");
  expect(state.requests[0]).toContain("140~260자");
  expect(state.requests[0]).not.toContain("[길이 실험]");
});
it("drops a ref_replay draft that copies the source without throwing", async () => {
  state.reply = SOURCE.content;
  const result = await generatePostsForBrand(brand, { ...input, referenceReplay: SOURCE });
  expect(state.created).toHaveLength(0);
  expect(result.ok && result.summary.count).toBe(0);
  expect(result.ok && result.summary.failureReasons.join(" ")).toMatch(/원본과 너무 비슷함/);
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm vitest run src/lib/generate-posts-reference-replay.test.ts`
Expected: FAIL.

- [ ] **Step 3: 구현**

`count`를 `referenceReplay ? 1 : input.count`로, `lengthArms`는 `referenceReplay`면 `[undefined]`. 배치 루프에서 `referenceReplay`일 때 신년·린·Thompson 분기 앞에서 모드를 고정한다(1150행 `const formula = …` 위).

- [ ] **Step 4: 통과 확인 + 승자 재현 회귀**

Run: `pnpm vitest run src/lib/generate-posts-reference-replay.test.ts src/lib/generate-posts-winner-replay.test.ts src/lib/generate-posts.test.ts`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/generate-posts.ts src/lib/generate-posts-reference-replay.test.ts
git commit -m "feat(replay): 참고 원본의 구조만 따르는 ref_replay 글 생성"
```

---

### Task 7: refill 크론 — 하루 1개 별도 호출

**Files:**
- Modify: `src/app/api/cron/refill/route.ts`
- Create: `src/lib/reference-replay-refill.ts`
- Test: `src/lib/reference-replay-refill.test.ts`, `src/app/api/cron/refill/route.test.ts`

**Interfaces:**
- Consumes: Task 5 `loadReferenceReplaySource`, `markReferenceAttempted`; Task 6 `referenceReplay` 입력; `startOfPublishDay` (`@/lib/account-trust-ramp`); `parseBrandConfig`.
- Produces:

```ts
export type ReferenceRefillResult =
  | { generated: 1; sourceId: string }
  | { generated: 0; skipped: "no_keywords" | "already_today" | "pending_in_queue" | "no_source" | "dropped"; reason?: string };
export async function refillReferenceReplay(brand: Brand, now: Date): Promise<ReferenceRefillResult>;
```

조건 순서: `viralDiscovery.keywords` 0개 → `no_keywords`; 오늘(`startOfPublishDay(now)`) 이후 생성된 `formulaId: "ref_replay"` 글(상태 무관) ≥ 1 → `already_today`; `status: "PENDING"`인 `ref_replay` ≥ 1 → `pending_in_queue`; 원본 없음 → `no_source`; 있으면 `markReferenceAttempted` 뒤 `generatePostsForBrand(brand, { count: 1, insertAtFront: false, requestedCampaignId: null, approvedCampaignStart: false, postCategory: "GROWTH", referenceReplay: source })` → 생성 0개면 `dropped` + `failureReasons`.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// reference-replay-refill.test.ts (prisma.post.count, loadReferenceReplaySource, markReferenceAttempted, generatePostsForBrand 모킹)
it("generates one draft when nothing was made today and none is pending", async () => { /* count → 0, 0; source 있음 → generated 1, markReferenceAttempted 호출 */ });
it("skips with no_keywords when the brand has no keywords", async () => { /* generate 미호출 */ });
it("skips when a ref_replay was created today in any status", async () => { /* 첫 count → 1 → already_today */ });
it("skips when a ref_replay is still PENDING but not when it is NEEDS_REVIEW", async () => { /* count(PENDING) → 1 → pending_in_queue; → 0 → 생성 진행 */ });
it("marks the source attempted even when the draft is dropped", async () => { /* generate → count 0 → dropped, markReferenceAttempted 호출됨 */ });

// refill/route.test.ts (vi.mock("@/lib/reference-replay-refill"))
it("runs the reference replay before the batch and reports it even on backlog_full", async () => {
  mocks.countPosts.mockResolvedValue(12); // backlog_full
  const { body } = await call("brand=cosmicpath&target=10");
  expect(body.skipped).toBe("backlog_full");
  expect(body.referenceReplay).toEqual({ generated: 1, sourceId: "ex_1" });
});
it("keeps the normal batch when the reference replay throws", async () => { /* refillReferenceReplay reject → body.referenceReplay.skipped "dropped" + reason, generated 3 */ });
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm vitest run src/lib/reference-replay-refill.test.ts src/app/api/cron/refill/route.test.ts`
Expected: FAIL.

- [ ] **Step 3: 구현**

라우트: 브랜드를 찾은 직후, backlog 계산 **전에** `const referenceReplay = await refillReferenceReplay(brand, new Date()).catch((e) => ({ generated: 0, skipped: "dropped", reason: message }))`. 모든 응답(backlog_full 포함)에 `referenceReplay`를 넣는다. `maxDuration 300`은 그대로. 재현 1개 + 배치 6개가 넘치면 `MAX_REFILL_PER_RUN`을 5로 내린다(빌더가 로컬 실행 시간으로 판단, 상수 주석에 기록).

- [ ] **Step 4: 통과 확인**

Run: `pnpm vitest run src/lib/reference-replay-refill.test.ts src/app/api/cron/refill/route.test.ts`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/app/api/cron/refill/route.ts src/lib/reference-replay-refill.ts src/lib/reference-replay-refill.test.ts src/app/api/cron/refill/route.test.ts
git commit -m "feat(replay): refill 크론이 하루 1개 ref_replay 글을 배치와 별도로 생성"
```

---

### Task 8: 대시보드 칸 + 보고서 필드

**Files:**
- Modify: `src/lib/viral-service.ts:64-120` (`getViralReport` examples에 `referenceScore`, `timesSeen`)
- Modify: `src/components/Dashboard.tsx:89-104` (`ViralExampleData`), `:1897-1930` (`ViralExampleList`)
- Test: `src/lib/viral-service.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
it("exposes referenceScore and timesSeen from rawMetrics in the report", async () => {
  // viralExample.findMany → rawMetrics '{"referenceScore":73,"timesSeen":3}'
  const report = await getViralReport("brand_1");
  expect(report.examples[0]).toMatchObject({ referenceScore: 73, timesSeen: 3 });
});
```

- [ ] **Step 2: 실패 확인 → 구현 → 통과**

`getViralReport`가 `rawMetrics`를 파싱해 두 숫자(없으면 0)를 넣는다. `ViralExampleList`는 점수 숫자 옆에 `참고 ${referenceScore} · TOP ${timesSeen}회` 한 줄을 더한다. 스타일은 옆 요소와 같은 클래스.

Run: `pnpm vitest run src/lib/viral-service.test.ts`
Expected: PASS.

- [ ] **Step 3: 커밋**

```bash
git add src/lib/viral-service.ts src/lib/viral-service.test.ts src/components/Dashboard.tsx
git commit -m "feat(radar): 대시보드 바이럴 목록에 참고 점수와 TOP 노출 횟수 표시"
```

---

### Task 9: 설정 시드, 전체 검증, 운영 확인

**Files:**
- Create: `scripts/seed-reference-radar.mjs`
- Modify: `README.md` (바이럴 수집 절에 참고 점수·ref_replay 한 단락)

- [ ] **Step 1: 시드 스크립트**

`node --env-file=.env scripts/seed-reference-radar.mjs [--dry-run]`: `cosmicpath`의 `brandConfig.viralDiscovery`에 아래를 **비어 있을 때만** 넣는다(이미 값이 있으면 그대로 두고 출력만). Prisma 조회는 `select: { id, brandConfig, threadsUserId }`로 명시.
- `keywords`: `사주, 궁합, 대운, 일주, 신년운세, 사주 궁합, 재물운, 이직 사주`
- `ownHandle`: 브랜드의 Threads 사용자명. `threadsUserId`로 `GET https://graph.threads.net/v1.0/{id}?fields=username`을 한 번 호출해 얻는다(토큰은 `Brand.accessToken` 복호화 — `.mjs`에서 복호화가 어려우면 `--own-handle=<값>` 인자로 받는다).
- `excludedHandles`: `[]` (사용자가 설정 화면에서 추가).
`--dry-run`이면 최종 값만 출력. 실행 전 사용자에게 보이고 확인받는다.

- [ ] **Step 2: 전체 검증**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`
Expected: 모두 통과.

- [ ] **Step 3: README와 커밋**

```bash
git add scripts/seed-reference-radar.mjs README.md
git commit -m "docs: 레퍼런스 레이더 설정 시드 스크립트와 README 설명 추가"
```

- [ ] **Step 4: 운영 확인 (배포 뒤, 스펙 6장)**

1. 시드 실행 → `viral.yml`을 `workflow_dispatch`로 두 번(12시간 간격 또는 연속 2회) 돌려 `saved`, `errors`를 보고, `rawMetrics.timesSeen ≥ 2`인 행이 생기는지 확인.
2. 다음 refill 실행 응답의 `referenceReplay`가 `{ generated: 1 }` 또는 납득되는 `skipped`인지 확인.
3. 이틀 뒤 아래 SQL이 하루 1건 이하:

```sql
SELECT date_trunc('day', "createdAt" AT TIME ZONE 'Asia/Seoul') AS day, COUNT(*)
FROM "Post" WHERE "formulaId" = 'ref_replay' GROUP BY 1 ORDER BY 1;
```

4. 20개 발행 + 3일 측정 뒤 `node scripts/analyze-post-response.mjs <snapshot> --min-age-days=3`의 formula 차원에서 `ref_replay` 도달 배수와 CI를 읽고 스펙 6장 종료 규칙을 적용한다.

---

## 배포·운영 순서

1. Task 2~8 → `pnpm test/typecheck/lint/build` → 사용자 승인 후 push·PR.
2. 머지 → Vercel 배포 → Task 9 시드 → `viral.yml` 수동 2회 → 이틀 관찰.
3. 20개 뒤 판정. CI 하한 < 1.0이면 `keywords`를 비워 끈다.
4. Meta 앱 심사 통과 시 `scripts/check-threads-discovery.ts` 세 줄 ok 확인 → 스펙 9장 확장(별도 계획).

## 하지 않는 것 (스펙 비목표)

계정 통계·계정 목록(심사 뒤), 유료 데이터 API·스크레이핑, 번안, 인스타·유튜브 계정 모니터링, 새 화면, DB 스키마, cosmicpath-global 적용, 발행 쪽 코드 변경.
