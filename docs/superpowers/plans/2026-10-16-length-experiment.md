# 길이 실험 실행 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** cosmicpath 발행 슬롯마다 사전 등록된 S/L 시퀀스대로 길이를 강제하고, 생성·refill이 두 등급을 채우게 한다.

**Architecture:**
- 실험 상태는 `brandConfig.lengthExperiment`(JSON)에 둔다.
- 판정 로직(실험 대상 판별, 시퀀스 위치, 후보 선택, 등급 배정)은 순수 함수 모듈 `src/lib/length-experiment.ts` 하나에 모은다. 발행 cron, 생성, refill은 이 모듈만 호출한다.
- 생성 쪽 길이 검사는 기존 품질 게이트 재시도 루프 안에 넣는다. 그래서 "같은 공식 재시도"와 "리메디에이션이 길이를 망가뜨리면 원본 유지"가 기존 구조로 처리된다.

**Tech Stack:** Next.js 16 App Router route handlers, Prisma 5 (Postgres), TypeScript strict, Vitest 4, Node 22 `.mjs` scripts

**Spec:** `docs/superpowers/specs/2026-10-16-length-experiment-design.md` (사전 등록: `docs/experiments/2026-10-16-post-length.md`)

## Global Constraints

- **등급 경계:** S는 `content.length ≤ 260`, L은 `content.length ≥ 390`, 261~389는 MID(실험 중 발행 금지)
- **L 생성 목표:** 400~450자. S 생성 목표는 기존 문구(140~240자) 그대로
- **실험 대상:** `postCategory === "GROWTH"`이고 `formulaId`가 `video:`로 시작하지 않는 글. 실험 초안은 여기에 더해 `createdAt ≥ startAt`
- **시퀀스:** 사전 등록 문서 표의 90자(S 45, L 45). 런타임 기준은 `brandConfig.lengthExperiment.sequence`
- **실험 켜짐 조건:** `lengthExperiment` 있음, `now ≥ startAt`, 시퀀스 위치 < `sequence.length`
- **건너뛴 슬롯 사유:** `length_experiment_waiting_S` / `length_experiment_waiting_L`
- **실험 중 refill:** 등급별 PENDING 실험 초안을 `ceil(target / 2)`개까지 채운다. 한 번에 최대 `MAX_REFILL_PER_RUN`(6)
- **변경 금지:** DB 스키마, 다른 브랜드 동작, 수동 발행 API, 공식 지시문(`domain-registry.ts`), 알고리즘 점수기
- **도구:** 패키지 매니저는 pnpm(`pnpm run test`, `pnpm run typecheck`), `any` 금지(`unknown` + 타입 좁히기)

## Review Focus

1. **L 초안이 며칠째 없을 때:** 발행은 매번 `length_experiment_waiting_L`로 건너뛰고, refill은 L만 만든다. S로 대신 채우지 않는다. → Task 1(`planExperimentRefillCount`, `planLengthArms`), Task 2(건너뜀)
2. **`startAt`이 미래이거나 시퀀스를 다 쓴 경우:** 평소 동작과 똑같아야 한다. → Task 1(`currentArm`), Task 2(소진 후 평소 경로)
3. **`brandConfig.lengthExperiment`가 깨진 경우:** 시퀀스에 다른 문자가 있거나, `startAt`이 날짜가 아닌 경우다. 크래시 없이 실험이 꺼진 것으로 본다. → Task 1(`parseLengthExperiment`)
4. **실험 중 사람이 홍보·영상 글을 승인한 경우:** 평소처럼 발행되고 시퀀스를 소비하지 않는다. → Task 1(`sequencePosition`), Task 2(실험 밖 글 우선 발행)
5. **실험 시작 전에 만든 S/L 초안:** 실험 중에는 발행하지 않는다. → Task 1(`pickPublishCandidate`)

---

### Task 1: 실험 상태 타입과 판정 순수 함수

**Files:**
- Create: `src/types/length-experiment.ts`
- Create: `src/lib/length-experiment.ts`
- Create: `scripts/length-experiment-sequence.json`
- Modify: `src/types/brand.ts`
  - `BrandConfig`(115~)에 `lengthExperiment?: LengthExperimentConfig` 필드 추가
  - `parseBrandConfig`(218~)에 `lengthExperiment: parseLengthExperiment(parsed.lengthExperiment)` 추가
- Test: `src/lib/length-experiment.test.ts`

**Interfaces:**
- Produces (`src/types/length-experiment.ts`):
  - `type LengthArm = "S" | "L"`
  - `interface LengthExperimentConfig { startAt: string; sequence: string; shortMax: number; longMin: number }`
  - `parseLengthExperiment(input: unknown): LengthExperimentConfig | undefined`
    - 유효 조건: `startAt`이 `Date.parse` 가능, `sequence`가 `/^[SL]+$/`
    - `shortMax`/`longMin`이 없으면 260/390. 둘 다 숫자여야 하고 `shortMax < longMin`
    - 하나라도 어기면 `undefined`
- Produces (`src/lib/length-experiment.ts`, prisma import 없음):
  - `interface ExperimentPostShape { content: string; postCategory: string; formulaId: string | null; createdAt: Date }`
  - `classifyLength(content: string, config: LengthExperimentConfig): LengthArm | "MID"`
  - `isExperimentPost(post: Pick<ExperimentPostShape, "postCategory" | "formulaId">): boolean`
  - `isExperimentDraft(post: ExperimentPostShape, config: LengthExperimentConfig): boolean`
  - `sequencePosition(published: ExperimentPostShape[], config: LengthExperimentConfig): number`: 실험 초안이면서 S/L인 글의 수
  - `currentArm(config: LengthExperimentConfig, position: number, now: Date): LengthArm | null`
  - `pickPublishCandidate<T extends ExperimentPostShape>(candidates: T[], config: LengthExperimentConfig, arm: LengthArm): T | null`
    - 입력 순서(`scheduledAt` 오름차순)대로 본다.
    - 실험 대상이 아닌 글이거나, 실험 초안이면서 등급이 `arm`인 글 중 첫 번째를 고른다.
  - `countPendingByArm(pending: ExperimentPostShape[], config: LengthExperimentConfig): Record<LengthArm, number>`: 실험 초안만 센다.
  - `planLengthArms(pending: Record<LengthArm, number>, nextArm: LengthArm, count: number): LengthArm[]`
    - 초안마다 "pending + 이미 배정한 수"가 적은 등급을 고른다.
    - 같으면 `nextArm`
  - `planExperimentRefillCount(pending: Record<LengthArm, number>, target: number, maxPerRun?: number): number`
    - `min(maxPerRun, max(0, ceil(target/2) - S) + max(0, ceil(target/2) - L))`
    - `maxPerRun` 기본값은 `MAX_REFILL_PER_RUN`(`src/lib/queue-refill.ts`)
  - `lengthGateReason(content: string, target: LengthArm, config: LengthExperimentConfig): string | null`
    - 등급이 맞으면 `null`
    - 아니면 `` `길이 실험 ${target} 범위 밖: ${content.length}자 (목표 ${target === "S" ? "140~240자" : "400~450자"})` ``
  - `lengthPromptLines(target: LengthArm): { rule: string; request: string }` (Task 3이 사용)
    - S rule: `- 본문 목표 길이는 140~240자로 극도로 압축한다. [길이 실험] 이 길이 지시가 공식 지시문 속 글자 수보다 우선한다.`
    - L rule: `- [길이 실험] 본문은 반드시 400~450자로 쓴다. 이 길이 지시가 공식 지시문 속 글자 수보다 우선한다. 1~2문장마다 줄을 바꾼다.`
    - request: `` `위 실험 조건을 조합해서 ${S면 "140~240자" / L이면 "400~450자"} Threads 포스트 1개를 작성해줘.` ``
- Produces (`scripts/length-experiment-sequence.json`): `{ "sequence": "<90자>", "shortMax": 260, "longMin": 390 }`

- [ ] **Step 1: Write the failing tests** (`src/lib/length-experiment.test.ts`)
  - `sequence json matches the pre-registered table`
    - `docs/experiments/2026-10-16-post-length.md`의 `1-10:`~`81-90:` 줄에서 S/L을 이어 붙인 값 === JSON `sequence`
    - 길이 90, S 45개
  - `classifies by the pre-registered boundaries`: 260→S, 261→MID, 389→MID, 390→L
  - `parseLengthExperiment rejects malformed config`
    - `{ startAt: "nope", sequence: "SL" }`, `{ startAt: iso, sequence: "SXL" }`, `{ startAt: iso, sequence: "SL", shortMax: 400, longMin: 390 }` → `undefined`
    - 유효 입력 → 기본값 260/390이 채워진다.
  - `currentArm is null before startAt and after the sequence is used up`
    - `now < startAt` → `null`
    - `position === sequence.length` → `null`
    - `position 0` → `sequence[0]`
  - `sequencePosition counts only experiment drafts with S/L length`
    - 제외해야 하는 글: WARMUP, `video:promo-x`, `createdAt < startAt`, MID
  - `pickPublishCandidate skips mismatched, pre-start and MID drafts`
    - 후보 순서: [L(시작 전), S(새), MID(새), L(새)], arm L → L(새)
    - arm S → S(새)
    - 같은 후보에서 S(새)를 빼면 arm S → `null`
  - `pickPublishCandidate lets non-experiment posts through without matching`: 후보 [WARMUP, L(새)], arm S → WARMUP
  - `planLengthArms fills the scarcer arm first`
    - `({S:5,L:0}, "S", 3)` → `["L","L","L"]`
    - `({S:1,L:1}, "L", 2)` → `["L","S"]`
  - `planExperimentRefillCount tops each arm to half the target`
    - `({S:5,L:0}, 10)` → 5
    - `({S:5,L:5}, 10)` → 0
    - `({S:0,L:0}, 10)` → 6 (한도)
  - `lengthGateReason`
    - 420자 L 목표 → `null`
    - 300자 L 목표 → 메시지에 `"L 범위 밖"`과 `"300자"` 포함
  - `parseBrandConfig keeps a valid lengthExperiment and drops a malformed one`

- [ ] **Step 2: Run to verify failure**
  - Run: `pnpm exec vitest run src/lib/length-experiment.test.ts`
  - Expected: FAIL (모듈 없음)

- [ ] **Step 3: Implement**
  - 위 Interfaces대로 타입, 파서, 순수 함수, 시퀀스 JSON을 만든다.
  - 시퀀스 JSON 값은 사전 등록 문서 표를 그대로 옮긴다.

- [ ] **Step 4: Run to verify pass**
  - Run: `pnpm exec vitest run src/lib/length-experiment.test.ts && pnpm run typecheck`
  - Expected: PASS, tsc 에러 0

- [ ] **Step 5: Commit**
  - `git add src/types/length-experiment.ts src/lib/length-experiment.ts src/lib/length-experiment.test.ts scripts/length-experiment-sequence.json src/types/brand.ts`
  - 메시지: `feat(experiment): 길이 실험 상태와 판정 함수 추가`

### Task 2: 상태 로더와 발행 cron 슬롯 매칭

**Files:**
- Modify: `src/lib/length-experiment.ts`(로더 추가, 이 함수만 prisma 사용)
- Modify: `src/app/api/cron/publish/route.ts`: shadowban이 아닌 경로의 `findFirst`(225~233)
- Test: `src/app/api/cron/publish/route.test.ts`

**Interfaces:**
- Consumes: Task 1 전부
- Produces:
  - `interface LengthExperimentState { config: LengthExperimentConfig; position: number; arm: LengthArm; pending: Record<LengthArm, number> }`
  - `loadLengthExperimentState(brandId: string, brandConfig: Pick<BrandConfig, "lengthExperiment">, now: Date): Promise<LengthExperimentState | null>`
    - `brandConfig.lengthExperiment`가 없거나 `now < startAt`이면 DB 조회 없이 `null`
    - 있으면 두 가지를 조회한다.
      - `status: "PUBLISHED", brandId, publishedAt ≥ startAt`인 글(`select content, postCategory, formulaId, createdAt`) → `sequencePosition`
      - `status: "PENDING", brandId, qualityPass: true`인 글(같은 select) → `countPendingByArm`
    - `currentArm`이 `null`이면 `null`

- [ ] **Step 1: Write the failing tests** (기존 route.test.ts의 prisma mock에 `post.findMany`를 조종할 수 있게 확장)
  - `under an active length experiment, publishes the oldest draft matching the slot arm`
    - 상태: 시퀀스 `"LS..."`, 발행된 실험 글 0개 → arm L
    - 후보 findMany: [S(새), L(새)]
    - 기대: 발행 대상 id = L(새)
  - `skips the slot with length_experiment_waiting_L when no matching draft exists`
    - 후보: [S(새)]
    - 기대: `skipped`에 `reason: "length_experiment_waiting_L"`, 발행 호출 0회
  - `publishes an approved promo draft without consuming the sequence`
    - 후보: [`formulaId: "video:promo-1"`, L(새)], arm S
    - 기대: promo가 발행된다.
  - `falls back to the normal oldest-first pick after the sequence is used up`
    - 상태: 발행된 실험 S/L 글이 `sequence.length`개
    - 기대: 기존 `findFirst` 경로 사용
  - 기존 테스트(brandConfig에 `lengthExperiment` 없음)는 수정 없이 통과해야 한다. 다른 브랜드 영향 없음을 이걸로 확인한다.

- [ ] **Step 2: Run to verify failure**
  - Run: `pnpm exec vitest run src/app/api/cron/publish/route.test.ts`
  - Expected: 새 테스트 FAIL

- [ ] **Step 3: Implement**
  - `loadLengthExperimentState`를 추가한다.
  - 발행 route의 shadowban이 아닌 경로를 바꾼다.
    - 상태가 있으면 같은 where/orderBy로 `findMany({ take: 50 })`를 하고 `pickPublishCandidate`로 고른다.
    - 후보가 없으면 `skipped.push({ brandId, brandName, reason: \`length_experiment_waiting_${arm}\` })` 후 `continue`
    - 상태가 `null`이면 기존 `findFirst` 그대로

- [ ] **Step 4: Run to verify pass**
  - Run: `pnpm exec vitest run src/app/api/cron/publish/ src/lib/length-experiment.test.ts`
  - Expected: PASS

- [ ] **Step 5: Commit**
  - 메시지: `feat(publish): 길이 실험 중 슬롯 등급에 맞는 초안만 발행`

### Task 3: 생성의 목표 등급, 길이 게이트, fold 감점 끄기

**Files:**
- Modify: `src/lib/expert-panel-evaluator.ts`
  - `EvaluationContext`(26~32)에 `ignoreFoldLength?: boolean` 추가
  - `evaluateTargetUser`의 fold 블록(149~154)은 플래그가 있으면 건너뛴다.
- Modify: `src/lib/product-quality-gate.ts`: `ProductQualityContext`(7~13)에 `ignoreFoldLength?: boolean` 추가
- Modify: `src/lib/quality-gate.ts`
  - `checkQuality`(383~)가 `context`를 `enforceSafetyRules`로 넘긴다.
  - `enforceSafetyRules`(411~)가 `evaluateContentWithExpertPanel(post, { ignoreFoldLength: context.ignoreFoldLength })`를 호출한다.
- Modify: `src/lib/generate-posts.ts`
  - `GrowthExperiment`(74~)에 `lengthTarget?: LengthArm` 추가
  - `generatePostsForBrand`(894~)
    - 배치 루프 전에 `loadLengthExperimentState(brand.id, config, new Date())`를 부른다.
    - 상태가 있으면 `planLengthArms(state.pending, state.arm, count)`로 `batchIndex`별 `experiment.lengthTarget`을 넣는다.
  - `generateWithQuality`(268~)
    - `qualityContext`에 `ignoreFoldLength: Boolean(experiment.lengthTarget)`를 넣는다.
    - `runQualityGate` 결과에 `lengthGateReason`이 있으면 `pass: false`로 바꾸고 사유를 맨 앞에 붙인다. 기존 재시도가 이 사유를 피드백으로 받는다.
    - 반환값에 `lengthTarget`을 포함한다.
  - `buildGenerationPrompt`(431~)
    - 한국어 경로의 길이 줄 두 곳(490, 586)을 `experiment.lengthTarget`이 있을 때만 `lengthPromptLines(target).rule` / `.request`로 바꾼다.
    - 586 줄의 `SEPARATOR` 안내 뒷부분은 그대로 둔다.
  - 저장 루프(1060~): `reconciled.content`의 `classifyLength`가 `result.lengthTarget`과 다르면 `failureReasons.push(\`length experiment ${result.lengthTarget} mismatch (${result.formulaId})\`)` 후 `continue`
- Test: `src/lib/expert-panel-evaluator.test.ts`, `src/lib/quality-gate.test.ts`

**Interfaces:**
- Consumes: Task 1(`lengthGateReason`, `lengthPromptLines`, `classifyLength`, `planLengthArms`), Task 2(`loadLengthExperimentState`)

- [ ] **Step 1: Write the failing tests**
  - `evaluateTargetUser skips the fold penalty when ignoreFoldLength is set`
    - 같은 420자 한국어 본문에서, 플래그가 있을 때 점수가 10점 높다.
    - 플래그가 있으면 `flags`에 `"Fold"` 문구가 없다.
  - `checkQuality forwards ignoreFoldLength to the expert panel`
    - 280자 초과 한국어 본문에서 `checkQuality(post, "saju_viral", { ignoreFoldLength: true }).reasons`에 Fold 사유가 없다.
    - 플래그가 없으면 이 사유가 있다(현재 blockingReasons에 해당 문구가 들어가는지 확인 후 단언한다).
  - generate-posts.ts는 기존 단위 테스트 하네스가 없다. 길이 판정과 문구는 Task 1의 순수 함수 테스트가 고정한다. 여기서는 typecheck와 전체 회귀로 확인한다.

- [ ] **Step 2: Run to verify failure**
  - Run: `pnpm exec vitest run src/lib/expert-panel-evaluator.test.ts src/lib/quality-gate.test.ts`
  - Expected: 새 테스트 FAIL

- [ ] **Step 3: Implement** (위 Files 순서대로)

- [ ] **Step 4: Run to verify pass**
  - Run: `pnpm run test && pnpm run typecheck`
  - Expected: 전체 PASS, tsc 에러 0

- [ ] **Step 5: Commit**
  - 메시지: `feat(generate): 길이 실험 목표 등급으로 생성하고 fold 감점 제외`

### Task 4: 실험 중 refill 계산과 실행 횟수

**Files:**
- Modify: `src/app/api/cron/refill/route.ts`
  - 브랜드를 찾은 뒤 `loadLengthExperimentState(brand.id, parseBrandConfig(brand.brandConfig), new Date())`를 부른다.
  - 상태가 있으면 `count = planExperimentRefillCount(state.pending, target)`, 없으면 기존 `planRefillCount(backlog, target)`
  - 응답에 `lengthExperiment: { arm, pending }`을 넣는다(상태가 있을 때만).
- Modify: `.github/workflows/refill.yml`
  - schedule에 `'13 6 * * *'`(KST 15:13)와 `'13 14 * * *'`(KST 23:13)를 추가한다.
  - 주석: `# 길이 실험(2026-10-16 사전 등록)용 추가 실행 — 실험 종료 후 제거`
- Test: `src/app/api/cron/refill/route.test.ts`

**Interfaces:**
- Consumes: Task 1(`planExperimentRefillCount`), Task 2(`loadLengthExperimentState`)

- [ ] **Step 1: Write the failing test**
  - `under a length experiment, refills by per-arm pending drafts instead of the backlog`
    - 조건: backlog count 12(NEEDS_REVIEW 포함), 상태 pending `{S:5, L:0}`, target 10
    - 기대: `generatePostsForBrand`가 `count: 5`로 호출된다.
    - prisma mock에 `post.findMany`를 추가하고, `findBrand`가 `lengthExperiment`가 있는 brandConfig를 반환하게 한다.
  - 기존 refill 테스트는 수정 없이 통과해야 한다.

- [ ] **Step 2: Run to verify failure**
  - Run: `pnpm exec vitest run src/app/api/cron/refill/route.test.ts`
  - Expected: 새 테스트 FAIL

- [ ] **Step 3: Implement** (route + workflow)

- [ ] **Step 4: Run to verify pass**
  - Run: `pnpm exec vitest run src/app/api/cron/refill/`
  - Expected: PASS

- [ ] **Step 5: Commit**
  - 메시지: `feat(refill): 길이 실험 중 등급별 부족분만큼 생성하고 하루 3회 실행`

### Task 5: 판정 컷오프, 스냅샷 createdAt, 시작 스크립트

**Files:**
- Modify: `scripts/export-post-metrics.mjs`: post select에 `createdAt: true` 추가
- Modify: `scripts/analyze-post-response.mjs` `judgeLengthExperiment`
  - 대상 조건: `postCategory === "GROWTH"`, `formulaId`가 `video:`로 시작하지 않음, `createdAt ≥ from`
  - S/L만 남기고, `publishedAt` 오름차순으로 처음 `--total`(기본 90)개만 판정한다. 컷오프 이후 개수도 출력한다.
  - S·L별 `formulaId` 상위 5개 구성 비율을 출력한다.
  - 정의는 `src/lib/length-experiment.ts`와 같다는 주석을 단다.
  - `--self-test`에 컷오프 단언을 추가한다. 91번째 글은 판정에 들어가지 않아야 한다.
- Create: `scripts/start-length-experiment.mjs`
  - `node --env-file=.env scripts/start-length-experiment.mjs [--dry-run]`
  - cosmicpath `brandConfig`(raw JSON)에 `lengthExperiment: { startAt: <지금 ISO>, ...scripts/length-experiment-sequence.json }`를 병합해서 저장한다.
  - 이미 `lengthExperiment`가 있으면 내용을 출력하고 아무것도 바꾸지 않는다(멱등).
  - `--dry-run`이면 쓰지 않고 결과만 출력한다.
- Modify: `docs/experiments/2026-10-16-post-length.md`, "측정과 판정"
  - 판정 표본은 `startAt` 이후 처음 90개 실험 대상 S/L 글이라고 명시한다.
  - 시작 방법(`start-length-experiment.mjs`)을 적는다. 가설과 기준은 그대로 둔다.

**Interfaces:**
- Consumes: Task 1의 `scripts/length-experiment-sequence.json` 형식

- [ ] **Step 1: Write the failing self-test assertion**
  - 92개 가짜 글(S/L 교대)에서 판정 표본이 90개이고, 컷오프 이후 개수가 2인지 단언한다.

- [ ] **Step 2: Run to verify failure**
  - Run: `node scripts/analyze-post-response.mjs --self-test`
  - Expected: FAIL

- [ ] **Step 3: Implement** (위 Files)

- [ ] **Step 4: Verify**
  - Run: `node scripts/analyze-post-response.mjs --self-test && node --check scripts/start-length-experiment.mjs && node --check scripts/export-post-metrics.mjs`
  - Expected: `self-test ok`, 문법 에러 없음
  - 시작 스크립트는 운영 DB에 쓰므로 여기서 실행하지 않는다. `--dry-run`도 사용자 승인 후에 실행한다.

- [ ] **Step 5: Commit**
  - 메시지: `feat(experiment): 판정 표본을 처음 90개로 자르고 시작 스크립트 추가`

### Task 6: 전체 검증과 PR

- [ ] **Step 1:** `pnpm run test && pnpm run typecheck`. Expected: 전체 PASS
- [ ] **Step 2:** `npx eslint` 변경 파일. Expected: 에러 0
- [ ] **Step 3:** 설계 문서와 계획 문서를 커밋한다.
  - 메시지: `docs(experiment): 길이 실험 실행 설계와 구현 계획`
- [ ] **Step 4:** push 후 PR을 연다. base는 `feat/post-response-analysis`(PR #5)다. PR #5가 먼저 머지되면 base를 main으로 바꾼다.
