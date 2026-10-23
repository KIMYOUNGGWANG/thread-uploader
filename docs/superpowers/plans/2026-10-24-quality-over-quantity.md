# 양보다 질 자동 품질 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사람 검토 없이 글 품질을 지키고, 공식 선택이 실패까지 학습하며, 잘 된 글의 구조를 다시 쓰게 만든다.

**Architecture:** 기존 생성 파이프라인(`generatePostsForBrand` → `generateWithQuality` → 게이트 → remediation → 저장)은 그대로 두고, 고장 난 지점만 고친다. 새 파일은 `generated-meta-patterns.ts`, `winner-replay.ts`, `english-naturalness.ts` 세 개뿐이고 나머지는 기존 함수 수정이다.

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

### Task 9: 전체 검증

- [ ] **Step 1: Run** `npx vitest run` → 전부 PASS
- [ ] **Step 2: Run** `npx tsc --noEmit -p .` → 에러 0
- [ ] **Step 3: Run** `npx eslint src` → 새 경고 0
- [ ] **Step 4:** 스펙의 "변경 내용" 1~6번, 2-1번 각각에 해당 커밋이 있는지 `git log --oneline main..HEAD`로 확인. 7번(길이)은 없어야 정상.
