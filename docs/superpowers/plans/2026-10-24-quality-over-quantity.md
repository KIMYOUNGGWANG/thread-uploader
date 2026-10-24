# 양보다 질 자동 품질 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사람 검토 없이 글 품질을 지키고, 공식 선택이 실패까지 학습하며, 잘 된 글의 구조를 다시 쓰게 만든다. cosmicpath 글은 사주를 모르는 사람도 끝까지 읽게 만든다 (스펙 8번).

**Architecture:** 기존 생성 파이프라인(`generatePostsForBrand` → `generateWithQuality` → 게이트 → remediation → 저장)은 그대로 두고, 고장 난 지점만 고친다. 새 파일은 `generated-meta-patterns.ts`, `winner-replay.ts`, `english-naturalness.ts`, `readability-rules.ts`, `readability-judge.ts`, `api/cron/regate-pending/route.ts`이고 나머지는 기존 함수 수정이다.

**Tech Stack:** Next.js App Router, TypeScript, Prisma, Vitest, `@anthropic-ai/sdk` (`CLAUDE_TEXT_MODEL`).

**Spec:** `docs/superpowers/specs/2026-10-24-quality-over-quantity-design.md`

## Global Constraints

- DB 스키마·마이그레이션 변경 금지. 운영 DB 데이터 수정 금지.
- 길이 실험(`src/lib/length-experiment.ts`)의 S/L 목표와 배정을 어떤 변경도 바꾸지 않는다. 길이·줄 수 기준(스펙 7번)은 이번 계획에 없다.
- 프로모 영상 글(`video:*` formulaId, `NEEDS_REVIEW`) 경로는 건드리지 않는다.
- 새 의존성 추가 금지.
- 테스트 실행: `npx vitest run <path>`. 타입: `npx tsc --noEmit -p .`. 린트: `npx eslint <path>`.
- 커밋 메시지: conventional commits, 한국어 설명 (예: `fix: ...`, `feat: ...`).
- any 금지. unknown + 타입 좁히기.

## Review Focus

1. 조회수 0인 측정 완료 글이 학습에 들어올 때 `Math.log10(0)`로 prior가 NaN/-Infinity가 되면 안 된다 → Task 3 테스트.
2. 승자 재현 원본 후보가 하나도 없거나(새 브랜드, 중앙값 0) 전부 14일 내 사용됐으면 승자 재현 후보가 아예 뽑히지 않아야 한다 → Task 5 테스트.
3. ANTHROPIC_API_KEY가 없거나 자연스러움 채점 API가 실패하면 글을 막지 않고 통과시킨다(생성이 멈추면 안 됨) → Task 8 테스트.
4. 캠페인 설정에 `d2c_etsy_offer` 같은 오퍼 공식이 있어도 `normalizeCampaigns`가 이름·지시문을 바꾸지 않아야 한다 → Task 6 테스트.
5. 한국어 글의 알고리즘 점수·전문가 패널 점수는 영어 규칙 변경 뒤에도 그대로여야 한다 → Task 7 테스트.
6. 사주 용어 목록이 일상어를 잡으면 안 된다 ("갑자기", "상관없어", "기사", "지지해", "인성 좋은 사람") → Task 9 테스트.
7. 읽힘 판정 API가 실패하거나 키가 없으면 글을 막지 않는다 (Task 8과 같은 원칙) → Task 11 테스트.
8. `imagination_dilemma`가 틀 반복 상한에 걸렸을 때 같은 공식으로 재시도만 반복하다 버려지지 않고, 선택 단계에서 빠져야 한다 → Task 10 테스트.
9. 대기열 재검사 라우트는 `apply=true` 없이는 DB를 바꾸지 않는다 → Task 14 테스트.

---

### Task 1: 지시문 유출 패턴을 한 목록으로 합치기

**Files:**
- Create: `src/lib/generated-meta-patterns.ts`
- Modify: `src/lib/generate-posts.ts:63-75` (로컬 `GENERATED_META_PATTERNS` 삭제, import로 교체)
- Modify: `src/lib/quality-gate.ts:222-234` (같음)
- Modify: `src/lib/publish-safety-gate.ts:14-25` (같음)
- Test: `src/lib/generated-meta-patterns.test.ts`

**Interfaces:**
- Produces: `export const GENERATED_META_PATTERNS: readonly RegExp[]`, `export function hasGeneratedMeta(text: string): boolean`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { hasGeneratedMeta } from "./generated-meta-patterns";
import { checkQuality } from "./quality-gate";

const LEAK = "자기분류 셀프체크형 포스트입니다. 실제 투자/이직 결정 타이밍을 앞둔 독자가 혼자 본문 안에서 자신의 상태를";

describe("hasGeneratedMeta", () => {
  it.each([LEAK, "본문 (482자)", "# Threads Post: 재회", "자수 체크 완료", "===FIRST_COMMENT==="])("flags %s", (text) => {
    expect(hasGeneratedMeta(text)).toBe(true);
  });
  it("passes a normal post", () => {
    expect(hasGeneratedMeta("점집 가서 10만원 복채 내고\n들은 말이 이거였음")).toBe(false);
  });
  it("is enforced by the generation gate, not only at publish", () => {
    const result = checkQuality(`${LEAK}\n경금 일주는 재회 후 불안을 사랑으로 착각함`, "saju_viral");
    expect(result.pass).toBe(false);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run src/lib/generated-meta-patterns.test.ts` → FAIL (module not found)
- [ ] **Step 3: Implement** — 세 목록의 합집합(중복 제거, `/Threads\s*본문/i`처럼 대소문자 무시 버전 유지)을 새 파일에 두고 `hasGeneratedMeta = (text) => GENERATED_META_PATTERNS.some((p) => p.test(text))`. 세 파일의 로컬 상수를 지우고 import로 바꾼다. 기존 사용처 동작(이유 문구 등)은 그대로.
- [ ] **Step 4: Run** `npx vitest run src/lib/generated-meta-patterns.test.ts src/lib/quality-gate.test.ts src/lib/publish-safety-gate.test.ts src/app/api/generate` → PASS
- [ ] **Step 5: Commit** `fix: 지시문 유출 검사를 생성 단계에서도 같은 목록으로 차단`

### Task 2: `/remediate`도 품질 게이트를 통과해야 발행 가능

**Files:**
- Modify: `src/app/api/posts/[id]/remediate/route.ts`
- Test: `src/app/api/posts/[id]/remediate/route.test.ts`

**Interfaces:**
- Consumes: `checkQuality(post, profile, context?)` from `src/lib/quality-gate.ts`

- [ ] **Step 1: Write the failing test** — 기존 테스트 파일의 mock 구조를 따라 추가:
  - `"keeps NEEDS_REVIEW and qualityPass unchanged when the rewrite passes the score but fails the content gate"`: `remediatePostAlgorithmic`이 `{ pass: true, content: "<지시문 유출 문장 포함 본문>" }`을 돌려주면 `prisma.post.update`의 `data.status === "NEEDS_REVIEW"`이고 `data.qualityPass === post.qualityPass`.
  - `"queues the post when both the score and the content gate pass"`: 정상 본문이면 `status === "PENDING"`, `qualityPass === true`.
- [ ] **Step 2: Run** `npx vitest run "src/app/api/posts/[id]/remediate"` → 첫 테스트 FAIL
- [ ] **Step 3: Implement** — `const gate = checkQuality(remediation.content, (post.qualityProfile ?? config.qualityProfile) as QualityProfileId)`; `const passed = remediation.pass && gate.pass`; `status: passed ? "PENDING" : "NEEDS_REVIEW"`, `qualityPass: passed ? true : post.qualityPass`. 응답의 `remediation.pass`는 `passed`.
- [ ] **Step 4: Run** 같은 명령 → PASS
- [ ] **Step 5: Commit** `fix: remediate가 품질 게이트를 통과한 글만 발행 대기열에 넣도록 수정`

### Task 3: 공식 학습이 실패도 기록하게 하기

**Files:**
- Modify: `src/lib/thompson-sampling-router.ts` (`DEFAULT_INFORMATIVE_PRIORS` 삭제, `NEUTRAL_PRIOR` 추가, `updateThompsonPriors`, `sampleBestArm`, `selectFormulaWithThompsonSampling:267`)
- Modify: `src/lib/growth-service.ts:19,100-118`
- Test: `src/lib/thompson-sampling-router.test.ts` (기존 `DEFAULT_INFORMATIVE_PRIORS` describe 블록 삭제), `src/lib/growth-service.test.ts`

**Interfaces:**
- Produces: `export const NEUTRAL_PRIOR: BetaPrior = { alpha: 2, beta: 2 }`. `updateThompsonPriors`의 `minViewsForUpdate` 기본값 0.

- [ ] **Step 1: Write the failing tests** (`thompson-sampling-router.test.ts`)

```ts
it("records low-view posts as failures instead of dropping them", () => {
  const priors = updateThompsonPriors({}, [{ formulaId: "weak", views: 18 }, { formulaId: "weak", views: 0 }] as FormulaPerformanceObservation[], { reward: () => 0 });
  expect(priors.weak.beta).toBeGreaterThan(priors.weak.alpha);
  expect(Number.isFinite(priors.weak.alpha) && Number.isFinite(priors.weak.beta)).toBe(true);
});
it("falls back to a neutral prior for unseen arms", () => {
  const priors = updateThompsonPriors({}, [{ formulaId: "new_arm", views: 300 }] as FormulaPerformanceObservation[], { reward: () => 1 });
  expect(priors.new_arm.alpha - NEUTRAL_PRIOR.alpha).toBeGreaterThan(0);
  expect(priors.new_arm.beta).toBe(NEUTRAL_PRIOR.beta);
});
```

  `growth-service.test.ts`: `"learns only from posts measured for at least 72 hours"` — 발행 24시간 전 글과 100시간 전 글을 주면 저장된 `thompsonPriors`에 100시간 전 글의 공식만 있다.
- [ ] **Step 2: Run** `npx vitest run src/lib/thompson-sampling-router.test.ts src/lib/growth-service.test.ts` → FAIL
- [ ] **Step 3: Implement**
  - `minViews` 기본값 0. `evidenceScale = Math.min(5, Math.max(1, Math.log10(obs.views + 1)))`.
  - 모든 `DEFAULT_INFORMATIVE_PRIORS[...] ?? { alpha: 5, beta: 5 }` 폴백을 `NEUTRAL_PRIOR`로. `customPriors ?? DEFAULT_INFORMATIVE_PRIORS` → `customPriors ?? {}`. `DEFAULT_INFORMATIVE_PRIORS` 상수 삭제.
  - `growth-service`: `observations`를 `publishedAt`이 `MATURITY_HOURS`(`src/lib/weekly-scorecard.ts`) 이전인 글로 거르고, `updateThompsonPriors({}, observations, { reward })`.
- [ ] **Step 4: Run** `npx vitest run src/lib && npx tsc --noEmit -p .` → PASS
- [ ] **Step 5: Commit** `fix: 공식 학습이 조회수 낮은 글을 실패로 기록하고 중립 prior에서 시작하도록 수정`

### Task 4: 게이트를 통과한 생성 글은 모두 자동 발행 대기열로

**Files:**
- Modify: `src/lib/generate-posts.ts:1135-1138` (import 5행 포함)
- Modify: `src/lib/growth-learning.ts:231` (`isAutopilotFormula` 삭제) + `growth-learning.test.ts` 해당 describe 삭제
- Test: `src/app/api/generate/post-route-matrix.test.ts`

- [ ] **Step 1: Write the failing test** — `"queues a gate-passing draft from an unproven formula as PENDING"`: growthMemory에 승자 공식이 없는 브랜드로 생성 시 `prisma.post.create`의 `data.status === "PENDING"`, `data.qualityPass === true`. 기존에 `NEEDS_REVIEW`를 기대하던 테스트는 이 동작으로 고친다.
- [ ] **Step 2: Run** `npx vitest run src/app/api/generate` → FAIL
- [ ] **Step 3: Implement** — `result.qualityPass === false`면 `failureReasons`에 기록하고 `continue`(저장 안 함). 아니면 `postStatus = "PENDING"`. `isAutopilotFormula`와 import 삭제.
- [ ] **Step 4: Run** `npx vitest run src/app/api/generate src/lib/growth-learning.test.ts` → PASS
- [ ] **Step 5: Commit** `feat: 품질 게이트를 통과한 생성 글을 검토 없이 발행 대기열에 넣기`

### Task 5: 승자 재현 후보

**Files:**
- Modify: `src/lib/viral-intent-modes.ts` (`ViralIntentModeId`에 `"winner_replay"`, `WINNER_REPLAY_MODE`, `ENGLISH_VIRAL_MODE_LABELS` 항목, `resolveViralIntentMode`)
- Modify: `src/lib/lean-mode-selector.ts` (`selectLeanViralMode`)
- Create: `src/lib/winner-replay.ts`
- Modify: `src/lib/generate-posts.ts` (`GrowthExperiment.winnerReference`, `buildGenerationPrompt`, 선택 루프 983-1040, 저장 루프)
- Test: `src/lib/winner-replay.test.ts`, `src/lib/lean-mode-selector.test.ts`, `src/lib/viral-intent-modes.test.ts`

**Interfaces:**
- Produces:
  - `export const WINNER_REPLAY_MODE: ViralIntentMode` (id `"winner_replay"`, `VIRAL_INTENT_MODES` 배열에는 넣지 않음 → 기존 순환 배정 불변). instruction: `"아래 참고 글의 구조(첫 줄 방식, 줄 구성, 마무리 방식)만 따라 새 글을 쓴다. 주제·문장·표현은 그대로 쓰지 않는다."`
  - `resolveViralIntentMode("winner_replay", i)` → `WINNER_REPLAY_MODE`
  - `selectLeanViralMode(batchIndex, formulas, priors, recentFormulaIds, winnerReplayAvailable = false): ViralIntentMode` — `true`면 후보 풀에 `WINNER_REPLAY_MODE` 추가
  - `export const WINNER_REPLAY_SOURCE_PREFIX = "winner_replay_source:"`
  - `export interface WinnerCandidatePost { id: string; content: string; views: number }`
  - `export function pickWinnerReplaySource(posts: WinnerCandidatePost[], recentReplayReasons: string[]): WinnerCandidatePost | null` — 순수 함수. 중앙값 × 5 이상(중앙값 0이면 null), `recentReplayReasons`에 `PREFIX+id`가 있는 글 제외, 조회수 최고 글 반환
  - `export async function loadWinnerReplaySource(brandId: string, now: Date): Promise<WinnerCandidatePost | null>` — 최근 60일 `PUBLISHED`·views 있는 글, 최근 14일 생성된 `formulaId: "winner_replay"` 글의 `qualityReasons`를 읽어 `pickWinnerReplaySource` 호출

- [ ] **Step 1: Write the failing tests**

```ts
// winner-replay.test.ts
const posts = [{ id: "a", content: "A", views: 9482 }, { id: "b", content: "B", views: 140 }, { id: "c", content: "C", views: 120 }, { id: "d", content: "D", views: 900 }];
it("picks the top post at 5x the median or more", () => {
  expect(pickWinnerReplaySource(posts, [])?.id).toBe("a");
});
it("skips a source used in the last 14 days", () => {
  expect(pickWinnerReplaySource(posts, [`${WINNER_REPLAY_SOURCE_PREFIX}a`])?.id).toBe("d");
});
it("returns null when nothing qualifies", () => {
  expect(pickWinnerReplaySource([{ id: "x", content: "X", views: 0 }], [])).toBeNull();
  expect(pickWinnerReplaySource([], [])).toBeNull();
});
// lean-mode-selector.test.ts
it("offers winner_replay only when a source is available", () => {
  const priors = { winner_replay: { alpha: 1000, beta: 1 } };
  expect(selectLeanViralMode(0, [], priors, [], true).id).toBe("winner_replay");
  expect(selectLeanViralMode(0, [], priors, [], false).id).not.toBe("winner_replay");
});
// viral-intent-modes.test.ts
it("resolves winner_replay to its own mode", () => {
  expect(resolveViralIntentMode("winner_replay", 0).id).toBe("winner_replay");
});
```

  `d`(900)는 중앙값 140 × 5 = 700 이상이라 두 번째 후보가 된다.
- [ ] **Step 2: Run** `npx vitest run src/lib/winner-replay.test.ts src/lib/lean-mode-selector.test.ts src/lib/viral-intent-modes.test.ts` → FAIL
- [ ] **Step 3: Implement** 위 Interfaces대로. `generate-posts.ts`:
  - 루프 전에 `domainProfile !== "ecommerce_d2c"`일 때만 `const winnerSource = await loadWinnerReplaySource(brandId, new Date())`.
  - `selectLeanViralMode(..., Boolean(winnerSource) && !pickedFormulaIds.includes("winner_replay"))` — 한 번의 생성 실행에서 최대 1개.
  - 뽑힌 mode가 `winner_replay`면 `experiment.winnerReference = winnerSource.content`, 그 초안의 `inBatchPosts`에 `{ content: winnerSource.content }`를 더해 anti-repeat 검사가 원본 베끼기를 잡게 한다.
  - `buildGenerationPrompt`: `experiment.winnerReference`가 있으면 `"[참고 글: 조회수가 높았던 글. 구조만 따르고 주제·문장은 새로 써]\n---\n${reference}\n---"` 블록 추가.
  - 저장 루프: `result.formulaId === "winner_replay" && winnerSource`면 `qualityReasons`에 `${WINNER_REPLAY_SOURCE_PREFIX}${winnerSource.id}` 추가.
  - `lengthTarget` 배정은 다른 초안과 똑같이 둔다.
- [ ] **Step 4: Run** `npx vitest run src/lib src/app/api/generate && npx tsc --noEmit -p .` → PASS
- [ ] **Step 5: Commit** `feat: 조회수 높았던 글의 구조를 따라 쓰는 승자 재현 후보 추가`

### Task 6: global 오퍼 공식이 self_classification으로 바뀌지 않게

**Files:**
- Modify: `src/lib/viral-intent-modes.ts` (`resolveViralIntentMode`)
- Test: `src/lib/viral-intent-modes.test.ts`, `src/types/brand.test.ts` 또는 campaign 관련 기존 테스트

**Interfaces:**
- Produces: `OFFER_FORMULA_MODES: Record<string, ViralIntentModeId>` = `{ synastry_blueprint_offer: "relationship_tension", d2c_etsy_offer: "quiet_contrarian" }` (파일 내부 상수). `LEGACY_FORMULA_MAP`과 `normalizeViralIntentModeId`는 바꾸지 않는다(캠페인 정규화가 쓰므로).

- [ ] **Step 1: Write the failing tests**

```ts
it.each([["synastry_blueprint_offer", "relationship_tension"], ["d2c_etsy_offer", "quiet_contrarian"]])("maps %s to %s, not self_classification", (id, mode) => {
  for (const index of [0, 3, 6]) expect(resolveViralIntentMode(id, index).id).toBe(mode);
});
it("leaves campaign offer formulas untouched", () => {
  const [campaign] = normalizeCampaigns([{ id: "c", formulas: [{ id: "d2c_etsy_offer", name: "Etsy", weight: 2, instruction: "Sell the dossier" }] }]);
  expect(campaign.formulas[0].instruction).toBe("Sell the dossier");
});
```

  두 번째 테스트는 현재도 통과할 수 있다(회귀 방지용). `normalizeCampaigns`의 필수 필드가 더 있으면 기존 테스트 fixture를 따른다.
- [ ] **Step 2: Run** `npx vitest run src/lib/viral-intent-modes.test.ts` → 첫 테스트 FAIL
- [ ] **Step 3: Implement** — `resolveViralIntentMode`에서 `normalizeViralIntentModeId`가 null일 때 `OFFER_FORMULA_MODES[formulaId]`를 먼저 보고, 없으면 기존 fallback.
- [ ] **Step 4: Run** `npx vitest run src/lib src/types` → PASS
- [ ] **Step 5: Commit** `fix: global 오퍼 공식이 자기분류 모드로 바뀌던 문제 수정`

### Task 7: 영어 첫 줄 규칙을 한 방향으로

**Files:**
- Modify: `src/lib/domain-registry.ts:29-30` (`ENGLISH_HOOK_RULE`)
- Modify: `src/lib/quality-gate.ts:338-396` (`ENGLISH_HOOK_PATTERNS` 삭제, `checkEcommerceD2CQuality`)
- Modify: `src/lib/threads-algorithm-scorer.ts:45-135`
- Modify: `src/lib/expert-panel-evaluator.ts:75-85`
- Modify: `src/lib/remediation-engine.ts:159-185` (재작성 프롬프트)
- Test: `quality-gate.test.ts`, `threads-algorithm-scorer.test.ts`, `expert-panel-evaluator.test.ts`, `remediation-engine.test.ts`, `domain-registry.test.ts`

**Interfaces:**
- Produces: `export function isFlatEnglishHook(firstLine: string): boolean` in `quality-gate.ts` — 60자 이하이고 `?`가 없으면 true. `export function buildRewritePrompt(content: string, weakest: { name: string; score: number; maxScore: number; actionableFix: string }, context: RemediationContext | undefined, isEnglish: boolean): string` in `remediation-engine.ts`.

- [ ] **Step 1: Write the failing tests**

```ts
// quality-gate.test.ts
it("fails an English question hook even with astro and contrast words", () => {
  expect(checkQuality("Is your birth hour actually wrong, instead?\nYour saju day master reads it differently.", "ecommerce_d2c").pass).toBe(false);
});
it("passes a flat English claim with an astro term", () => {
  expect(checkQuality("Your Saturn return is not a breakdown.\nIn saju, 29 is a handover year, not a crisis.", "ecommerce_d2c").pass).toBe(true);
});
// domain-registry.test.ts
it("no longer tells the model to use wrong/instead", () => {
  expect(ENGLISH_HOOK_RULE).not.toMatch(/wrong|instead/);
});
// threads-algorithm-scorer.test.ts
it("does not reward a question mark on an English first line", () => {
  const q = scoreThreadsPostAlgorithmic("Is your birth hour actually wrong, instead?\nbody line").dimensions.hookTension.score;
  const flat = scoreThreadsPostAlgorithmic("Your birth hour is not the problem.\nbody line").dimensions.hookTension.score;
  expect(flat).toBeGreaterThanOrEqual(q);
});
it("keeps Korean hook scoring unchanged", () => {
  expect(scoreThreadsPostAlgorithmic("혹시 너도 이거 착각하고 있어?\n본문").dimensions.hookTension.score).toBe(<현재 main에서 측정한 값>);
});
// expert-panel-evaluator.test.ts
it("gives no question-mark bonus to English first lines", () => {
  expect(evaluateRoyLee("Why is your chart wrong?\nbody").score).toBeLessThanOrEqual(evaluateRoyLee("Your chart is not wrong.\nbody").score);
});
// remediation-engine.test.ts
it("builds an English rewrite prompt without the add-a-question rule", () => {
  const prompt = buildRewritePrompt("Your chart is not wrong.", { name: "hook", score: 5, maxScore: 25, actionableFix: "x" }, undefined, true);
  expect(prompt).not.toMatch(/[가-힣]/);
  expect(prompt).not.toMatch(/question/i);
});
```

  `hookTension`, `evaluateRoyLee().score`는 실제 필드명에 맞춘다. 한국어 고정값은 구현 전 main에서 한 번 측정해 넣는다.
- [ ] **Step 2: Run** 위 5개 테스트 파일 → FAIL
- [ ] **Step 3: Implement**
  - `ENGLISH_HOOK_RULE`: `"line 1 is the hook alone on its own line, under 60 characters, a flat declarative claim a native speaker would actually write, that flips an assumption about this post's own subject: no question mark, no 'vs'"`.
  - `checkEcommerceD2CQuality`: 한글 검사 유지. `pass = isFlatEnglishHook(firstLine) && (hasAstroTerm || hasContrastOrConflict)`. 실패 이유 문구 유지·추가.
  - scorer: 첫 줄에 한글이 없으면 `?`와 `wrong|myth|not your|isn't|actually|really|instead|different` 가산을 적용하지 않고, `isFlatEnglishHook`면 +8. 한글 첫 줄은 기존 로직 그대로.
  - 전문가 패널: 영어면 `?` +8 없음, 12점 정규식에서 `why|how|what|actually|instead` 제거.
  - remediation: 프롬프트 생성을 `buildRewritePrompt`로 빼고, `isEnglish`면 영어 프롬프트(규칙 2는 `englishRewriteChecklist(formulaId)`, 질문 추가 지시 없음). 한국어 프롬프트는 문구 그대로.
- [ ] **Step 4: Run** `npx vitest run src/lib && npx tsc --noEmit -p .` → PASS
- [ ] **Step 5: Commit** `fix: 영어 첫 줄 규칙을 프롬프트·게이트·점수에서 평서문 기준으로 통일`

### Task 8: 영어 자연스러움 AI 채점

**Files:**
- Create: `src/lib/english-naturalness.ts`
- Modify: `src/lib/generate-posts.ts` (`generateWithQuality`의 재시도 루프)
- Test: `src/lib/english-naturalness.test.ts`

**Interfaces:**
- Produces: `export interface NaturalnessVerdict { natural: boolean; reason: string }`, `export async function judgeEnglishNaturalness(post: string): Promise<NaturalnessVerdict>`, `export function parseNaturalnessVerdict(text: string): NaturalnessVerdict`

- [ ] **Step 1: Write the failing tests**

```ts
it("parses a JSON verdict", () => {
  expect(parseNaturalnessVerdict('{"natural": false, "reason": "\\"actually wrong, instead\\" stacks two hedges"}')).toEqual({ natural: false, reason: '"actually wrong, instead" stacks two hedges' });
});
it("treats unparseable output as natural", () => {
  expect(parseNaturalnessVerdict("sure!").natural).toBe(true);
});
it("passes without an API key", async () => {
  delete process.env.ANTHROPIC_API_KEY;
  expect((await judgeEnglishNaturalness("Is your birth hour actually wrong, instead?")).natural).toBe(true);
});
it("passes when the API call fails", async () => { /* mock Anthropic.messages.create to reject → natural true */ });
```

- [ ] **Step 2: Run** `npx vitest run src/lib/english-naturalness.test.ts` → FAIL
- [ ] **Step 3: Implement**
  - `CLAUDE_TEXT_MODEL`, `thinking: { type: "disabled" }`, `output_config: { effort: "low" }`, `max_tokens: 200`, 타임아웃 20초(`remediation-engine.ts`와 같은 클라이언트 설정). 응답은 `readMessageText`로 읽는다.
  - 프롬프트: 원어민 편집자로서 이 Threads 글에 원어민이 쓰지 않을 어색한 문장(겹친 hedge, 번역투, 억지 질문)이 있으면 `{"natural": false, "reason": "<어느 문장이 왜>"}`, 없으면 `{"natural": true, "reason": ""}`만 출력.
  - 키 없음·API 오류·파싱 실패는 `{ natural: true }` + `console.warn` (생성 중단 방지).
  - `generateWithQuality`: `isEnglish`이고 동기 게이트가 통과한 경우에만 채점. `natural: false`면 `{ ...gate, pass: false, reasons: [\`unnatural English: ${reason}\`, ...gate.reasons] }`로 바꿔 기존 재시도 피드백에 태운다. remediation 후 `regate`(동기)는 그대로.
- [ ] **Step 4: Run** `npx vitest run src/lib/english-naturalness.test.ts src/app/api/generate` → PASS
- [ ] **Step 5: Commit** `feat: 영어 글 자연스러움 AI 채점 추가`

### Task 9: 읽히는 글 — 코드 검사 (용어 상한·답할 수 없는 질문·가짜 경험담)

스펙 8번 "코드로 검사". 대상은 `saju_viral` 프로필(cosmicpath 한국어 생성 글)만이다. 프로모 영상 글은 생성 게이트를 타지 않으므로 영향 없다.

**Files:**
- Create: `src/lib/readability-rules.ts`
- Modify: `src/lib/generate-posts.ts` (`generateWithQuality`의 `runQualityGate`, 298-344행)
- Test: `src/lib/readability-rules.test.ts`

**Interfaces:**
- Produces:
  - `export const SAJU_JARGON_TERMS: readonly string[]` — 독자가 모르는 전문 용어만. 포함: 십성(편인·식신·재성·관성·비견·겁재·정인·편관·정관·정재·편재·식상·비겁), 살(도화살·역마살·화개살·홍염살·원진살·귀문관살), 귀인(천을귀인·문창귀인·월덕귀인), 원국·사주원국·대운·세운·일간·일주·신강·신약·용신·교운기·삼합·방합. **제외**: 사주·팔자·운세·궁합(일상어), 상관·인성·지지·천간(일상어와 겹침), 60갑자 이름(갑자→"갑자기", 기사→"기사" 오탐).
  - `export function findJargonTerms(text: string): string[]` — 본문에 나온 서로 다른 용어 목록.
  - `export function checkReadabilityRules(post: string, firstComment: string): { pass: boolean; reasons: string[] }`
    - 서로 다른 용어 2개 이상 → `"사주 용어 N개(…): 1개까지만, 쓰면 바로 쉬운 말로 풀어줘"`
    - 본문 마지막 물음표 문장 또는 첫 댓글(링크 줄 제외)에 용어가 있거나 `/(네|너의?|니|본인|당신의?)\s*사주/`에 걸리면 → `"독자가 답할 수 없는 질문: 자기 경험만으로 답할 수 있게"`
    - 첫 댓글에 `/(^|\s)(난|나도|나는|내가)\s[^\n]{0,60}(다가|었음|았음|였음|었어|았어|었다|았다)/`가 걸리면 → `"첫 댓글에 지어낸 1인칭 경험담 금지"`

- [ ] **Step 1: Write the failing tests** (`readability-rules.test.ts`, 22개 대기열 원문에서 가져온 예시)

```ts
it("fails a post with several jargon terms", () => {
  const r = checkReadabilityRules("결혼 얘기만 나오면 끊기지?\n밀어붙이는 쪽의 겁재가 아니라 기다리는 쪽 정관이 원인임.", "어떻게 생각해?");
  expect(r.pass).toBe(false);
});
it("passes one term with plain words around it", () => {
  expect(checkReadabilityRules("새벽 2시 \"자?\"는 설렘보다 외로움일 때가 많음.\n사주로 치면 도화살, 끌림이 잠깐 켜지는 신호임.\n답장은 아침에 해도 늦지 않음.", "너라면 바로 답장해, 아침까지 둬?").pass).toBe(true);
});
it("fails a closing question the reader can't answer", () => {
  expect(checkReadabilityRules("연락 텀보다 중요한 게 있음.\n너 원국에서 정관이 어느 자리에 앉아 있어?", "").pass).toBe(false);
  expect(checkReadabilityRules("본문 한 줄", "혹시 네 사주에도 이런 구조 있는지 떠올려 봐.").pass).toBe(false);
});
it("fails a made-up first-person story in the first comment", () => {
  expect(checkReadabilityRules("본문 한 줄", "난 솔직히 3번 골랐다가 지분 반 넘겨주고 1년 뒤에 연락 끊었음. 너넨 몇 번임?").pass).toBe(false);
});
it.each(["갑자기 연락 옴", "상관없어", "기사 봤어?", "지지해줄게", "인성 좋은 사람"])("does not count everyday words: %s", (text) => {
  expect(findJargonTerms(text)).toEqual([]);
});
```

- [ ] **Step 2: Run** `npx vitest run src/lib/readability-rules.test.ts` → FAIL (module not found)
- [ ] **Step 3: Implement** — 위 Interfaces대로. `runQualityGate`에서 `experiment.qualityProfile === "saju_viral"`일 때 `checkReadabilityRules(post, firstComment)`가 실패하면 기존 패턴대로 `gate = { ...gate, pass: false, reasons: [...r.reasons, ...gate.reasons] }`. 이유 문구는 그대로 재시도 피드백이 된다.
- [ ] **Step 4: Run** `npx vitest run src/lib/readability-rules.test.ts src/app/api/generate` → PASS. 기존 생성 테스트 fixture가 용어 2개 이상 본문을 쓰다 깨지면 fixture를 용어 1개로 고친다 (검사를 약하게 하지 않는다).
- [ ] **Step 5: Commit** `feat: 사주 용어 과다·답할 수 없는 질문·가짜 경험담을 생성 게이트에서 차단`

### Task 10: 같은 틀 반복 상한

스펙 8번 "틀 반복 상한". 최근 10개 중 번호 선택지로 끝나는 글, 첫 두 줄에 "X가 아니라 Y" 뒤집기가 있는 글은 각각 3개까지.

**Files:**
- Modify: `src/lib/readability-rules.ts`
- Modify: `src/lib/lean-mode-selector.ts` (`selectLeanViralMode`)
- Modify: `src/lib/generate-posts.ts` (선택 루프 1007-1016행 `selectLeanViralMode` 호출, `runQualityGate`)
- Test: `src/lib/readability-rules.test.ts`, `src/lib/lean-mode-selector.test.ts`

**Interfaces:**
- Produces (`readability-rules.ts`):
  - `export function endsWithNumberedChoices(post: string): boolean` — `/^\s*([1-3]|[A-C])[.)]?\s/m`에 맞는 줄이 2개 이상
  - `export function opensWithReversal(post: string): boolean` — 첫 두 줄에 `/아니라|아님(?![가-힣])|이 아니고/`
  - `export const TEMPLATE_CAP = 3`, `export const TEMPLATE_WINDOW = 10`
  - `export function checkTemplateCap(post: string, recent: readonly { content: string }[]): { pass: boolean; reasons: string[] }` — `recent.slice(0, TEMPLATE_WINDOW)`에서 같은 틀이 이미 `TEMPLATE_CAP`개 이상이고 후보도 그 틀이면 실패. 이유: `"최근 10개 중 번호 선택지 글이 이미 N개: 다른 마무리로"` / `"최근 10개 중 'X가 아니라 Y' 첫 줄이 이미 N개: 다른 훅으로"`
- `selectLeanViralMode(batchIndex, formulas, priors, recentFormulaIds, winnerReplayAvailable = false, excludedModeIds: readonly string[] = [])` (`lean-mode-selector.ts:68`, 5번째 인자는 Task 5가 추가함. 호출처는 `generate-posts.ts` 한 곳) — 제외된 모드는 후보 풀에서 뺀다. 풀이 비면 제외 없이 원래대로 고른다.

- [ ] **Step 1: Write the failing tests**

```ts
const choice = "고민임\n1. 바로 간다\n2. 기다린다\n3. 기록한다";
const plain = "그냥 한 줄 생각\n오늘은 여기까지";
it("fails the 4th numbered-choice post in the last 10", () => {
  expect(checkTemplateCap(choice, [choice, choice, choice, plain].map((content) => ({ content }))).pass).toBe(false);
});
it("passes when the window holds fewer than the cap", () => {
  expect(checkTemplateCap(choice, [choice, choice, plain].map((content) => ({ content }))).pass).toBe(true);
});
it("only counts the most recent 10", () => {
  const recent = [...Array(10).fill(plain), choice, choice, choice].map((content) => ({ content }));
  expect(checkTemplateCap(choice, recent).pass).toBe(true);
});
it("detects a reversal opener", () => {
  expect(opensWithReversal("새벽 연락은 설렘이 아니라 계산임.\n둘째 줄")).toBe(true);
  expect(opensWithReversal("새벽 연락이 왔음.\n둘째 줄")).toBe(false);
});
// lean-mode-selector.test.ts
it("skips an excluded mode even with a dominant prior", () => {
  const priors = { imagination_dilemma: { alpha: 1000, beta: 1 } };
  expect(selectLeanViralMode(0, [], priors, [], false, ["imagination_dilemma"]).id).not.toBe("imagination_dilemma");
});
```

- [ ] **Step 2: Run** `npx vitest run src/lib/readability-rules.test.ts src/lib/lean-mode-selector.test.ts` → FAIL
- [ ] **Step 3: Implement**
  - `generate-posts.ts` 선택 루프: 각 초안을 고르기 전에 `inBatchPosts`(같은 배치 결과 + `recentPosts`, 최신순) 기준으로 번호 선택지 상한에 걸렸으면 `excludedModeIds = ["imagination_dilemma"]`를 넘긴다. `imagination_dilemma`는 번호 선택지가 필수라서(`findFormulaShapeViolation`) 게이트에서만 막으면 재시도만 반복하다 버려진다.
  - `runQualityGate`: `saju_viral`이면 `checkTemplateCap(post, recentPosts)` 실패를 기존 패턴대로 이유에 더한다 (뒤집기 첫 줄과, 다른 공식이 번호 선택지를 쓴 경우를 막는 안전망).
- [ ] **Step 4: Run** `npx vitest run src/lib src/app/api/generate` → PASS
- [ ] **Step 5: Commit** `feat: 번호 선택지·뒤집기 첫 줄 틀이 최근 글에 몰리지 않게 상한 추가`

### Task 11: 읽힘 AI 판정

스펙 8번 "LLM 판정". Task 8(`english-naturalness.ts`)과 같은 구조·같은 실패 시 동작으로 만든다.

**Files:**
- Create: `src/lib/readability-judge.ts`
- Modify: `src/lib/generate-posts.ts` (`generateWithQuality`의 `gateWithNaturalness`, 348-353행)
- Test: `src/lib/readability-judge.test.ts`

**Interfaces:**
- Produces: `export interface ReadabilityVerdict { readable: boolean; reason: string }`, `export async function judgeReadability(post: string, firstComment: string): Promise<ReadabilityVerdict>`, `export function parseReadabilityVerdict(text: string): ReadabilityVerdict`

- [ ] **Step 1: Write the failing tests**

```ts
it("fails when any of the three answers is no", () => {
  expect(parseReadabilityVerdict('{"keepReading": true, "understandable": false, "takeaway": true, "reason": "재성·겁재 풀이 없음"}')).toEqual({ readable: false, reason: "재성·겁재 풀이 없음" });
});
it("passes when all three are yes", () => {
  expect(parseReadabilityVerdict('{"keepReading": true, "understandable": true, "takeaway": true, "reason": ""}').readable).toBe(true);
});
it("treats unparseable output as readable", () => {
  expect(parseReadabilityVerdict("네!").readable).toBe(true);
});
it("passes without an API key", async () => {
  delete process.env.ANTHROPIC_API_KEY;
  expect((await judgeReadability("본문", "댓글")).readable).toBe(true);
});
it("passes when the API call fails", async () => { /* mock Anthropic.messages.create to reject → readable true */ });
```

- [ ] **Step 2: Run** `npx vitest run src/lib/readability-judge.test.ts` → FAIL
- [ ] **Step 3: Implement**
  - 모델·클라이언트 설정은 Task 8과 같다 (`CLAUDE_TEXT_MODEL`, thinking off, effort low, `max_tokens: 200`, 타임아웃 20초, `readMessageText`).
  - 프롬프트(한국어): 기준 독자는 "사주를 모르는 25~35세. 썸·이별·이직 고민이 있고, 피드에서 첫 두 줄만 보고 계속 읽을지 정한다". 이 독자로서 세 질문에 답한다. ① 첫 두 줄만 보고 계속 읽고 싶은가 ② 사주를 몰라도 모든 문장의 뜻을 이해할 수 있는가 ③ 다 읽고 오늘 바로 써먹을 생각이나 행동이 하나 남는가 ("네 원국을 봐야 안다"는 남는 것으로 치지 않는다). `{"keepReading": bool, "understandable": bool, "takeaway": bool, "reason": "<아니오인 항목과 걸린 문장>"}`만 출력.
  - `readable = keepReading && understandable && takeaway`. 키 없음·API 오류·파싱 실패는 `{ readable: true }` + `console.warn`.
  - `generateWithQuality`의 `gateWithNaturalness`(Task 8)에 붙인다: `experiment.qualityProfile === "saju_viral"`이고 동기 게이트가 통과한 경우에만 판정. `readable: false`면 `{ ...gate, pass: false, reasons: [\`읽힘 판정 실패: ${reason}\`, ...gate.reasons] }`로 바꿔 기존 재시도 피드백에 태운다. `regate`가 이제 이 비동기 게이트라서 remediation으로 고친 글도 같은 판정을 거친다 (판정에 떨어진 재작성은 원본으로 되돌아간다). 함수 이름이 역할과 안 맞으면 `gateWithJudges` 등으로 바꿔도 된다.
- [ ] **Step 4: Run** `npx vitest run src/lib/readability-judge.test.ts src/app/api/generate` → PASS
- [ ] **Step 5: Commit** `feat: 사주 모르는 독자 기준 읽힘 AI 판정 추가`

### Task 12: 소재를 한 사람의 한 상황으로 짝 맞추기

스펙 원인 7번 — `resolveDynamicContext`가 persona·friction을 따로 골라 "재회한 사람이 동업 얘기를 꺼냈을 때" 같은 상황을 만든다.

**Files:**
- Modify: `src/lib/context-matrix-engine.ts` (`saju_viral` 38-69행, `saju_relationship` 71-102행 매트릭스, `resolveDynamicContext` 236-263행)
- Test: `src/lib/context-matrix-engine.test.ts`
- Depends on: Task 9 (`findJargonTerms`)

**Interfaces:**
- 매트릭스 타입에 `pairedFrictions?: true`를 더한다. 이 값이 있는 매트릭스는 `friction = frictions[personaIndex]`로 persona와 같은 위치의 friction만 쓴다. tension은 지금처럼 따로 고른다. 다른 매트릭스(career_decision 등)는 동작 그대로.

- [ ] **Step 1: Write the failing tests**

```ts
it.each(["saju_relationship", "saju_viral"])("always pairs persona i with friction i in %s", (domainId) => {
  for (let index = 0; index < 200; index++) {
    const ctx = resolveDynamicContext({ domainId, index });
    const matrix = DOMAIN_MATRICES[domainId];
    expect(matrix.personas.indexOf(ctx.persona)).toBe(matrix.frictions.indexOf(ctx.friction));
  }
});
it("keeps pairing when contextWeights pick the persona", () => {
  const ctx = resolveDynamicContext({ domainId: "saju_relationship", index: 1, contextWeights: { personaWeights: { "친한 친구에게 동업을 제안받은 직장인": 100 }, epsilon: 0.01 } });
  expect(ctx.friction).toBe("친한 사이라 거절하기 어려운 동업 제안");
});
it.each(["saju_viral", "saju_relationship"])("has at most one jargon term per seed line in %s", (domainId) => {
  const { personas, frictions, tensions } = DOMAIN_MATRICES[domainId];
  for (const line of [...personas, ...frictions, ...tensions]) expect(findJargonTerms(line).length).toBeLessThanOrEqual(1);
});
```

  기존 `src/lib/context-matrix-engine.test.ts`에 추가한다. `resolveDynamicContext` 옵션 필수 필드는 실제 타입에 맞춘다.
- [ ] **Step 2: Run** `npx vitest run src/lib/context-matrix-engine.test.ts` → FAIL
- [ ] **Step 3: Implement**
  - `saju_relationship.frictions`를 persona 순서에 맞게 재배열한다 (예: 썸 3주차 ↔ 읽씹·칼답, 이별 2주 ↔ 새벽 연락, 4년차 결혼 ↔ 결혼 시기·집 문제, 짝사랑 ↔ 먼저 고백하면 지는 눈치 싸움, 동업 제안 ↔ 거절하기 어려운 동업 제안, 상견례 ↔ 생활 리듬 다툼, 장거리 ↔ 만날 때만 좋은 거리감, 재회 ↔ SNS 보는 어정쩡한 거리). 문구는 바꾸지 않는다 (기존 `contextWeights` 키 유지).
  - `saju_viral.frictions`는 이미 일상어라 persona에 맞게 재배열만 한다. 길이가 persona와 다르면 짝이 맞게 맞춘다.
  - `saju_viral.tensions`(59-68행)는 용어 덩어리다 ("식상 과다(실행·창작욕 80%) vs 관성…", "편인 과다…", "비견·겁재 과다…", "재성 결핍…"). 이 글감이 그대로 본문 용어 과다로 이어진다. 각 줄을 쉬운 말 갈등으로 바꾸고 용어는 줄당 최대 1개만 남긴다. 예: `"하고 싶은 게 많은 기질인데 조직은 위계만 따르라는 충돌"`, `"생각만 많고 손이 안 움직이는 시기"`. tensions는 `contextWeights` 키가 아니라 문구를 바꿔도 된다.
  - `pairedFrictions: true`를 두 매트릭스에 넣고, `resolveDynamicContext`에서 탐색·가중치 두 경로 모두 persona를 먼저 고른 뒤 같은 인덱스의 friction을 쓴다.
- [ ] **Step 4: Run** `npx vitest run src/lib` → PASS
- [ ] **Step 5: Commit** `fix: 서로 관계없는 인물과 상황이 한 글에 섞이지 않게 소재 짝 맞추기`

### Task 13: 프롬프트·공식 규칙이 용어를 강요하지 않게

게이트만 빡빡하고 프롬프트가 용어를 권하면 탈락만 늘어난다. 지금 프롬프트가 직접 시키는 것:
- `generate-posts.ts:728` "본문에 사주 용어를 **최소 1개** 넣는다 (예: 일간, 일주, 재성…)"
- `viral-intent-modes.ts:210` `concept_hierarchy` "실제 사주 개념 2~3개(살·십신·일주)를 서열이나 대비로 비교"
- `viral-intent-modes.ts:214` "첫 댓글: 독자 원국에 이 개념이 있는지 묻는 한 줄"
- `domain-registry.ts:118` concept_hierarchy 공식 instruction에 같은 "사주 개념 2~3개" 문구

**Files:**
- Modify: `src/lib/generate-posts.ts` (`SAJU_VIRAL_REQUIREMENTS` 정의 750행, 사용 743행)
- Modify: `src/lib/viral-intent-modes.ts` (`concept_hierarchy` 206행부터, fidelity 체크 89행 확인)
- Modify: `src/lib/domain-registry.ts:114`
- Test: `src/lib/viral-intent-modes.test.ts`, `src/app/api/generate` 프롬프트 스냅샷/문자열 테스트

**Interfaces:**
- 품질 게이트의 "사주 단어 최소 1개"(`quality-gate.ts:445-450`, `SAJU_KEYWORDS`)는 그대로 둔다. 사주·궁합·팔자·운세 같은 일상어로 충족되므로 Task 9의 용어 상한과 충돌하지 않는다.

- [ ] **Step 1: Write the failing tests**

```ts
it("concept_hierarchy no longer asks for 2-3 saju concepts or the reader's chart", () => {
  const mode = resolveViralIntentMode("concept_hierarchy", 0);
  const text = [mode.instruction, ...mode.rules].join("\n");
  expect(text).not.toMatch(/2~3개|십신|원국/);
});
it("saju_viral prompt caps jargon at one term instead of requiring it", () => {
  const prompt = /* 기존 테스트가 buildGenerationPrompt 결과를 얻는 방식 그대로 */;
  expect(prompt).not.toContain("사주 용어를 최소 1개");
  expect(prompt).toContain("사주 전문 용어는 1개까지");
});
```

- [ ] **Step 2: Run** 위 테스트 파일 → FAIL
- [ ] **Step 3: Implement**
  - `SAJU_VIRAL_REQUIREMENTS` 첫 항목 교체: `"- 사주·궁합·운세 같은 단어는 자연스럽게 1번 이상 나온다. 사주 전문 용어(일간·재성·관성·도화살 등)는 1개까지만 쓰고, 쓰면 그 문장이나 바로 다음 문장에서 쉬운 말로 푼다."` 그 아래에 `"- 기준 독자는 사주를 모르는 25~35세다. 독자가 자기 사주를 몰라도 오늘 써먹을 생각이나 행동 하나를 남긴다."`, `"- 마지막 질문과 첫 댓글은 독자가 자기 경험만으로 답할 수 있어야 한다. 독자의 원국·일주·사주 구조를 묻지 않는다."`, `"- 첫 댓글에 지어낸 1인칭 경험담을 쓰지 않는다."` 추가.
  - `concept_hierarchy` instruction·rules: "용어 서열"이 아니라 "판단 순서"를 쉬운 말로 비교하게 바꾼다. 예: `"사람들이 먼저 보는 것(A)보다 먼저 봐야 할 것(B)을 쉬운 말로 비교해 통념을 깬다. 사주 개념은 근거로 1개까지만 쓰고 풀어서 쓴다."` 첫 댓글 규칙은 `"첫 댓글: 독자가 자기 경험으로 답할 수 있는 질문 한 줄. 링크·홍보 문구는 넣지 않는다."`로.
  - `domain-registry.ts:114` instruction도 같은 방향으로 맞춘다.
- [ ] **Step 4: Run** `npx vitest run src/lib src/app/api/generate` → PASS
- [ ] **Step 5: Commit** `fix: 생성 프롬프트가 사주 용어를 강요하지 않고 읽히는 글 기준을 따르게 수정`

### Task 14: 대기열 재검사 라우트 (기본은 미리보기)

스펙 8번 "지금 대기열 처리". 배포 뒤 cosmicpath `PENDING` 글을 새 기준으로 다시 검사한다. 이 태스크는 **코드만** 만든다. 운영 DB에 `apply=true`로 실행하는 건 계획 밖이며, 사용자 승인 뒤에 한다 (Global Constraints).

**Files:**
- Create: `src/app/api/cron/regate-pending/route.ts`
- Test: `src/app/api/cron/regate-pending/route.test.ts` (기존 cron 라우트 테스트의 prisma mock 구조를 따른다)

**Interfaces:**
- `GET /api/cron/regate-pending?brand=<slug>[&apply=true]`, `verifyCronSecret` 필수.
- 브랜드의 `PENDING` 글 중 `formulaId`가 `video:`로 시작하지 않는 글만 대상. 각 글에 `checkReadabilityRules`(Task 9)와 `judgeReadability`(Task 11)를 돌린다. 틀 반복 상한(Task 10)은 쓰지 않는다 (대기열 글끼리 서로 세면 의미가 없다).
- 응답: `{ brand, apply, checked, failed: [{ id, reasons }] }`.
- `apply=true`일 때만 실패 글을 `status: "ARCHIVED"`로 바꾸고 `qualityReasons`에 `regate_readability_failed: <이유>`를 더한다. 삭제하지 않는다 (되돌릴 수 있게).

- [ ] **Step 1: Write the failing tests**
  - `"rejects a request without the cron secret"` → 401
  - `"reports failures without writing when apply is not set"` — 실패 글이 있어도 `prisma.post.update` 호출 0회
  - `"archives only failing posts when apply=true"` — 실패 글만 `status: "ARCHIVED"`, 통과 글은 update 없음
  - `"skips promo video posts"` — `formulaId: "video:promo:2026-10-27"` 글은 `checked`에 안 들어감
- [ ] **Step 2: Run** `npx vitest run src/app/api/cron/regate-pending` → FAIL
- [ ] **Step 3: Implement** 위 Interfaces대로. 판정 API 호출은 글마다 순서대로 (대기열이 수십 개라 병렬 불필요).
- [ ] **Step 4: Run** 같은 명령 → PASS
- [ ] **Step 5: Commit** `feat: 대기 중인 글을 읽히는 글 기준으로 재검사하는 cron 라우트 추가`

**배포 뒤 운영 절차 (계획 밖, 사용자 승인 필요):**
1. `apply` 없이 cosmicpath 미리보기 → 떨어질 글 목록을 사용자에게 보고
2. 승인 받으면 `apply=true` 실행
3. cosmicpath `brandConfig.circuitBreaker.pausedUntil`을 `null`로 되돌려 발행 재개

### Task 15: 전체 검증

- [ ] **Step 1: Run** `npx vitest run` → 전부 PASS
- [ ] **Step 2: Run** `npx tsc --noEmit -p .` → 에러 0
- [ ] **Step 3: Run** `npx eslint src` → 새 경고 0
- [ ] **Step 4:** 스펙의 "변경 내용" 1~6번, 2-1번, 8번 각각에 해당 커밋이 있는지 `git log --oneline main..HEAD`로 확인. 7번(길이)은 없어야 정상.
