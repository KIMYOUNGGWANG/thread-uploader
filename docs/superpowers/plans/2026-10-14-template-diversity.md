# 생성 글 문장 틀 반복 제거 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CosmicPath(saju_viral) 생성 글이 "X보다 센 건 Y" 훅·1/2/3 선택지·"난 솔직히" 첫 댓글로 수렴하지 않게, 강제 조건을 풀고 모드별 모양과 틀 단위 반복 차단을 넣는다.

**Architecture:** 품질 게이트·프롬프트·바이럴 모드 규칙·점수기에 박힌 공통 틀 강제를 걷어내고, 각 바이럴 모드가 고유 모양과 첫 댓글 방향을 갖게 한다. 생성 루프에는 기존 단어 유사도 검사 옆에 "틀 서명" 반복 검사를 saju_viral 한정으로 붙인다. 운영 DB의 캠페인 공식 문구도 같은 원칙으로 바꾼다.

**Tech Stack:** Next.js 16 · TypeScript strict · Prisma 5 · Vitest 4 · pnpm

**Spec:** `docs/superpowers/specs/2026-10-14-template-diversity-design.md`

**Working directory (모든 명령):** `/private/tmp/claude-501/-Users-kim-young-gwang-Desktop-projects-threads-uploader/b2b4b8bb-af6e-467d-93fd-50327bccb14d/scratchpad/wt-template` (worktree, 브랜치 `fix/template-diversity`, `origin/main` 기준). `node_modules`는 원 저장소를 가리키는 심볼릭 링크이며 `.gitignore`의 `/node_modules`로 무시된다.

## Global Constraints

- 패키지 매니저는 pnpm만, 새 의존성 추가 없음.
- `any` 금지. `unknown` + 타입 좁히기. 테스트 파일은 기존 파일이 이미 쓰는 `as` 캐스트 패턴만 허용.
- 새로 쓰거나 고치는 함수는 20줄 미만, 축약 변수명 금지(`r` → `result`).
- 코드와 주석은 영어, 프롬프트·규칙 문자열은 한국어.
- 커밋은 conventional commits + 한국어 설명, 파일을 지정해 stage (`git add -A`, `git add .` 금지).
- 유지: 사주 용어 최소 1개, 반말/독백체, 첫 댓글 링크·홍보 금지, 승인 게이트(cron `qualityPass: true` 필터, PATCH 승인 시 `qualityPass/algorithmicPass = true`)는 손대지 않는다.
- 변경 금지: `ENGLISH_VIRAL_MODE_LABELS`·영문 패턴, `src/lib/generation-engine.ts`, career_decision 게이트.
- 빌드(`next build`) 금지. 검증은 `pnpm exec vitest run`, `pnpm exec tsc --noEmit`, `pnpm exec eslint`.
- 운영 DB 쓰기와 `git push`는 사용자 확인 후에만 실행한다.

## Review Focus

- 같은 틀이 최근 5개 중 정확히 1개만 있을 때는 통과해야 한다(경계값). → Task 4 "allows a skeleton that appears only once"
- career·영문 프로필 생성에는 틀 검사가 돌지 않아야 한다(한국어 saju 기준이라 오탐). → Task 5 career 테스트의 spy 미호출 단언
- 첫 댓글이 없는(null) 글끼리를 "같은 첫마디"로 보면 안 된다. → Task 4 "does not treat two missing first comments as the same opener"
- 첫 줄의 `[태그]`·`#` 접두사, 문장 속 우연한 "보다" 1회는 틀 분류를 바꾸면 안 된다. → Task 4 분류 테스트 2개
- 숫자 가점이 과장·스팸 글을 통과시키면 안 된다. → Task 6 Step 4에서 기존 "penalizes meta policy violation keywords" 테스트가 계속 실패 판정(pass false)인지 확인

---

### Task 1: saju_viral 게이트에서 첫 줄·선택지 필수 조건 제거

**Files:**
- Modify: `src/lib/quality-gate.ts:471-472`
- Test: `src/lib/quality-gate.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `checkQuality(post, "saju_viral", context)`의 `pass`가 `사주 용어 && 모드 fidelity && 안전 규칙`으로 결정된다. `score`·`reasons`의 훅/참여 항목은 정보로만 남는다.

- [ ] **Step 1: Write the failing test**

`src/lib/quality-gate.test.ts`의 `it("accepts viral content even with markdown heading and topic prefixes", …)` 바로 아래에 추가:

```ts
  const IDENTITY_POST_WITHOUT_CHOICES = [
    "신금 일주는 끊을 때 칼이 아니라 정으로 베임.",
    "판단은 빠른데 인정은 제일 늦게 하는 타입이라, 이미 끝난 관계를 1년씩 끌고 감.",
    "",
    "강점은 한 번 정한 기준을 끝까지 지키는 거고, 맹점은 그 기준이 상대 사정을 못 봄.",
    "",
    "너는 지금 누구를 정 때문에 붙잡고 있음?",
  ].join("\n");
  const FACT_POST_WITHOUT_QUESTION_HOOK = [
    "한국인 10명 중 7명은 자기 시주를 잘못 알고 있음.",
    "",
    "출생 시각을 표준시로만 넣으면 진태양시랑 30분 넘게 어긋나는 경우가 많아서, 일주는 맞아도 시주 글자가 통째로 바뀜.",
    "",
    "시주가 바뀌면 말년운 해석이랑 자식 궁 읽는 기준이 전부 달라짐.",
    "",
    "너는 태어난 시간 정확히 알고 있음?",
  ].join("\n");

  it("accepts an identity post that ends with a direct question instead of numbered choices", () => {
    const result = checkQuality(IDENTITY_POST_WITHOUT_CHOICES, "saju_viral", { viralIntentModeId: "identity_profile" });

    expect(result.pass).toBe(true);
    expect(result.reasons.join(" ")).toContain("참여 유도 요소 없음");
  });

  it("accepts a fact hook without a question mark, hierarchy phrase, or choices", () => {
    expect(checkQuality(FACT_POST_WITHOUT_QUESTION_HOOK, "saju_viral").pass).toBe(true);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/quality-gate.test.ts`
Expected: 새 테스트 2개 FAIL (`expected false to be true`). 현재 두 글 모두 score 1(사주 용어만)이라 탈락한다.

- [ ] **Step 3: Write minimal implementation**

`src/lib/quality-gate.ts`의 `checkSajuViralQuality` 마지막 두 줄(주석 + return)을 교체:

```ts
  // A saju_viral post without any saju term is off-campaign. Hook and engagement only inform the score:
  // requiring them pushed every post into the same question-plus-numbered-choices template.
  return { pass: hasSajuTerm && fidelity.pass, score, profile: "saju_viral", reasons };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/lib/quality-gate.test.ts`
Expected: 파일 전체 PASS (기존 "rejects a saju_viral post with a hook and engagement but no saju term"도 계속 PASS)

- [ ] **Step 5: Commit**

```bash
git add src/lib/quality-gate.ts src/lib/quality-gate.test.ts
git commit -m "fix(quality): saju 게이트에서 첫 줄·선택지 필수 조건 제거"
```

---

### Task 2: 바이럴 모드별 모양과 첫 댓글 방향, 서열 공식 문구

**Files:**
- Modify: `src/lib/viral-intent-modes.ts:36` (export), `:84` (fidelity 기준), `:196-243` (4개 모드 rules)
- Modify: `src/lib/domain-registry.ts:94` (saju_viral `concept_hierarchy` instruction)
- Test: `src/lib/viral-intent-modes.test.ts`, `src/lib/domain-registry.test.ts`, `src/lib/quality-gate.test.ts:26` (테스트 이름만)

**Interfaces:**
- Consumes: 없음
- Produces: `export const IDENTITY_MARKER_PATTERN: RegExp` (`viral-intent-modes.ts`) — Task 4, Task 6이 import한다. 각 lean 모드(`imagination_dilemma`, `concept_hierarchy`, `identity_profile`, `relationship_tension`)의 `rules`에 `"첫 댓글: "`로 시작하는 규칙이 1개씩 있다.

- [ ] **Step 1: Write the failing tests**

`src/lib/viral-intent-modes.test.ts` 상단 import를 교체:

```ts
import { describe, expect, it } from "vitest";
import {
  checkViralModeFidelity,
  IDENTITY_MARKER_PATTERN,
  normalizeViralIntentModeId,
  resolveViralIntentMode,
  selectViralIntentMode,
  VIRAL_INTENT_MODES,
} from "./viral-intent-modes";
```

파일 끝에 추가:

```ts
describe("viral mode shapes", () => {
  const modeById = new Map(VIRAL_INTENT_MODES.map((mode) => [mode.id, mode]));

  it("accepts a concept hierarchy with a single comparison", () => {
    const result = checkViralModeFidelity("화개살은 도화살보다 늦게 터지는데 오래 감.\n둘 다 있으면 30대 중반부터 판이 바뀜.", "concept_hierarchy");
    expect(result.failureCodes).not.toContain("missing_hierarchy");
  });

  it("still rejects a concept hierarchy with no comparison", () => {
    const result = checkViralModeFidelity("화개살은 늦게 터지는데 오래 감.\n30대 중반부터 판이 바뀜.", "concept_hierarchy");
    expect(result.failureCodes).toContain("missing_hierarchy");
  });

  it("drops the copied hierarchy sentence from the hierarchy rules", () => {
    expect(modeById.get("concept_hierarchy")?.rules.join(" ")).not.toContain("A보다 센 B보다 센");
  });

  it("gives every lean mode a link-free first-comment direction instead of a bridge", () => {
    for (const id of ["imagination_dilemma", "concept_hierarchy", "identity_profile", "relationship_tension"] as const) {
      const rules = modeById.get(id)?.rules ?? [];
      expect(rules.find((rule) => rule.startsWith("첫 댓글:"))).toContain("링크·홍보 문구는 넣지 않는다");
      expect(rules.join(" ")).not.toContain("브릿지");
    }
  });

  it("keeps numbered choices out of the identity and relationship modes", () => {
    for (const id of ["identity_profile", "relationship_tension"] as const) {
      expect(modeById.get(id)?.rules).toContain("번호 선택지를 쓰지 않고, 독자에게 직접 묻는 한 문장으로 끝낸다.");
    }
  });

  it("exports the identity marker pattern for scorer and anti-repeat reuse", () => {
    expect(IDENTITY_MARKER_PATTERN.test("신금 일주는 정으로 베임")).toBe(true);
  });
});
```

`src/lib/domain-registry.test.ts`의 `describe("Domain Intelligence Registry", …)` 안 마지막에 추가:

```ts
  it("describes the saju hierarchy formula without the copied viral sentence or a comment bridge", () => {
    const formulas = Object.values(getDomainPreset("saju_viral").trackFormulas).flat();
    const hierarchy = formulas.find((formula) => formula.id === "concept_hierarchy");

    expect(hierarchy?.instruction).toContain("2~3개");
    expect(hierarchy?.instruction).not.toContain("보다 센 홍염보다 센");
    expect(hierarchy?.instruction).not.toContain("브릿지");
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/viral-intent-modes.test.ts src/lib/domain-registry.test.ts`
Expected: FAIL. `IDENTITY_MARKER_PATTERN`이 export되지 않아 import 단계에서 실패하고, domain-registry 새 테스트는 `expected … to contain "2~3개"`로 실패.

- [ ] **Step 3: Write minimal implementation**

`src/lib/viral-intent-modes.ts:36` — `const`를 `export const`로:

```ts
export const IDENTITY_MARKER_PATTERN = /화개살?|도화살?|홍염살?|문창귀인|천을귀인|진술축미|(?:신금|경금|갑목|을목|병화|정화|무토|기토|임수|계수)\s*(?:일주|타입)/;
```

`src/lib/viral-intent-modes.ts:84` — 비교 1회면 서열로 인정:

```ts
  // One comparison is enough; demanding two produced the same "X보다 센 건 Y고, Y보다 센 건 Z" opener every time.
  if (modeId === "concept_hierarchy" && (opening.match(hierarchyPattern)?.length ?? 0) < 1) {
```

`src/lib/viral-intent-modes.ts`의 `concept_hierarchy`·`imagination_dilemma`·`identity_profile`·`relationship_tension` 4개 객체의 `rules` 배열을 아래로 교체한다(`id`·`label`·`primaryMetric`·`instruction`은 그대로):

```ts
    // concept_hierarchy
    rules: [
      "실제 사주 개념 2~3개(살·십신·일주)를 서열이나 대비로 비교한다. 최근 글에 쓰인 비교 문장 틀은 반복하지 않는다.",
      "근거 없는 미신이나 공포 조장 금지. 결정론적/구조적 프레임으로 설명.",
      "본문 내 직접 링크 노출 금지.",
      "단순 A/B/C 자가분류 댓글 강요 금지.",
      "첫 댓글: 독자 원국에 이 개념이 있는지 묻는 한 줄로 쓴다. 링크·홍보 문구는 넣지 않는다.",
    ],
```

```ts
    // imagination_dilemma
    rules: [
      "도입부는 '자, 상상해봐' 또는 즉각적 일상 딜레마 상황으로 시작한다.",
      "1초 만에 선택 가능한 직관적이고 극단적인 3개 번호 선택지를 제시한다.",
      "구구절절한 설명 문장을 배제하고 선택지만 명확히 남겨 댓글 참여 마찰력을 최소화한다.",
      "첫 댓글: 각 선택지를 고른 이유를 묻는 한 줄로 쓴다. 링크·홍보 문구는 넣지 않는다.",
    ],
```

```ts
    // identity_profile
    rules: [
      "특정 글자, 살, 일주를 1줄에 직설적으로 호명하여 스크롤을 멈추게 한다.",
      "두루뭉술한 위로 대신 날카로운 양면성(치명적 무기 vs 발목 잡는 덫)을 짚는다.",
      "본문 링크 금지.",
      "번호 선택지를 쓰지 않고, 독자에게 직접 묻는 한 문장으로 끝낸다.",
      "첫 댓글: 독자가 자기 일주나 살을 꺼내게 하는 한 줄로 쓴다. 링크·홍보 문구는 넣지 않는다.",
    ],
```

```ts
    // relationship_tension
    rules: [
      "감정적 연애 상담이 아니라 구조적 기질 궁합의 충돌 원리를 설명한다.",
      "단정적 미래 확정 대신 리스크 헷징 관점을 제시한다.",
      "번호 선택지를 쓰지 않고, 독자에게 직접 묻는 한 문장으로 끝낸다.",
      "첫 댓글: 상대와 지금 어떤 상황인지 묻는 한 줄로 쓴다. 링크·홍보 문구는 넣지 않는다.",
    ],
```

(위 블록의 `// concept_hierarchy` 같은 주석은 위치 안내용이다. 실제 코드에는 넣지 않는다.)

`src/lib/domain-registry.ts:94`의 `instruction` 문자열을 교체:

```ts
          instruction: "대중이 흔히 아는 개념보다 본질적인 사주 개념 2~3개(살·십신·일주)를 서열이나 대비로 비교해 상식을 깨고, 극단적 1줄 앵커와 독자 투사로 140~200자 내로 압축 작성한다. 같은 비교 문장 틀을 반복하지 않는다. 본문 링크 절대 금지.",
```

`src/lib/quality-gate.test.ts:26`의 테스트 이름만 바꾼다(본문 그대로, 비교 0회라 계속 실패 판정):

```ts
  it("rejects a concept hierarchy without any comparison", () => {
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/viral-intent-modes.test.ts src/lib/domain-registry.test.ts src/lib/quality-gate.test.ts src/lib/lean-viral-sprint.test.ts src/lib/brand-profile.test.ts`
Expected: 모두 PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/viral-intent-modes.ts src/lib/viral-intent-modes.test.ts src/lib/domain-registry.ts src/lib/domain-registry.test.ts src/lib/quality-gate.test.ts
git commit -m "fix(viral): 서열 모드 문장 틀 강제 해제와 모드별 첫 댓글 방향"
```

---

### Task 3: 생성 프롬프트의 복제 훅·고백 댓글 예시 제거

**Files:**
- Modify: `src/lib/generate-posts.ts:484` (첫 줄 훅 규칙), `:490` (첫 댓글 규칙), `:715-721` (`SAJU_VIRAL_REQUIREMENTS`)
- Test: `src/app/api/generate/post-route-matrix.test.ts`

**Interfaces:**
- Consumes: Task 2의 모드 `"첫 댓글: …"` 규칙(프롬프트가 이 규칙을 따르라고 지시한다)
- Produces: 테스트 `state.prompts: string[]` — Anthropic mock이 받은 요청을 JSON 문자열로 기록한다. Task 5가 같은 `state`에 필드를 추가한다.

- [ ] **Step 1: Write the failing test**

`src/app/api/generate/post-route-matrix.test.ts`의 `vi.hoisted` state에 `prompts`를 추가:

```ts
const state = vi.hoisted(() => ({
  prompts: [] as string[],
  createdPosts: [] as Array<{
    id: string;
    campaignFormulaId: string | null;
    firstComment?: string | null;
    linkUrl?: string | null;
    utmContent?: string | null;
    targetAudience?: string | null;
  }>,
}));
```

Anthropic mock의 `create`가 요청을 기록하도록 첫 두 줄을 교체:

```ts
      create: vi.fn(async (request: unknown) => {
        state.prompts.push(JSON.stringify(request));
        const body = DIVERSE_POST_BODIES[mockPostCallCounter % DIVERSE_POST_BODIES.length];
```

`describe` 블록 끝에 추가:

```ts
  it("sends CosmicPath prompts without the copied hierarchy hook or confession comment example", async () => {
    state.createdPosts.length = 0;
    state.prompts.length = 0;
    const { POST } = await import("@/app/api/generate/route");

    const response = await POST(new Request("http://localhost/api/generate", {
      method: "POST",
      body: JSON.stringify({ brandId: "cmqpj5tjf0002eize6v2ui2lg", count: 3, campaignId: "cosmicpath_lean_sprint" }),
    }) as never);
    const prompts = state.prompts.join("\n");

    expect(response.status).toBe(200);
    expect(prompts).not.toContain("A보다 센 B보다 센");
    expect(prompts).not.toContain("난 솔직히 2번");
    expect(prompts).not.toContain("첫 줄에 물음표(?)를 넣어");
    expect(prompts).toContain("'난 솔직히'로 시작하지 않으며");
  }, 10000);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/app/api/generate/post-route-matrix.test.ts`
Expected: 새 테스트 FAIL (`expected … not to contain "A보다 센 B보다 센"`). 기존 테스트는 PASS.

- [ ] **Step 3: Write minimal implementation**

`src/lib/generate-posts.ts:484`의 "12만 뷰 서열화/극단적 앵커 훅" 줄 전체를 교체:

```ts
        "- [첫 줄 스크롤 멈춤]: 첫 줄은 구체 숫자(예: 10명 중 7명), 특정 살·일주 호명, 통념 반박 중 하나로 스크롤을 멈추게 한다. 최근 글에 쓰인 첫 줄 틀은 반복하지 않고, 평서문 끝에 억지로 물음표를 붙이지 않는다.",
```

`src/lib/generate-posts.ts:490`의 첫 댓글 줄 전체를 교체(링크·홍보 금지 문구는 유지, 고백 예시 제거):

```ts
        `- [Zero-Promo Conversation Igniter 첫 댓글]: 첫 댓글은 구분자(${SEPARATOR}) 바로 아래에 1~2줄로 작성한다. **[치명적 금지 규칙]** 첫 댓글에 '프로필 링크', '리포트', '판정표', '진단', 링크, 상업적 유도 문구를 절대 쓰지 마라 (Meta 알고리즘이 즉각 스팸 봇으로 판정하여 조회수를 0으로 락을 건다). 첫 댓글 방향은 바이럴 모드의 '첫 댓글:' 규칙을 따르고, '난 솔직히'로 시작하지 않으며 최근 글의 첫 댓글과 다른 말로 시작한다.`,
```

`src/lib/generate-posts.ts:715-721`의 `SAJU_VIRAL_REQUIREMENTS`를 교체:

```ts
// Mirrors the saju_viral quality gate so drafts are written to pass it instead of being discarded.
const SAJU_VIRAL_REQUIREMENTS = [
  "[필수 조건 — 하나라도 빠지면 품질 게이트에서 폐기됨]",
  "- 본문에 사주 용어를 최소 1개 넣는다 (예: 일간, 일주, 재성, 관성, 비겁, 식상, 도화살, 역마살, 화개살, 궁합, 대운).",
  "- 100% 반말/독백체(~임, ~했음, ~야)로 쓰고 ~습니다/~하세요 같은 존댓말은 쓰지 않는다.",
  "- 첫 줄 모양과 끝맺음은 바이럴 모드 규칙을 따른다. 모든 글을 질문이나 번호 선택지로 끝낼 필요는 없다.",
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/app/api/generate/post-route-matrix.test.ts`
Expected: 파일 전체 PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/generate-posts.ts src/app/api/generate/post-route-matrix.test.ts
git commit -m "fix(generate): 프롬프트의 복제 훅·고백 댓글 예시 제거"
```

---

### Task 4: 글 틀 서명과 틀 반복 검사

**Files:**
- Modify: `src/lib/anti-repeat-memory.ts` (상단 import, `RecentPostSummary`, 파일 끝에 함수 추가)
- Test: `src/lib/anti-repeat-memory.test.ts`

**Interfaces:**
- Consumes: `IDENTITY_MARKER_PATTERN` (Task 2, `@/lib/viral-intent-modes`)
- Produces:
  - `RecentPostSummary`에 `firstComment?: string | null`
  - `export interface StructureSignature { opener: "hierarchy" | "question" | "callout" | "statement"; hasNumberedChoices: boolean; closer: "save" | "ask" | "other"; commentOpener: string | null }`
  - `export function extractStructureSignature(content: string, firstComment?: string | null): StructureSignature`
  - `export function checkStructureRepeat(candidateContent: string, candidateFirstComment: string | null | undefined, recentPosts: RecentPostSummary[], options?: { window?: number; maxSame?: number }): SimilarityCheckResult` — 기본 `window = 5`, `maxSame = 1`. 같은 `opener|hasNumberedChoices|closer`가 창 안에 `maxSame`개를 넘거나, `commentOpener`가 창 안 글과 같으면 `isDuplicate: true` + 한국어 `reason`.

- [ ] **Step 1: Write the failing tests**

`src/lib/anti-repeat-memory.test.ts` import에 두 함수를 추가:

```ts
import {
  calculateJaccardSimilarity,
  checkAntiRepeatSimilarity,
  checkStructureRepeat,
  extractFirstSentence,
  extractStructureSignature,
  formatAntiRepeatContext,
} from "./anti-repeat-memory";
```

파일 끝에 추가:

```ts
describe("structure repeat", () => {
  const hierarchyPost = "궁합 점수보다 센 게 일간이고, 일간보다 센 건 잠드는 리듬임.\n1. 맞춘다\n2. 버틴다\n저장해";
  const recentHierarchy = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
      content: hierarchyPost.replace("궁합", `궁합${index}`),
      firstComment: `기록 ${index}`,
    }));

  it("classifies a post's skeleton", () => {
    expect(extractStructureSignature(hierarchyPost, "난 솔직히 1번 골랐다가 망함. 너넨?")).toEqual({
      opener: "hierarchy",
      hasNumberedChoices: true,
      closer: "save",
      commentOpener: "난 솔직히",
    });
    expect(extractStructureSignature("[연애] 신금 일주는 끊을 때 정으로 베임.\n너는 누구 붙잡고 있음?", null)).toEqual({
      opener: "callout",
      hasNumberedChoices: false,
      closer: "other",
      commentOpener: null,
    });
  });

  it("does not call a single incidental comparison a hierarchy", () => {
    expect(extractStructureSignature("남들보다 답장이 늦는 너, 문창귀인 타입임.\n너는 몇 시간 넘으면 서운함?").opener).toBe("callout");
  });

  it("rejects a third post with the same skeleton within the last five", () => {
    const result = checkStructureRepeat(hierarchyPost, "새 댓글 하나", recentHierarchy(2));
    expect(result.isDuplicate).toBe(true);
    expect(result.reason).toContain("같은 틀");
  });

  it("allows a skeleton that appears only once in the last five", () => {
    expect(checkStructureRepeat(hierarchyPost, "새 댓글 하나", recentHierarchy(1)).isDuplicate).toBe(false);
  });

  it("ignores matches older than the window", () => {
    const newer = Array.from({ length: 5 }, (_, index) => ({ content: `신금 일주 이야기 ${index}.\n너는 어떻게 봄`, firstComment: `다른 ${index}` }));
    expect(checkStructureRepeat(hierarchyPost, "새 댓글 하나", [...newer, ...recentHierarchy(2)]).isDuplicate).toBe(false);
  });

  it("rejects a first comment that opens like a recent one", () => {
    const recentPosts = [{ content: "신금 일주는 정으로 베임.\n너는?", firstComment: "난 솔직히 3일 삐졌음" }];
    const result = checkStructureRepeat("한국인 10명 중 7명은 시주를 잘못 앎.\n너는 알고 있음?", "난 솔직히 몰랐음", recentPosts);
    expect(result.isDuplicate).toBe(true);
    expect(result.reason).toContain("난 솔직히");
  });

  it("does not treat two missing first comments as the same opener", () => {
    const recentPosts = [{ content: "신금 일주는 정으로 베임.\n너는?", firstComment: null }];
    expect(checkStructureRepeat("한국인 10명 중 7명은 시주를 잘못 앎.\n너는 알고 있음?", null, recentPosts).isDuplicate).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/anti-repeat-memory.test.ts`
Expected: FAIL (`extractStructureSignature is not a function` 등)

- [ ] **Step 3: Write minimal implementation**

`src/lib/anti-repeat-memory.ts` 상단(주석 블록 다음)에 import 추가:

```ts
import { IDENTITY_MARKER_PATTERN } from "@/lib/viral-intent-modes";
```

`RecentPostSummary`에 필드 추가:

```ts
export interface RecentPostSummary {
  content: string;
  topic?: string | null;
  hookType?: string | null;
  ctaType?: string | null;
  campaignFormulaId?: string | null;
  firstComment?: string | null;
}
```

파일 끝에 추가:

```ts
export interface StructureSignature {
  opener: "hierarchy" | "question" | "callout" | "statement";
  hasNumberedChoices: boolean;
  closer: "save" | "ask" | "other";
  commentOpener: string | null;
}

function contentLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/^\[.*?\]\s*/, "").replace(/^#+\s*/, "").trim())
    .filter((line) => line.length > 0);
}

function classifyOpener(lines: string[]): StructureSignature["opener"] {
  const firstLine = lines[0] ?? "";
  const openingComparisons = lines.slice(0, 2).join(" ").match(/보다/g)?.length ?? 0;
  if (openingComparisons >= 2) return "hierarchy";
  if (firstLine.includes("?")) return "question";
  if (IDENTITY_MARKER_PATTERN.test(firstLine)) return "callout";
  return "statement";
}

function classifyCloser(lastLine: string): StructureSignature["closer"] {
  if (lastLine.includes("저장해")) return "save";
  if (lastLine.includes("어때?")) return "ask";
  return "other";
}

/**
 * Reduces a post to the template it follows, so rewordings of the same skeleton still match.
 */
export function extractStructureSignature(content: string, firstComment?: string | null): StructureSignature {
  const lines = contentLines(content);
  const commentWords = (firstComment ?? "").trim().split(/\s+/).filter((word) => word.length > 0).slice(0, 2);
  return {
    opener: classifyOpener(lines),
    hasNumberedChoices: /^\s*1[.)]\s/m.test(content),
    closer: classifyCloser(lines[lines.length - 1] ?? ""),
    commentOpener: commentWords.length > 0 ? commentWords.join(" ") : null,
  };
}

function shapeKey(signature: StructureSignature): string {
  return `${signature.opener}|${signature.hasNumberedChoices}|${signature.closer}`;
}

/**
 * Flags a candidate that reuses the skeleton or the first-comment opener of the most recent posts.
 */
export function checkStructureRepeat(
  candidateContent: string,
  candidateFirstComment: string | null | undefined,
  recentPosts: RecentPostSummary[],
  options?: { window?: number; maxSame?: number }
): SimilarityCheckResult {
  const candidate = extractStructureSignature(candidateContent, candidateFirstComment);
  const recent = recentPosts
    .slice(0, options?.window ?? 5)
    .map((post) => extractStructureSignature(post.content, post.firstComment));
  const sameShape = recent.filter((signature) => shapeKey(signature) === shapeKey(candidate)).length;
  if (sameShape > (options?.maxSame ?? 1)) {
    return { isDuplicate: true, similarityScore: 1, reason: `최근 글 ${sameShape}개와 같은 틀(${shapeKey(candidate)}) 반복: 첫 줄 유형·번호 선택지·마무리 중 하나를 바꿔라` };
  }
  if (candidate.commentOpener && recent.some((signature) => signature.commentOpener === candidate.commentOpener)) {
    return { isDuplicate: true, similarityScore: 1, reason: `첫 댓글 첫마디 "${candidate.commentOpener}"가 최근 글과 같음: 다른 말로 시작해라` };
  }
  return { isDuplicate: false, similarityScore: 0 };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/anti-repeat-memory.test.ts`
Expected: 파일 전체 PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/anti-repeat-memory.ts src/lib/anti-repeat-memory.test.ts
git commit -m "feat(anti-repeat): 글 틀 서명과 틀 반복 검사 추가"
```

---

### Task 5: saju 생성 루프에 틀 반복 검사 연결

**Files:**
- Modify: `src/lib/generate-posts.ts:10-14` (import), `:302-337` (`generateWithQuality`의 두 반복 검사 블록), `:914-925` (최근 글 select), `:983-986` (`inBatchPosts`)
- Test: `src/app/api/generate/post-route-matrix.test.ts`

**Interfaces:**
- Consumes: `checkStructureRepeat(candidateContent, candidateFirstComment, recentPosts)` (Task 4), `RecentPostSummary.firstComment` (Task 4), 테스트 `state.prompts` (Task 3)
- Produces: 없음 (생성 동작 변경)

- [ ] **Step 1: Write the failing test**

`src/app/api/generate/post-route-matrix.test.ts`의 `vi.hoisted` state에 spy 추가(`prompts` 다음 줄):

```ts
  checkStructureRepeat: vi.fn<
    (content: string, firstComment: string | null | undefined, recentPosts: Array<{ firstComment?: string | null }>) => { isDuplicate: boolean; similarityScore: number }
  >(() => ({ isDuplicate: false, similarityScore: 0 })),
```

Anthropic mock 아래에 부분 mock 추가:

```ts
vi.mock("@/lib/anti-repeat-memory", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/anti-repeat-memory")>();
  return { ...actual, checkStructureRepeat: state.checkStructureRepeat };
});
```

`it("persists 28 generated campaign posts into four 7-post viral mode buckets", …)` 첫 줄에 `state.checkStructureRepeat.mockClear();`를 넣고, 마지막 `expect(counts)…` 뒤에 추가:

```ts
    // career_decision drafts must never go through the Korean saju skeleton check
    expect(state.checkStructureRepeat).not.toHaveBeenCalled();
```

`it("persists a 4:4:4:3 CosmicPath sprint with tracked links only on every third post", …)` 첫 줄에 `state.checkStructureRepeat.mockClear();`를 넣고, 마지막 `expect(… utmContent …)` 뒤에 추가:

```ts
    const lastRecentPosts = state.checkStructureRepeat.mock.calls.at(-1)?.[2] ?? [];
    const commentNumber = (comment: string | null | undefined) => /북마크 (\d+)/.exec(comment ?? "")?.[1];
    expect(lastRecentPosts.length).toBeGreaterThan(1);
    // The window must start at the newest in-batch draft, not the oldest
    expect(lastRecentPosts.map((post) => commentNumber(post.firstComment)))
      .toEqual(state.createdPosts.slice(0, lastRecentPosts.length).map((post) => commentNumber(post.firstComment)).reverse());
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/app/api/generate/post-route-matrix.test.ts`
Expected: CosmicPath 15개 테스트 FAIL (`expected 0 to be greater than 1` — 아직 spy가 호출되지 않음). career 테스트는 PASS.

- [ ] **Step 3: Write minimal implementation**

`src/lib/generate-posts.ts:10-14` import에 추가:

```ts
import {
  checkAntiRepeatSimilarity,
  checkStructureRepeat,
  formatAntiRepeatContext,
  type RecentPostSummary,
} from "@/lib/anti-repeat-memory";
```

`generateWithQuality`에서 `qualityResult = withProhibitedPhraseCheck(qualityResult, lastResult.post);` 바로 아래의 `if (recentPosts.length > 0) { const similarity = … }` 블록 전체를 교체:

```ts
  // Word overlap and a shared skeleton both count as a repeat; the retry prompt receives the reason.
  // The skeleton rules are Korean saju templates, so other profiles only get the word-overlap check.
  const checkStructure = experiment.qualityProfile === "saju_viral";
  const withRepeatCheck = (result: typeof qualityResult, draft: typeof lastResult): typeof qualityResult => {
    if (recentPosts.length === 0) return result;
    const repeat = [
      checkAntiRepeatSimilarity(draft.post, recentPosts),
      ...(checkStructure ? [checkStructureRepeat(draft.post, draft.firstComment, recentPosts)] : []),
    ].find((check) => check.isDuplicate && check.reason);
    return repeat?.reason ? { ...result, pass: false, reasons: [repeat.reason, ...result.reasons] } : result;
  };
  qualityResult = withRepeatCheck(qualityResult, lastResult);
```

재시도 루프 안의 `if (recentPosts.length > 0) { const retrySimilarity = … }` 블록 전체를 교체:

```ts
    qualityResult = withRepeatCheck(qualityResult, lastResult);
```

`src/lib/generate-posts.ts:918-924` 최근 글 `select`에 `firstComment` 추가:

```ts
    select: {
      content: true,
      firstComment: true,
      topic: true,
      hookType: true,
      ctaType: true,
      campaignFormulaId: true,
    },
```

`src/lib/generate-posts.ts:983-986` `inBatchPosts`를 최신순 + `firstComment` 포함으로 교체:

```ts
      // Newest first, so the anti-repeat windows look at the latest drafts.
      const inBatchPosts: RecentPostSummary[] = [
        ...[...results].reverse().map((result) => ({ content: result.post, topic: result.topic, hookType: result.hookType, firstComment: result.firstComment })),
        ...recentPosts,
      ];
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/app/api/generate/post-route-matrix.test.ts src/app/api/cron/refill/route.test.ts src/app/api/generate/route.test.ts`
Expected: 모두 PASS

Run: `pnpm exec tsc --noEmit`
Expected: 출력 없음(에러 0)

- [ ] **Step 5: Commit**

```bash
git add src/lib/generate-posts.ts src/app/api/generate/post-route-matrix.test.ts
git commit -m "feat(generate): saju 생성에 틀 반복 검사 연결"
```

---

### Task 6: 점수기 신호 확장과 틀 처방 문구 제거

**Files:**
- Modify: `src/lib/threads-algorithm-scorer.ts:16` (import), `:58-69` (`HOOK_CURIOSITY_PATTERNS`), `:82-92` (`CONVERSATION_INVITATION_PATTERNS`), `:133`, `:163`, `:237` (수정 지시 문구)
- Test: `src/lib/threads-algorithm-scorer.test.ts`

**Interfaces:**
- Consumes: `IDENTITY_MARKER_PATTERN` (Task 2)
- Produces: 없음 (점수·수정 지시 변경. `remediation-engine`은 `actionableFixes`를 그대로 쓴다)

- [ ] **Step 1: Write the failing tests**

`src/lib/threads-algorithm-scorer.test.ts`의 첫 `describe("threads-algorithm-scorer", …)` 안 마지막에 추가:

```ts
  const FACT_POST = [
    "한국인 10명 중 7명은 자기 시주를 잘못 알고 있음.",
    "",
    "출생 시각을 표준시로만 넣으면 진태양시랑 30분 넘게 어긋나는 경우가 많아서, 일주는 맞아도 시주 글자가 통째로 바뀜.",
    "",
    "시주가 바뀌면 말년운 해석이랑 자식 궁 읽는 기준이 전부 달라짐.",
    "",
    "너는 태어난 시간 정확히 알고 있음?",
  ].join("\n");
  const IDENTITY_POST = [
    "신금 일주는 끊을 때 칼이 아니라 정으로 베임.",
    "판단은 빠른데 인정은 제일 늦게 하는 타입이라, 이미 끝난 관계를 1년씩 끌고 감.",
    "",
    "강점은 한 번 정한 기준을 끝까지 지키는 거고, 맹점은 그 기준이 상대 사정을 못 봄.",
    "",
    "너는 지금 누구를 정 때문에 붙잡고 있음?",
  ].join("\n");

  it("passes fact and identity hooks that end with a direct question instead of numbered choices", () => {
    for (const post of [FACT_POST, IDENTITY_POST]) {
      const result = scoreThreadsPostAlgorithmic(post, "너넨 일주 뭐야? 같은 일주 있으면 이 맹점 맞는지 궁금함.");
      expect(result.dimensions.hookTension.score).toBeGreaterThanOrEqual(17);
      expect(result.dimensions.conversationDepth.score).toBeGreaterThanOrEqual(16);
      expect(result.totalScore).toBeGreaterThanOrEqual(80);
    }
  });

  it("never prescribes the hierarchy hook or numbered choices as a fix", () => {
    const fixes = scoreThreadsPostAlgorithmic("오늘은 날씨가 좋았음.\n\n사주 공부를 조금 했음.").actionableFixes.join(" ");
    expect(fixes).not.toContain("보다 센");
    expect(fixes).not.toContain("1번/2번");
    expect(fixes).not.toContain("선택지");
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/threads-algorithm-scorer.test.ts`
Expected: 새 테스트 2개 FAIL (현재 두 글은 hook 10, conversation 11, 총 71점이고, 수정 지시에 "A보다 센 B"·"1번/2번"·"선택지"가 들어 있음)

- [ ] **Step 3: Write minimal implementation**

`src/lib/threads-algorithm-scorer.ts:16` import 교체:

```ts
import { IDENTITY_MARKER_PATTERN, hasFortuneOverclaim, hasReplyBurdenPromise } from "@/lib/viral-intent-modes";
```

`HOOK_CURIOSITY_PATTERNS` 배열 끝(영문 정규식 다음)에 추가:

```ts
  /\d+\s*(?:명|%|년|개월|개|번|만|억|살|시간)/,
  IDENTITY_MARKER_PATTERN,
  /(?:^|\s)너(?:는|가|넨|네|희)?(?=[\s,.?!]|$)/,
```

`CONVERSATION_INVITATION_PATTERNS` 배열 끝(영문 정규식 다음)에 추가:

```ts
  /(?:^|\s)너(?:는|넨|네|희|가)?\s[^\n]*\?/,
```

수정 지시 문구 3곳 교체:

```ts
    actionableFixes.push("첫 줄에 구체 숫자, 특정 살/일주 호명, 통념 반박 중 하나를 넣으십시오.");
```

```ts
    actionableFixes.push("본문 끝에 독자에게 직접 묻는 한 문장을 두십시오.");
```

```ts
    actionableFixes.push("최소 100자 이상으로 맥락을 보강하십시오.");
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/threads-algorithm-scorer.test.ts src/lib/remediation-engine.test.ts src/candidate-posts.test.ts src/app/api/posts`
Expected: 모두 PASS. 특히 기존 "penalizes meta policy violation keywords"(숫자 `1000만`이 있는 스팸 글)가 여전히 `pass: false`로 PASS해야 한다(Review Focus 5).

- [ ] **Step 5: Commit**

```bash
git add src/lib/threads-algorithm-scorer.ts src/lib/threads-algorithm-scorer.test.ts
git commit -m "fix(scorer): 숫자·호명·직접 질문 신호 추가, 틀 처방 문구 제거"
```

---

### Task 7: 운영 캠페인 서열 공식 문구 (코드 + dry-run)

**Files:**
- Modify: `scripts/cosmicpath-viral-reset-config.js:14`, `:91`
- Modify: `scripts/set-cosmicpath-match-focus.ts`
- Test: `scripts/cosmicpath-viral-reset-config.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `CONCEPT_HIERARCHY_INSTRUCTION` (`cosmicpath-viral-reset-config.js` export) = `"실제 사주 개념 2~3개(살·십신·일주)를 서열이나 대비로 비교한다. 같은 비교 문장 틀을 반복하지 않는다."`. `set-cosmicpath-match-focus.ts --apply`가 DB 캠페인 `cosmicpath_viral_reset_v1`의 `concept_hierarchy.instruction`을 이 값으로 바꾼다.

- [ ] **Step 1: Write the failing test**

`scripts/cosmicpath-viral-reset-config.test.ts`의 `describe` 안 마지막에 추가:

```ts
  it("describes the hierarchy formula without forcing a two-step 'A보다 센' sentence", () => {
    const result = buildCosmicPathViralResetConfig({ campaigns: [] }) as {
      campaigns: Array<{ formulas: Array<{ id: string; instruction: string }> }>;
    };
    const hierarchy = result.campaigns[0]?.formulas.find((formula) => formula.id === "concept_hierarchy");

    expect(hierarchy?.instruction).toContain("2~3개");
    expect(hierarchy?.instruction).not.toContain("A보다 센");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run scripts/cosmicpath-viral-reset-config.test.ts`
Expected: 새 테스트 FAIL (`expected "A보다 센 B보다 센 C 구조로 …" to contain "2~3개"`)

- [ ] **Step 3: Write minimal implementation**

`scripts/cosmicpath-viral-reset-config.js` — `const CAMPAIGN_ID = …;` 다음 줄에 상수 추가:

```js
const CONCEPT_HIERARCHY_INSTRUCTION = "실제 사주 개념 2~3개(살·십신·일주)를 서열이나 대비로 비교한다. 같은 비교 문장 틀을 반복하지 않는다.";
```

`FORMULAS`의 `concept_hierarchy` 항목 `instruction`을 교체:

```js
    instruction: CONCEPT_HIERARCHY_INSTRUCTION,
```

`module.exports` 교체:

```js
module.exports = { CAMPAIGN_ID, CONCEPT_HIERARCHY_INSTRUCTION, buildCosmicPathViralResetConfig };
```

`scripts/set-cosmicpath-match-focus.ts` — 첫 import 다음에 추가:

```ts
import { createRequire } from "node:module";
```

`const prisma = new PrismaClient();` 다음 줄에 추가:

```ts
const require = createRequire(import.meta.url);
```

`isRecord` 함수 아래에 helper 2개 추가:

```ts
function readHierarchyInstruction(): string {
  const resetConfig: unknown = require("./cosmicpath-viral-reset-config.js");
  if (!isRecord(resetConfig) || typeof resetConfig.CONCEPT_HIERARCHY_INSTRUCTION !== "string") {
    throw new Error("cosmicpath-viral-reset-config.js must export CONCEPT_HIERARCHY_INSTRUCTION");
  }
  return resetConfig.CONCEPT_HIERARCHY_INSTRUCTION;
}

function findHierarchyFormula(campaign: Json): Json {
  const formulas = Array.isArray(campaign.formulas) ? campaign.formulas : [];
  const formula = formulas.find((item): item is Json => isRecord(item) && item.id === "concept_hierarchy");
  if (!formula) throw new Error(`Campaign '${CAMPAIGN_ID}' has no concept_hierarchy formula`);
  return formula;
}
```

`main()` 안에서 `if (!campaign) throw …` 다음 줄에 추가:

```ts
  const hierarchyFormula = findHierarchyFormula(campaign);
  const hierarchyInstruction = readHierarchyInstruction();
```

`console.log("targets/situations (before):", …)` 다음 줄에 추가:

```ts
  console.log("concept_hierarchy.instruction:", hierarchyFormula.instruction, "->", hierarchyInstruction);
```

`config.situations = [];` 다음 줄에 추가:

```ts
  hierarchyFormula.instruction = hierarchyInstruction;
```

- [ ] **Step 4: Run test and dry-run to verify**

Run: `pnpm exec vitest run scripts/cosmicpath-viral-reset-config.test.ts`
Expected: 파일 전체 PASS

Run: `node --env-file=/Users/kim-young-gwang/Desktop/projects/threads-uploader/.env scripts/set-cosmicpath-match-focus.ts`
Expected: `concept_hierarchy.instruction: A보다 센 B보다 센 C 구조로 … -> 실제 사주 개념 2~3개…` 줄과 `Dry run only.`가 출력되고, DB는 바뀌지 않는다. (`--apply`는 Task 8에서 배포 후 실행)

- [ ] **Step 5: Commit**

```bash
git add scripts/cosmicpath-viral-reset-config.js scripts/cosmicpath-viral-reset-config.test.ts scripts/set-cosmicpath-match-focus.ts
git commit -m "chore(scripts): 운영 서열 공식 지시문에서 두 단계 비교 강제 제거"
```

---

### Task 8: 전체 검증, 배포, 운영 반영, 실측

**Files:**
- Create (throwaway, 원 저장소 `scratch/`, 커밋하지 않음): `/Users/kim-young-gwang/Desktop/projects/threads-uploader/scratch/measure-structure.ts`

**Interfaces:**
- Consumes: Task 1~7 결과
- Produces: 운영 배포, DB 공식 문구 갱신, 실측 결과 보고

- [ ] **Step 1: 전체 검증**

Run: `pnpm exec vitest run`
Expected: 전체 PASS

Run: `pnpm exec tsc --noEmit`
Expected: 출력 없음

Run: `pnpm exec eslint src/lib/quality-gate.ts src/lib/viral-intent-modes.ts src/lib/domain-registry.ts src/lib/generate-posts.ts src/lib/anti-repeat-memory.ts src/lib/threads-algorithm-scorer.ts src/app/api/generate/post-route-matrix.test.ts scripts/set-cosmicpath-match-focus.ts`
Expected: 새 경고·에러 없음 (`generate-posts.ts`의 기존 미사용 import 경고가 main에 있다면 그것만 허용)

- [ ] **Step 2: 사용자 확인 후 배포**

사용자에게 커밋 목록(`git log --oneline origin/main..HEAD`)을 보여주고 push 승인을 받는다. 승인 후:

```bash
git fetch origin
git merge-base --is-ancestor origin/main HEAD
git push origin fix/template-diversity:main
```

Expected: fast-forward push 성공. 이어서 Vercel 상태 확인:

```bash
gh api repos/KIMYOUNGGWANG/thread-uploader/commits/$(git rev-parse HEAD)/status --jq '.state'
```

Expected: `success` (pending이면 20초 간격으로 다시 확인)

- [ ] **Step 3: 운영 DB 공식 문구 반영**

Run: `node --env-file=/Users/kim-young-gwang/Desktop/projects/threads-uploader/.env scripts/set-cosmicpath-match-focus.ts --apply`
Expected: `Applied.` (Task 7 dry-run과 같은 변경만 출력되는지 먼저 확인)

- [ ] **Step 4: 재생성과 실측**

배포 시각을 기록하고(`date -u +%Y-%m-%dT%H:%M:%SZ`) refill을 실행한다. refill은 `min(6, 10 - 현재 대기 수)`개를 만든다:

```bash
gh workflow run refill.yml --ref main
```

완료 후, 원 저장소에 throwaway 측정 스크립트를 만든다. `extractStructureSignature`와 같은 규칙을 그대로 옮긴 것이다:

```ts
import { PrismaClient } from "@prisma/client";

// Throwaway: mirrors extractStructureSignature to measure posts generated after the deploy.
const prisma = new PrismaClient();
const since = new Date(process.argv[2] ?? "");
if (Number.isNaN(since.getTime())) throw new Error("usage: node --env-file=.env scratch/measure-structure.ts <ISO time>");
const brand = await prisma.brand.findFirst({ where: { slug: "cosmicpath" } });
if (!brand) throw new Error("brand cosmicpath not found");
const posts = await prisma.post.findMany({
  where: { brandId: brand.id, createdAt: { gte: since } },
  orderBy: { createdAt: "asc" },
  select: { content: true, firstComment: true },
});
const identity = /화개살?|도화살?|홍염살?|문창귀인|천을귀인|진술축미|(?:신금|경금|갑목|을목|병화|정화|무토|기토|임수|계수)\s*(?:일주|타입)/;
const rows = posts.map(({ content, firstComment }) => {
  const lines = content.split("\n").map((line) => line.replace(/^\[.*?\]\s*/, "").replace(/^#+\s*/, "").trim()).filter(Boolean);
  const comparisons = lines.slice(0, 2).join(" ").match(/보다/g)?.length ?? 0;
  const opener = comparisons >= 2 ? "hierarchy" : lines[0]?.includes("?") ? "question" : identity.test(lines[0] ?? "") ? "callout" : "statement";
  const last = lines[lines.length - 1] ?? "";
  const closer = last.includes("저장해") ? "save" : last.includes("어때?") ? "ask" : "other";
  const shape = `${opener}|${/^\s*1[.)]\s/m.test(content)}|${closer}`;
  return { shape, comment: (firstComment ?? "").trim().split(/\s+/).slice(0, 2).join(" "), firstLine: lines[0] ?? "" };
});
const counts = rows.reduce<Record<string, number>>((total, row) => ({ ...total, [row.shape]: (total[row.shape] ?? 0) + 1 }), {});
const comments = rows.map((row) => row.comment).filter(Boolean);
console.log("posts:", rows.length);
rows.forEach((row, index) => console.log(index + 1, row.shape, "|", row.comment, "|", row.firstLine.slice(0, 50)));
console.log("max same shape:", Math.max(0, ...Object.values(counts)), "| repeated comment openers:", comments.length - new Set(comments).size);
await prisma.$disconnect();
```

Run (원 저장소에서): `node --env-file=.env scratch/measure-structure.ts <배포 시각>`
Expected (스펙 성공 기준): `max same shape` ≤ 2, `repeated comment openers` = 0. 생성 수가 6 미만이면 실제 개수를 함께 보고한다.

측정이 끝나면 `scratch/measure-structure.ts`는 지운다.

- [ ] **Step 5: 정리와 보고**

worktree를 정리하고(`git worktree remove <WT>` — 원 저장소에서 실행), 사용자에게 보고한다: 커밋 목록, 테스트·타입체크 결과, 배포 상태, DB 반영 결과, 실측 표(글별 틀·첫 댓글 첫마디·첫 줄).
