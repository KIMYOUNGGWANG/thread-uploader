# 외부 레퍼런스 레이더 + 구조 재작성 (ref_replay) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사주 계정 20개를 하루 2번 공식 API로 읽어 "참고 점수"가 가장 높은 글을 고르고, 그 구조만 따라 쓴 `ref_replay` 글을 하루 최대 1개 대기열에 넣는다. 길이 실험 표본은 건드리지 않는다.

**Architecture:** 수집은 기존 `viral-harvester` → `viral-service.discoverViralExamples` 경로에 계정 7일 통계(`profile_lookup`)와 참고 점수를 끼운다. 재작성은 기존 `winner_replay`의 프롬프트 경로(`experiment.winnerReference`)·유사도 검사·출처 태그를 새 모드 `ref_replay`가 그대로 쓴다. refill 크론이 평소 배치 **앞에** 별도 호출로 하루 1개를 만든다. 새 순수 로직은 `src/lib/reference-radar.ts`(점수·통계 롤링)와 `src/lib/reference-replay.ts`(원본 고르기) 두 파일에 모은다.

**Tech Stack:** Next.js App Router, TypeScript strict, Prisma 5.22 (스키마 변경 없음), vitest, pnpm, Threads Graph API (`graph.threads.net`).

**Spec:** `docs/superpowers/specs/2026-10-27-reference-replay-design.md`

## Global Constraints

- DB 스키마 변경 없음. 계정 통계는 `brandConfig.viralDiscovery.accountStats`, 글은 `ViralExample.rawMetrics`.
- 새 라이브러리 없음. pnpm. `any` 금지, `unknown` + 좁히기.
- 길이 실험 사전 등록(가설·지표·글 수·판정)은 그대로. 바꾸는 것은 `ref_replay` 제외 규칙 두 곳(`isExperimentPost`, `analyze-post-response.mjs`)과 실험 문서 한 줄뿐.
- `ref_replay`는 하루(KST, `startOfPublishDay`) 최대 1개 생성. 큐에 `PENDING` 상태의 `ref_replay`가 있으면 만들지 않는다.
- 원본 자격: `competitorHandles`에 있는 계정의 글만. 발행 7일 이내. 원문 문장·소재 재사용 금지(프롬프트 규칙 + `checkAntiRepeatSimilarity`).
- 참고 점수 상수(스펙 3.1): 검색 신호 = 기존 `calculateSearchSignalScore`, 모멘텀 상위 1/3 **+30**, 7일 전 대비 상승 **+10**, `has_replies` **+10**, 구조 점수 = 기존 `calculateStructuralSignalScore`.
- 모멘텀 = `views7d / followerCount`. 상승 판정은 **7일 이상 전** 스냅샷과만 비교. 없으면 상승 아님.
- 수집 주기 하루 2회(UTC 0·12시). 핸들 상한 20, 키워드 상한 5.
- 모든 커밋은 conventional commits + 한국어, 파일 이름을 지정해 `git add`. 브랜치 `feat/reference-replay`(이 워크트리). push·PR은 사용자 승인 후.
- 운영 데이터를 쓰는 단계(권한 확인 스크립트, 설정 시드)는 실행 전 사용자에게 알린다.

## Review Focus

1. 운영 토큰에 Advanced Access가 없으면 `profile_lookup`이 권한 오류를 낸다. 그때 수집 전체가 죽지 않고 그 계정의 모멘텀만 null이어야 한다. → Task 3 테스트 "keeps harvesting when profile stats fail".
2. 원본 글이 유사도 검사에 걸려 버려진 날, 다음 날 같은 원본이 또 1위가 되어 영원히 반복되면 안 된다. 시도한 원본은 `rawMetrics.replayAttemptedAt`으로 7일간 제외한다. → Task 5 테스트 "skips a source attempted in the last 7 days", Task 7 Step 3.
3. `NEEDS_REVIEW`로 떨어진 `ref_replay` 글은 아무도 검토하지 않으므로, 그것 때문에 생성이 영원히 막히면 안 된다. "큐에 미발행" 조건은 `PENDING`만 센다. 오늘 생성 수는 모든 상태를 센다. → Task 7 테스트.
4. 핸들 표기 차이(`@`, 대소문자)로 목록 계정 글이 "목록 밖"으로 분류되면 원본이 0개가 된다. 비교는 `@` 제거 + 소문자. → Task 5 테스트 "matches handles case-insensitively".
5. `capturedAt`이 정확히 7일 전인 스냅샷의 경계: 7일 **이상**이면 `previous`로 내린다. → Task 2 테스트.

---

### Task 1: 계정 7일 통계 API + 권한 확인 스크립트 (게이트)

**Files:**
- Modify: `src/lib/threads-api.ts` (`fetchPublicProfilePosts` 옆)
- Create: `scripts/check-threads-discovery.ts`
- Test: `src/lib/threads-api.test.ts`

**Interfaces:**
- Produces:

```ts
export interface ThreadsPublicProfileStats {
  username: string;
  followerCount: number;
  views7d: number;
  likes7d: number;
  reposts7d: number;
}
/** GET {THREADS_DISCOVERY_API_BASE}/profile_lookup?username=&fields=username,follower_count,views_count,likes_count,reposts_count */
export async function fetchPublicProfileStats(accessToken: string, username: string): Promise<ThreadsPublicProfileStats>;
```

- [ ] **Step 1: 실패하는 테스트 작성**

`threads-api.test.ts`의 기존 `fetch` 스텁 방식을 따른다.

```ts
it("maps profile_lookup fields to 7-day stats", async () => {
  // fetch → 200 { username: "the.saju", follower_count: 40000, views_count: 120000, likes_count: 3000, reposts_count: 150 }
  await expect(fetchPublicProfileStats("tok", "@the.saju")).resolves.toEqual({ username: "the.saju", followerCount: 40000, views7d: 120000, likes7d: 3000, reposts7d: 150 });
  // 호출 URL에 username=the.saju ('@' 제거) 포함
});
it("throws the API error message when the lookup is refused", async () => {
  // fetch → 400 { error: { message: "Application does not have permission for this action" } }
  await expect(fetchPublicProfileStats("tok", "the.saju")).rejects.toThrow(/permission/);
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm vitest run src/lib/threads-api.test.ts`
Expected: FAIL, `fetchPublicProfileStats` 없음.

- [ ] **Step 3: 구현**

`fetchPublicProfilePosts`와 같은 `fetch` + 오류 처리. 숫자 칸이 없으면 0. 엔드포인트 경로·필드명은 Meta 문서(Threads Profiles → Retrieve a Threads User's Public Profile Information)로 한 번 확인하고 주석에 문서 URL을 남긴다.

- [ ] **Step 4: 통과 확인**

Run: `pnpm vitest run src/lib/threads-api.test.ts`
Expected: PASS.

- [ ] **Step 5: 권한 확인 스크립트**

`scripts/check-threads-discovery.ts` (실행: `npx tsx scripts/check-threads-discovery.ts`, `scripts/publish-one-global.ts`와 같은 방식. 첫 줄에 `process.loadEnvFile(".env")`로 환경 변수를 읽는다. Node 22 내장이라 라이브러리가 필요 없다). 하는 일: `cosmicpath` 브랜드 토큰을 `getFreshBrandCredentials`로 얻어 `fetchPublicProfileStats(token, "the.saju")`, `fetchPublicProfilePosts(token, "the.saju", 3)`, `searchThreadsByKeyword(token, "사주", 3)`를 순서대로 호출하고 각각 `ok (n건)` 또는 `error: <message>`를 한 줄씩 출력. 종료 코드는 셋 다 ok면 0, 아니면 1. DB에 쓰지 않는다.

- [ ] **Step 6: 커밋**

```bash
git add src/lib/threads-api.ts src/lib/threads-api.test.ts scripts/check-threads-discovery.ts
git commit -m "feat(threads): 공개 프로필 7일 통계 조회와 디스커버리 권한 확인 스크립트 추가"
```

- [ ] **Step 7: 게이트 — 운영 토큰으로 실행 (사용자에게 알린 뒤)**

Run: `npx tsx scripts/check-threads-discovery.ts`
Expected: 세 줄 모두 `ok`. **하나라도 `error: …permission…`이면 여기서 멈추고** 사용자에게 Meta 앱 심사(`threads_profile_discovery`, `threads_keyword_search`, `threads_basic` Advanced Access)가 필요하다고 보고한다. 심사 전에는 Task 2 이후를 진행하지 않는다.

---

### Task 2: 참고 점수와 계정 통계 롤링 (순수 함수)

**Files:**
- Create: `src/lib/reference-radar.ts`
- Modify: `src/types/brand.ts` (`ViralDiscoveryConfig`에 `accountStats`, `normalizeViralDiscovery`)
- Test: `src/lib/reference-radar.test.ts`

**Interfaces:**
- Consumes: `calculateSearchSignalScore`, `calculateStructuralSignalScore`, `SearchSignal` (`@/lib/viral-analysis`).
- Produces:

```ts
// src/types/brand.ts
export interface AccountStat { followerCount: number; views7d: number; likes7d: number; reposts7d: number; capturedAt: string /* ISO */ }
export interface AccountStats { current: AccountStat; previous?: AccountStat }
// ViralDiscoveryConfig에 추가: accountStats: Record<string /* 소문자 핸들 */, AccountStats>  (기본값 {})

// src/lib/reference-radar.ts
export const MOMENTUM_TOP_BONUS = 30;
export const MOMENTUM_RISING_BONUS = 10;
export const HAS_REPLIES_BONUS = 10;
export const PREVIOUS_MIN_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export function normalizeHandle(handle: string): string;                       // '@' 제거, trim, 소문자
export function rollAccountStats(stored: AccountStats | undefined, next: AccountStat): AccountStats;
export function momentumRatio(stats: AccountStats | undefined): number | null;   // views7d / followerCount, followerCount 0이면 null
export function isRising(stats: AccountStats | undefined): boolean;             // previous가 있고 current 비율 > previous 비율
export function momentumBonus(handle: string, all: Record<string, AccountStats>): number; // 상위 1/3이면 +30, 상승이면 +10
export function calculateReferenceScore(input: { signal: SearchSignal; content: string; hasReplies: boolean | null; momentum: number }): number;
```

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
describe("rollAccountStats", () => {
  it("keeps previous until the stored current is at least 7 days old", () => {
    const stored = { current: stat("2026-10-20T00:00:00Z", 100) };
    expect(rollAccountStats(stored, stat("2026-10-26T23:00:00Z", 110)).previous).toBeUndefined();        // 6일 23시간
    expect(rollAccountStats(stored, stat("2026-10-27T00:00:00Z", 110)).previous).toEqual(stored.current); // 정확히 7일
  });
  it("does not replace an older previous with a younger current", () => {
    const stored = { current: stat("2026-10-25T00:00:00Z", 100), previous: stat("2026-10-10T00:00:00Z", 90) };
    expect(rollAccountStats(stored, stat("2026-10-26T00:00:00Z", 120)).previous).toEqual(stored.previous);
  });
});
describe("momentum", () => {
  it("ratio is views7d per follower and null without followers", () => {
    expect(momentumRatio({ current: { ...stat("2026-10-26T00:00:00Z", 2000), followerCount: 1000 } })).toBe(2);
    expect(momentumRatio({ current: { ...stat("2026-10-26T00:00:00Z", 2000), followerCount: 0 } })).toBeNull();
  });
  it("gives +30 to the top third and +10 when rising vs the 7-day-old snapshot", () => {
    const all = { a: ratioStats(3, 1), b: ratioStats(2), c: ratioStats(1) }; // a는 previous 비율 1 → 상승
    expect(momentumBonus("a", all)).toBe(40);
    expect(momentumBonus("b", all)).toBe(0);
    expect(momentumBonus("zzz", all)).toBe(0); // 목록에 없음
  });
});
describe("calculateReferenceScore", () => {
  it("adds search signal, momentum, replies and structure", () => {
    const base = calculateReferenceScore({ signal: {}, content: "평범한 글", hasReplies: null, momentum: 0 });
    expect(calculateReferenceScore({ signal: { searchRank: 1 }, content: "평범한 글", hasReplies: true, momentum: 40 }))
      .toBe(base + calculateSearchSignalScore({ searchRank: 1 }) + 40 + 10);
  });
});
describe("normalizeViralDiscovery accountStats", () => {
  it("keeps well-formed stats and drops malformed entries", () => {
    const parsed = parseBrandConfig(JSON.stringify({ viralDiscovery: { accountStats: { "@The.Saju": { current: stat("2026-10-26T00:00:00Z", 1) }, bad: { current: { followerCount: "x" } } } } }));
    expect(Object.keys(parsed.viralDiscovery.accountStats)).toEqual(["the.saju"]);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm vitest run src/lib/reference-radar.test.ts`
Expected: FAIL, 모듈 없음.

- [ ] **Step 3: 구현**

- `brand.ts`: 타입 추가, `DEFAULT_BRAND_CONFIG.viralDiscovery.accountStats = {}`, `normalizeViralDiscovery`에서 키를 `normalizeHandle`로 정규화하고 숫자 4칸 + ISO 문자열이 아닌 항목은 버린다.
- `reference-radar.ts`: 위 시그니처. `momentumBonus`는 비율이 null인 계정을 빼고 내림차순 정렬 후 `Math.ceil(n / 3)`개를 상위로 본다.

- [ ] **Step 4: 통과 확인**

Run: `pnpm vitest run src/lib/reference-radar.test.ts src/types`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/reference-radar.ts src/lib/reference-radar.test.ts src/types/brand.ts
git commit -m "feat(radar): 참고 점수와 계정 7일 통계 롤링 함수 추가"
```

---

### Task 3: 수집에 계정 통계·참고 점수 끼우기

**Files:**
- Modify: `src/lib/viral-harvester.ts:151,174,201` (핸들 상한 5 → 20, 상수 `MAX_HANDLES = 20`, `MAX_KEYWORDS = 5`)
- Modify: `src/lib/viral-service.ts` (`discoverViralExamples`, `saveCandidate`, `buildDiscoveryRunConfig`)
- Modify: `src/lib/viral-llm-analysis.ts:124-129` (`analyzeTopViralExamples` 대상 선택)
- Test: `src/lib/viral-harvester.test.ts`, `src/lib/viral-service.test.ts`, `src/lib/viral-llm-analysis.test.ts`

**Interfaces:**
- Consumes: Task 1 `fetchPublicProfileStats`, Task 2 전부, `serializeBrandConfigUpdate` (`@/types/brand`).
- Produces: `ViralExample.rawMetrics`에 `referenceScore: number`, `accountMomentum: number`, `eligibleSource: boolean`(저자가 목록 계정), `hasReplies` 유지. `brandConfig.viralDiscovery.accountStats` 갱신.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// viral-harvester.test.ts
it("queries up to 20 handles and 5 keywords", () => { /* attemptedSources가 handles 25개·keywords 7개 입력에 25 */ });

// viral-service.test.ts (prisma·threads-api 모킹은 기존 파일 방식)
it("stores reference score, momentum and eligibility on each saved example", async () => {
  // handles ["the.saju"], fetchPublicProfileStats → followerCount 1000, views7d 3000
  // harvest → the.saju 글 1개(has_replies true), 목록 밖 계정 글 1개
  await discoverViralExamples("brand_1");
  const saved = upsertCalls.map((c) => ({ author: c.create.authorUsername, metrics: JSON.parse(c.create.rawMetrics) }));
  expect(saved.find((s) => s.author === "the.saju")?.metrics).toMatchObject({ eligibleSource: true, accountMomentum: 30 });
  expect(saved.find((s) => s.author !== "the.saju")?.metrics).toMatchObject({ eligibleSource: false, accountMomentum: 0 });
  expect(saved.every((s) => typeof s.metrics.referenceScore === "number")).toBe(true);
});
it("persists accountStats into brandConfig after a run", async () => {
  await discoverViralExamples("brand_1");
  const config = JSON.parse(brandUpdate.mock.calls[0][0].data.brandConfig);
  expect(config.viralDiscovery.accountStats["the.saju"].current).toMatchObject({ followerCount: 1000, views7d: 3000 });
});
it("keeps harvesting when profile stats fail", async () => {
  fetchPublicProfileStats.mockRejectedValue(new Error("Application does not have permission"));
  const result = await discoverViralExamples("brand_1");
  expect(result.saved).toBeGreaterThan(0);
  expect(result.errors).toContainEqual(expect.objectContaining({ adapter: "threads_profile", source: "stats:the.saju" }));
});

// viral-llm-analysis.test.ts
it("analyzes the 5 newest-discovered examples with the highest referenceScore", async () => {
  // findMany → 30건 (discoveredAt desc), rawMetrics.referenceScore 제각각
  // requestAnalyses에 넘어간 id 5개가 referenceScore 상위 5개인지
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm vitest run src/lib/viral-harvester.test.ts src/lib/viral-service.test.ts src/lib/viral-llm-analysis.test.ts`
Expected: 새 케이스 FAIL.

- [ ] **Step 3: 구현**

- `discoverViralExamples`: 하베스트 뒤, `runConfig.handles`마다 `fetchPublicProfileStats` 호출(실패는 `errors`에 `{ adapter: "threads_profile", source: "stats:<handle>", message }`로 넣고 계속). 결과를 `rollAccountStats`로 합쳐 `accountStats`를 만들고 `prisma.brand.update({ data: { brandConfig: serializeBrandConfigUpdate(brand.brandConfig, { viralDiscovery: { ...config.viralDiscovery, accountStats } }) } })`로 저장한다. 각 후보에 `eligibleSource = handles에 normalizeHandle(authorUsername) 포함`, `accountMomentum = momentumBonus(handle, accountStats)`를 넣어 `saveCandidate`에 넘긴다.
- `saveCandidate`: `referenceScore = calculateReferenceScore({ signal: stored.signal, content, hasReplies: rawMetrics.hasReplies, momentum })`를 `rawMetrics`에 함께 저장. `viralScore` 계산은 그대로.
- `analyzeTopViralExamples`: `orderBy: { discoveredAt: "desc" }, take: 30`으로 읽고 메모리에서 `rawMetrics.referenceScore` 내림차순 상위 `ANALYSIS_BATCH_SIZE`(5로 맞춤).
- `buildDiscoveryRunConfig`: 바꾸지 않는다(키워드가 비면 topics 3개를 쓰는 기존 동작은 Task 9 시드로 해결).

- [ ] **Step 4: 통과 확인**

Run: `pnpm vitest run src/lib/viral-harvester.test.ts src/lib/viral-service.test.ts src/lib/viral-llm-analysis.test.ts`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/viral-harvester.ts src/lib/viral-harvester.test.ts src/lib/viral-service.ts src/lib/viral-service.test.ts src/lib/viral-llm-analysis.ts src/lib/viral-llm-analysis.test.ts
git commit -m "feat(radar): 수집 때 계정 7일 통계를 모으고 글마다 참고 점수 저장"
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
it("skips brands with neither handles nor keywords configured", async () => {
  // brand a: viralDiscovery.competitorHandles ["the.saju"]; brand b: 둘 다 빈 배열
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

`prisma.brand.findMany`의 select에 `name`, `brandConfig`를 더하고, `parseBrandConfig(...).viralDiscovery`의 `competitorHandles.length + keywords.length === 0`이면 `results`에 `{ slug, skipped: "no_sources" }`를 넣고 건너뛴다. `externalAllFailed`면 500 응답 전에 브랜드마다 `sendSystemAlert({ level: "error", title: "Viral discovery failed", message: errors를 ", "로 합친 것, brandName })`.

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
git commit -m "feat(radar): 바이럴 수집을 하루 2회로 되살리고 실패 시 경보, 소스 없는 브랜드는 건너뜀"
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
export const SOURCE_MAX_AGE_DAYS = 7;
export const ATTEMPT_COOLDOWN_DAYS = 7;
export interface ReferenceCandidate { id: string; content: string; authorUsername: string | null; publishedAt: Date | null; rawMetrics: string }
export function pickReferenceReplaySource(candidates: ReferenceCandidate[], handles: string[], usedTags: string[], now: Date): ReferenceCandidate | null;
/** 7일 이내 ViralExample(쇼츠 제외) 중 목록 계정 글을 referenceScore 내림차순으로 고른다. 사용 태그는 최근 30일 ref_replay 글의 qualityReasons에서 모은다. */
export async function loadReferenceReplaySource(brandId: string, handles: string[], now: Date): Promise<ReferenceCandidate | null>;
export async function markReferenceAttempted(exampleId: string, now: Date): Promise<void>; // rawMetrics.replayAttemptedAt = now ISO
```

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// reference-replay.test.ts
it("picks the highest referenceScore among listed accounts within 7 days", () => {
  const picked = pickReferenceReplaySource([ex("a", "the.saju", 50, 2), ex("b", "easy_saju", 80, 3), ex("c", "stranger", 99, 1)], ["the.saju", "easy_saju"], [], now);
  expect(picked?.id).toBe("b");
});
it("matches handles case-insensitively and ignores '@'", () => {
  expect(pickReferenceReplaySource([ex("a", "The.Saju", 10, 1)], ["@the.saju"], [], now)?.id).toBe("a");
});
it("skips sources already used and sources attempted in the last 7 days", () => {
  const attempted = { ...ex("a", "the.saju", 90, 1), rawMetrics: JSON.stringify({ referenceScore: 90, replayAttemptedAt: daysAgo(2) }) };
  expect(pickReferenceReplaySource([attempted, ex("b", "the.saju", 50, 1)], ["the.saju"], ["ref_replay_source:b"], now)).toBeNull();
});
it("ignores posts older than 7 days", () => {
  expect(pickReferenceReplaySource([ex("a", "the.saju", 90, 8)], ["the.saju"], [], now)).toBeNull();
});

// length-experiment.test.ts
it("does not count ref_replay posts toward the sequence or the pending arms", () => {
  const posts = [draft("가".repeat(200), "ref_replay"), draft("가".repeat(200), "concept_hierarchy")];
  expect(sequencePosition(posts, config)).toBe(1);
  expect(pickPublishCandidate([draft("가".repeat(420), "ref_replay")], config, "S")?.formulaId).toBe("ref_replay"); // 비실험 글은 팔과 무관하게 통과
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm vitest run src/lib/reference-replay.test.ts src/lib/length-experiment.test.ts`
Expected: FAIL.

- [ ] **Step 3: 구현**

- `isExperimentPost`: `formulaId !== REFERENCE_REPLAY_MODE.id` 조건 추가. `analyze-post-response.mjs:197`의 필터에 `p.formulaId !== "ref_replay"` 추가(주석에 "src/lib/length-experiment.ts isExperimentPost와 같아야 함").
- `loadReferenceReplaySource`: `prisma.viralExample.findMany({ where: { brandId, source: { not: "shorts" }, publishedAt: { gte: now - 7d } }, select: { id, content, authorUsername, publishedAt, rawMetrics } })`와 `prisma.post.findMany({ where: { brandId, formulaId: "ref_replay", createdAt: { gte: now - 30d } }, select: { qualityReasons } })` → `pickReferenceReplaySource`. `loadWinnerReplaySource`의 `parseReasons`를 export해서 재사용.
- 실험 문서 "설계" 절 끝: "- 2026-10-27부터 `ref_replay`(외부 구조 재현) 글은 신년 글과 같은 방식으로 실험 대상이 아니다. 시퀀스를 소비하지 않고 판정 표본에도 들어가지 않는다."

- [ ] **Step 4: 통과 확인**

Run: `pnpm vitest run src/lib/reference-replay.test.ts src/lib/length-experiment.test.ts src/lib/viral-intent-modes.test.ts`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/viral-intent-modes.ts src/lib/reference-replay.ts src/lib/reference-replay.test.ts src/lib/length-experiment.ts src/lib/length-experiment.test.ts scripts/analyze-post-response.mjs docs/experiments/2026-10-16-post-length.md
git commit -m "feat(replay): ref_replay 모드와 외부 원본 고르기 추가, 길이 실험에서 제외"
```

---

### Task 6: 생성 — 참고 원본으로 1개 쓰기

**Files:**
- Modify: `src/lib/generate-posts.ts` (`GeneratePostsInput`, `generatePostsForBrand` 1095~1200행 공식 결정, 1281행 출처 태그, 669행 참고 글 프롬프트 문구)
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

동작: `referenceReplay`가 있으면 `viralIntentMode = REFERENCE_REPLAY_MODE`, `formula = selectCampaignFormulaForViralMode(sourceFormulas, REFERENCE_REPLAY_MODE)`, `experiment.winnerReference = referenceReplay.content`, `experiment.lengthTarget = undefined`, `experiment.closingFormat` 미설정(원본 마무리를 따름), 저장 시 `qualityReasons`에 `ref_replay_source:<id>`, `formulaId = "ref_replay"`. 프롬프트의 참고 글 머리말(669행)은 ref_replay일 때 `[참고 글: 다른 계정에서 반응이 좋았던 글. 구조만 따르고 주제·소재·문장은 새로 써]`.

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
it("drops a ref_replay draft that copies the source", async () => {
  state.reply = SOURCE.content;
  const result = await generatePostsForBrand(brand, { ...input, referenceReplay: SOURCE });
  expect(state.created).toHaveLength(0);
  expect(result.ok && result.summary.failureReasons.join(" ")).toMatch(/원본과 너무 비슷함/);
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm vitest run src/lib/generate-posts-reference-replay.test.ts`
Expected: FAIL.

- [ ] **Step 3: 구현**

`count`를 `referenceReplay ? 1 : input.count`로 바꾸고, 배치 루프에서 `referenceReplay`일 때 신년·린·Thompson 분기 앞에서 모드를 고정한다(1150행 `const formula = …` 위). `lengthArms` 계산은 `referenceReplay`면 `[undefined]`. 모든 초안이 실패하면 기존대로 throw 하지 않도록: 이미 1218행이 0개면 throw 하므로, `referenceReplay`일 때는 throw 대신 `{ ok: true, summary: { count: 0, failureReasons } }`를 돌려준다(refill이 이유를 응답에 남긴다).

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
- Consumes: Task 5 `loadReferenceReplaySource`, `markReferenceAttempted`; Task 6 `referenceReplay` 입력; `startOfPublishDay` (`@/lib/account-trust-ramp`).
- Produces:

```ts
export type ReferenceRefillResult =
  | { generated: 1; sourceId: string }
  | { generated: 0; skipped: "already_today" | "pending_in_queue" | "no_source" | "no_handles" | "dropped"; reason?: string };
export async function refillReferenceReplay(brand: Brand, now: Date): Promise<ReferenceRefillResult>;
```

조건 순서: 핸들 0개 → `no_handles`; 오늘(`startOfPublishDay(now)`) 이후 생성된 `formulaId: "ref_replay"` 글(상태 무관) ≥ 1 → `already_today`; `status: "PENDING"`인 `ref_replay` ≥ 1 → `pending_in_queue`; 원본 없음 → `no_source`; 있으면 `markReferenceAttempted` 뒤 `generatePostsForBrand(brand, { count: 1, insertAtFront: false, requestedCampaignId: null, approvedCampaignStart: false, postCategory: "GROWTH", referenceReplay: source })` → 생성 0개면 `dropped` + `failureReasons`.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// reference-replay-refill.test.ts (prisma.post.count, loadReferenceReplaySource, markReferenceAttempted, generatePostsForBrand 모킹)
it("generates one draft when nothing was made today and none is pending", async () => { /* count → 0, 0; source 있음 → generated 1, markReferenceAttempted 호출 */ });
it("skips when a ref_replay was created today in any status", async () => { /* 첫 count → 1 → already_today, generate 미호출 */ });
it("skips when a ref_replay is still PENDING but not when it is NEEDS_REVIEW", async () => {
  // count(PENDING) → 1 → pending_in_queue; count(PENDING) → 0 (NEEDS_REVIEW만 있음) → 생성 진행
});
it("marks the source attempted even when the draft is dropped", async () => { /* generate → count 0 → dropped, markReferenceAttempted 호출됨 */ });

// refill/route.test.ts
it("runs the reference replay before the batch and reports it even on backlog_full", async () => {
  mocks.countPosts.mockResolvedValue(12); // backlog_full
  const { body } = await call("brand=cosmicpath&target=10");
  expect(body.skipped).toBe("backlog_full");
  expect(body.referenceReplay).toEqual({ generated: 1, sourceId: "ex_1" });
});
it("keeps the normal batch when the reference replay throws", async () => { /* refillReferenceReplay reject → body.referenceReplay.error, generated 3 */ });
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm vitest run src/lib/reference-replay-refill.test.ts src/app/api/cron/refill/route.test.ts`
Expected: FAIL.

- [ ] **Step 3: 구현**

라우트: 브랜드를 찾은 직후, backlog 계산 **전에** `const referenceReplay = await refillReferenceReplay(brand, new Date()).catch((e) => ({ generated: 0, skipped: "dropped", reason: message }))`. 모든 응답(backlog_full 포함)에 `referenceReplay`를 넣는다. `maxDuration 300`은 그대로: 재현 1개(재시도 포함 약 30~60초) + 배치 6개가 한 번에 넘치면 `MAX_REFILL_PER_RUN`을 5로 내린다(빌더가 로컬 실행 시간으로 판단, 상수 주석에 기록).

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
- Modify: `src/lib/viral-service.ts:64-120` (`getViralReport` examples에 `referenceScore`, `accountMomentum`)
- Modify: `src/components/Dashboard.tsx:89-104` (`ViralExampleData`), `:1897-1930` (`ViralExampleList`)
- Test: `src/lib/viral-service.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
it("exposes referenceScore and accountMomentum from rawMetrics in the report", async () => {
  // viralExample.findMany → rawMetrics '{"referenceScore":73,"accountMomentum":30}'
  const report = await getViralReport("brand_1");
  expect(report.examples[0]).toMatchObject({ referenceScore: 73, accountMomentum: 30 });
});
```

- [ ] **Step 2: 실패 확인 → 구현 → 통과**

`getViralReport`가 `rawMetrics`를 파싱해 두 숫자(없으면 0)를 넣는다. `ViralExampleList`는 점수 숫자 옆에 `참고 ${referenceScore} · 모멘텀 +${accountMomentum}` 한 줄을 더한다. 스타일은 옆 요소와 같은 클래스.

Run: `pnpm vitest run src/lib/viral-service.test.ts`
Expected: PASS.

- [ ] **Step 3: 커밋**

```bash
git add src/lib/viral-service.ts src/lib/viral-service.test.ts src/components/Dashboard.tsx
git commit -m "feat(radar): 대시보드 바이럴 목록에 참고 점수와 계정 모멘텀 표시"
```

---

### Task 9: 설정 시드, 전체 검증, 운영 확인

**Files:**
- Create: `scripts/seed-reference-radar.mjs`
- Modify: `README.md` (바이럴 수집 절에 참고 점수·ref_replay 한 단락)

- [ ] **Step 1: 시드 스크립트**

`node --env-file=.env scripts/seed-reference-radar.mjs [--dry-run]`: `cosmicpath`의 `brandConfig.viralDiscovery`에 아래를 **비어 있을 때만** 넣는다(이미 값이 있으면 그대로 두고 출력만).
- `competitorHandles`: `the.saju, dohwadore_life_reader, easy_saju, forceteller_official, wise.saying77, saju.pharmacy, saju.woorisai, gold_pepper_, saju_expert, jaehwe365, pungsu_daddy, ilsang_saju, tianming.shaman, kozumo_room` + 조사 자료(`scratch/saju-astro-competitors-2026-10-22.json`)에서 Threads 팔로워 1천 이상 한국어 계정 중 위에 없는 것(`_t.a.r.o_` 제외), 최대 20개.
- `keywords`: `사주, 궁합, 대운, 일주, 신년운세`.
`--dry-run`이면 최종 목록만 출력. 실행 전 사용자에게 목록을 보이고 확인받는다.

- [ ] **Step 2: 전체 검증**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`
Expected: 모두 통과.

- [ ] **Step 3: README와 커밋**

```bash
git add scripts/seed-reference-radar.mjs README.md
git commit -m "docs: 레퍼런스 레이더 설정 시드 스크립트와 README 설명 추가"
```

- [ ] **Step 4: 운영 확인 (배포 뒤, 스펙 6장)**

1. 시드 실행 → `viral.yml`을 `workflow_dispatch`로 한 번 돌려 응답의 `saved`, `errors`, 그리고 `accountStats`에 계정 20개가 찍혔는지 확인.
2. 다음 refill 실행 응답의 `referenceReplay`가 `{ generated: 1 }` 또는 납득되는 `skipped`인지 확인.
3. 이틀 뒤 아래 SQL이 하루 1건 이하:

```sql
SELECT date_trunc('day', "createdAt" AT TIME ZONE 'Asia/Seoul') AS day, COUNT(*)
FROM "Post" WHERE "formulaId" = 'ref_replay' GROUP BY 1 ORDER BY 1;
```

4. 20개 발행 + 3일 측정 뒤 `node scripts/analyze-post-response.mjs <snapshot> --min-age-days=3`의 formula 차원에서 `ref_replay` 도달 배수와 CI를 읽고 스펙 6장 종료 규칙을 적용한다.

---

## 배포·운영 순서

1. Task 1 → 게이트(권한 확인). 막히면 사용자가 Meta 앱 심사. 심사 전 Task 2 이후 보류.
2. Task 2~8 → `pnpm test/typecheck/lint/build` → 사용자 승인 후 push·PR.
3. 머지 → Vercel 배포 → Task 9 시드 → `viral.yml` 수동 1회 → 이틀 관찰.
4. 20개 뒤 판정. CI 하한 < 1.0이면 `competitorHandles`를 비워 끈다.

## 하지 않는 것 (스펙 비목표)

유료 데이터 API·스크레이핑, 번안, 인스타·유튜브 계정 모니터링, 새 화면, DB 스키마, cosmicpath-global 적용, 발행 쪽 코드 변경.
