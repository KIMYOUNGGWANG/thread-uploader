# X 인기글 수동 레퍼런스 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 대시보드 "소재" 탭에 X 글을 붙여넣으면, 브랜드 도메인에 맞춘 `ref_replay` 초안 1개를 바로 `NEEDS_REVIEW`로 만든다.

**Architecture:** 붙여넣은 글은 기존 `ViralExample`에 `source = "manual_x"`로 저장한다. 생성은 기존 `generatePostsForBrand(referenceReplay)` 경로를 그대로 탄다. 입력에 `kind`·`linkUrl`·`manual`·`initialStatus`만 더한다. 재작성 지시문은 상수 대신 `referenceReplayMode(kind, brandName, angle)`로 만든다. 수동 행과 수동 글은 학습 쿼리와 크론 판정에서 상수 하나로 걸러낸다.

**Tech Stack:** Next.js App Router, TypeScript strict, Prisma 5.22(스키마 변경 없음), vitest, pnpm

**Spec:** `docs/superpowers/specs/2026-10-29-x-manual-reference-design.md`

## Global Constraints

- 패키지 매니저는 pnpm만 쓴다. 새 라이브러리는 설치하지 않는다(zod 없음 → `unknown` + 타입 좁히기).
- `any` 금지. `unknown`을 받아서 타입을 좁힌다.
- DB 스키마·마이그레이션 변경 없음. 인증 로직 변경 없음(`requireBrandForCurrentUser`만 호출한다).
- 상수값
  - `MANUAL_X_SOURCE = "manual_x"`
  - `REFERENCE_REPLAY_MANUAL_TAG = "ref_replay_manual"`
  - 정보형 mode id = `"ref_replay_info"`
- 입력 규칙
  - 본문: 공백을 뺀 길이 20자 이상, 전체 5,000자 이하
  - 링크: `http://` 또는 `https://`
  - X 주소: `https://(www.)?(x|twitter).com/<handle>/status/<digits>`
- cosmicpath 사연형 지시문은 지금 문자열과 **글자 그대로** 같아야 한다.
- 커밋 메시지: conventional commits, 한국어 설명. `git add`는 파일 이름을 지정해서 한다.

## Review Focus

1. **X 주소에 쿼리스트링이나 `/photo/1`이 붙은 경우**(`…/status/123?s=20`): 같은 `sourceKey` `"123"`으로 읽혀야 한다. → Task 5 테스트
2. **정보형인데 링크를 비워둔 경우**: 평소 링크 정책을 따라야 한다. `shouldLink`를 강제로 끄면 안 된다. → Task 3 테스트
3. **품질 탈락 뒤 같은 글로 다시 시도하는 경우**: 막지 않아야 한다. 중복 판정은 "그 행으로 만든 Post가 있나"뿐이다. → Task 5 테스트
4. **승인된 수동 사연형 글(PENDING)이 대기열에 있는 날**: 크론 `ref_replay`가 막히면 안 된다. → Task 4 테스트
5. **영어 브랜드(cosmicpath-global)에서 정보형을 쓰는 경우**: `ENGLISH_VIRAL_MODE_LABELS`에 `ref_replay_info`가 있어서 영어 지시문이 나와야 한다. → Task 2 테스트

---

### Task 1: 가짜 트렌드 파일 삭제

**Files:**
- Delete: `src/lib/last30days-trend-fetcher.ts`, `src/lib/last30days-trend-fetcher.test.ts`

- [ ] **Step 1:** `grep -rn "last30days-trend-fetcher" src` → 두 파일 말고 참조가 없는지 확인한다.
- [ ] **Step 2:** 두 파일을 삭제한다(`git rm`).
- [ ] **Step 3:** `pnpm typecheck` → 에러 0
- [ ] **Step 4:** 커밋 `chore(trend): 가짜 데이터를 만들던 last30days 트렌드 파일 삭제`

### Task 2: 브랜드별 재작성 모드

**Files:**
- Modify: `src/lib/domain-registry.ts` (`DomainPresetConfig` 58~65, `saju_viral` 프리셋)
- Modify: `src/lib/viral-intent-modes.ts` (`ViralIntentModeId` 3~18, `REFERENCE_REPLAY_MODE` 290~301, `resolveViralIntentMode` 466~473, `ENGLISH_VIRAL_MODE_LABELS` 476~)
- Test: `src/lib/viral-intent-modes.test.ts` (없으면 Create)

**Interfaces:**
- Produces:
  - `type ReferenceKind = "story" | "info"` (viral-intent-modes.ts에서 export)
  - `referenceReplayMode(kind: ReferenceKind, brandName: string, angle: string): ViralIntentMode`
  - `REFERENCE_INFO_MODE_ID = "ref_replay_info"`
  - `DomainPresetConfig.referenceAngle?: string`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
describe("referenceReplayMode", () => {
  it("cosmicpath story keeps today's exact instruction and rules", () => {
    const mode = referenceReplayMode("story", "cosmicpath", "사주·궁합·타이밍");
    expect(mode.id).toBe("ref_replay");
    expect(mode.instruction).toBe("아래 참고 글의 상황(무슨 일이 있었는지)과 감정의 흐름(예: 황당 → 찔림 → 체념)을 가져와, cosmicpath 독자가 자기 일처럼 느낄 새 글을 쓴다. 구조(첫 줄 방식, 줄 구성, 마무리)도 참고하되 그대로 베끼지 않는다.");
    expect(mode.rules).toContain("감정선은 가져오되 결론·시선은 cosmicpath(사주·궁합·타이밍)로 가져온다. 원글의 결론을 반복하지 않는다.");
    expect(REFERENCE_REPLAY_MODE).toEqual(mode); // constant stays the cosmicpath story mode
  });
  it("product brand info mode carries brand angle and no saju words", () => {
    const preset = getDomainPreset("product_growth");
    const mode = referenceReplayMode("info", "catchdex", preset.referenceAngle ?? preset.description);
    expect(mode.id).toBe("ref_replay_info");
    const text = [mode.instruction, ...mode.rules].join("\n");
    expect(text).toContain("catchdex");
    expect(text).toContain(preset.description);
    for (const word of ["사주", "궁합", "운세", "cosmicpath"]) expect(text).not.toContain(word);
  });
  it("saju preset defines referenceAngle; others fall back to description", () => {
    expect(getDomainPreset("saju_viral").referenceAngle).toBe("사주·궁합·타이밍");
    expect(getDomainPreset("product_growth").referenceAngle).toBeUndefined();
  });
  it("resolves ref_replay_info and has an English label", () => {
    expect(resolveViralIntentMode("ref_replay_info", 0).id).toBe("ref_replay_info");
    expect(ENGLISH_VIRAL_MODE_LABELS.ref_replay_info.instruction).toMatch(/link|tool|resource/i);
  });
});
```

- [ ] **Step 2:** `pnpm vitest run src/lib/viral-intent-modes.test.ts` → FAIL (`referenceReplayMode` 없음)
- [ ] **Step 3: 구현**
  - `DomainPresetConfig`에 `referenceAngle?: string`을 추가한다. `saju_viral`에만 `referenceAngle: "사주·궁합·타이밍"`을 넣는다.
  - `ViralIntentModeId`에 `"ref_replay_info"`를 추가한다.
  - 스토리 지시문과 규칙은 `brandName`·`angle`로 치환하는 템플릿으로 만든다. `REFERENCE_REPLAY_MODE = referenceReplayMode("story", "cosmicpath", "사주·궁합·타이밍")`로 남겨서 기존 import는 그대로 둔다.
  - 정보형 instruction과 rules는 스펙 4.3 요지를 그대로 담는다.
    - 원글 항목과 순서는 유지하고, 지어내지 않는다.
    - 문장은 번역하지 않고 새로 쓴다. 관점은 "`${brandName}` 독자에게 왜 쓸모있는지 — `${angle}`"이다.
    - 첫 줄에 결과·숫자·반전 중 하나를 넣는다.
    - 본문에 URL을 쓰지 않는다.
    - 본문은 300~900자를 목표로 한다.
  - `resolveViralIntentMode`는 `"ref_replay_info"`를 받으면 `referenceReplayMode("info", "", "")`를 돌려준다. 이 함수는 id와 label로만 쓰인다.
  - `ENGLISH_VIRAL_MODE_LABELS.ref_replay_info`에 같은 뜻의 영어 지시문을 넣는다.
- [ ] **Step 4:** 같은 테스트 + `pnpm vitest run src/lib/domain-registry.test.ts` → PASS
- [ ] **Step 5:** 커밋 `feat(replay): 레퍼런스 재작성 지시문을 브랜드 도메인으로 일반화`

### Task 3: 생성 입력 확장 (유형·링크·수동 표시·저장 상태)

**Files:**
- Modify: `src/lib/generate-posts.ts`
  - `GeneratePostsInput` 957~965
  - 모드 선택 1160~1161
  - `referenceReplay` 분기 1227~1231
  - qualityReasons 1330~1334
  - `postStatus` 1337
  - `prisma.post.create`의 `firstComment`
- Test: `src/lib/generate-posts-reference-replay.test.ts` (기존 mock을 그대로 쓴다)

**Interfaces:**
- Consumes: `referenceReplayMode`, `ReferenceKind` (Task 2)
- Produces: `src/lib/reference-replay.ts`에 상수 `MANUAL_X_SOURCE = "manual_x"`, `REFERENCE_REPLAY_MANUAL_TAG = "ref_replay_manual"`를 export한다. 그리고 다음 입력을 추가한다:
  ```ts
  referenceReplay?: { id: string; content: string; kind?: ReferenceKind; linkUrl?: string; manual?: boolean };
  initialStatus?: "NEEDS_REVIEW";
  ```
  - `kind`가 없으면 `"story"`, `initialStatus`가 없으면 `"PENDING"`이다.

- [ ] **Step 1: 실패하는 테스트 작성** (기존 파일의 brand·mock 헬퍼를 재사용한다)
  - `it("manual info reference with link: NEEDS_REVIEW, original link in first comment, no product link")`
    - 입력: `referenceReplay: { id: "ex_m", content: "5 free UI resources…", kind: "info", linkUrl: "https://uiverse.io", manual: true }`, `initialStatus: "NEEDS_REVIEW"`
    - 기대 1: `prisma.post.create`가 `status: "NEEDS_REVIEW"`로 호출된다.
    - 기대 2: `firstComment`가 `"→ https://uiverse.io"`로 끝난다.
    - 기대 3: `formulaId: "ref_replay_info"`이다.
    - 기대 4: `qualityReasons` JSON에 `"ref_replay_manual"`과 `"ref_replay_source:ex_m"`이 들어 있다.
    - 기대 5: `prisma.post.update`가 `linkUrl`로 호출되지 않는다.
    - 기대 6: Anthropic에 보낸 프롬프트에 `"/r/"`와 `[링크 정책]`의 제품 CTA 문구가 없다.
  - `it("info reference without link keeps the normal link policy")`: `linkUrl`을 빼고, 캠페인 `perPostLinks`가 켜진 brand로 호출한다. 기대: `post.update`가 `linkUrl`과 함께 호출된다.
  - `it("calls without initialStatus still save PENDING")`: 기존 크론 형태 입력 → `status: "PENDING"`
  - `it("prompt uses the brand's domain angle")`: `qualityProfile: "product_growth"` brand → 프롬프트에 `getDomainPreset("product_growth").description`이 있고 `"사주·궁합·타이밍"`이 없다.
  - `it("info rewrite that keeps tool names is not flagged as a copy")`
    - `checkAntiRepeatSimilarity`(실제 함수, mock 아님)에 두 글을 넣는다.
      - 영어 원문: `"5 free web UI resources 👇\n1. uiverse.io\n2. shadcn/ui\n3. magicui.design"`
      - 같은 도구 3개를 소개하는 한국어 재작성 본문
    - 기대: `isDuplicate === false`
    - 이게 실패하면 스펙 4.3대로 비교 전에 URL·도메인을 지우는 전처리를 `generate-posts.ts:350` 호출부에만 추가한다.
- [ ] **Step 2:** `pnpm vitest run src/lib/generate-posts-reference-replay.test.ts` → 새 테스트 FAIL
- [ ] **Step 3: 구현**
  - 모드: `referenceReplayMode(referenceReplay.kind ?? "story", brand.slug, domainPreset.referenceAngle ?? domainPreset.description)`
  - 링크: `referenceReplay.linkUrl`이 있으면 `buildExperiment` 뒤에 `experiment.shouldLink = false`로 둔다. 저장할 때 `firstComment = appendFirstCommentLink(initialComment ?? "", referenceReplay.linkUrl)`로 넣는다.
  - 태그: `manual`이면 qualityReasons에 태그를 추가한다.
  - 상태: `postStatus = input.initialStatus ?? "PENDING"` (1336의 "Nobody reviews" 주석은 수동 예외를 한 줄로 고친다)
- [ ] **Step 4:** 같은 파일 + `pnpm vitest run src/lib/generate-posts` → PASS (기존 회귀 포함)
- [ ] **Step 5:** 커밋 `feat(generate): 레퍼런스 유형·링크·승인 대기 저장 입력 추가`

### Task 4: 수동 행·수동 글 격리

**Files:**
- Modify: `src/lib/reference-replay.ts` (상수 export, `loadReferenceReplaySource` 85~)
- Modify: `src/lib/reference-replay-refill.ts` (`today`·`pending` count 22~27, `attemptedSince` 53~)
- Modify: `src/lib/viral-service.ts` (`getViralReport` 70, `learnViralPatterns` 215)
- Modify: `src/lib/viral-llm-analysis.ts` (`analyzeTopViralExamples` 135)
- Test: `src/lib/reference-replay-refill.test.ts`, `src/lib/reference-replay.test.ts`, `src/lib/viral-service.test.ts`

**Interfaces:**
- Consumes: `MANUAL_X_SOURCE`, `REFERENCE_REPLAY_MANUAL_TAG` (Task 3, reference-replay.ts)

- [ ] **Step 1: 실패하는 테스트 작성**
  - refill: `today`·`pending` count의 `where`에 `NOT: { qualityReasons: { contains: "ref_replay_manual" } }`이 들어 있다(`mocks.countPosts.mock.calls`로 확인).
  - refill: `attemptedSince` findMany의 `where.source`가 `{ not: "manual_x" }`이다.
  - reference-replay: `loadReferenceReplaySource` findMany의 `where.source`가 `{ notIn: ["youtube_shorts", "manual_x"] }`이다.
  - viral-service: `getViralReport`와 `learnViralPatterns`의 findMany `where.source`가 `{ notIn: ["youtube_shorts", "manual_x"] }`이다.
- [ ] **Step 2:** 해당 테스트 실행 → FAIL
- [ ] **Step 3: 구현**
  - 세 쿼리와 `loadReferenceReplaySource`, `analyzeTopViralExamples`의 `source: { not: SHORTS_SOURCE }`를 `{ notIn: [SHORTS_SOURCE, MANUAL_X_SOURCE] }`로 바꾼다.
  - 크론 count 두 개에 `NOT` 조건을 추가한다.
  - `attemptedSince`에 `source: { not: MANUAL_X_SOURCE }`를 추가한다.
- [ ] **Step 4:** `pnpm vitest run src/lib/reference-replay src/lib/viral-service src/lib/viral-llm-analysis` → PASS
- [ ] **Step 5:** 커밋 `fix(replay): 수동 X 레퍼런스가 학습·크론 판정에 섞이지 않게 분리`

### Task 5: 수동 레퍼런스 서비스 + API

**Files:**
- Create: `src/lib/manual-reference.ts`
- Create: `src/app/api/viral/references/manual/route.ts`
- Test: `src/lib/manual-reference.test.ts`

**Interfaces:**
- Consumes: `generatePostsForBrand` (Task 3 입력), `MANUAL_X_SOURCE`, `REFERENCE_REPLAY_SOURCE_PREFIX`, `markReferenceAttempted` (reference-replay.ts), `hashContent` (viral-harvester.ts:53), `requireBrandForCurrentUser`·`accessErrorResponse` (brand-access.ts)
- Produces:
  ```ts
  type ManualReferenceInput = { content: string; kind: ReferenceKind; linkUrl: string | null; sourceUrl: string | null };
  function parseManualReferenceInput(body: unknown): { ok: true; value: ManualReferenceInput } | { ok: false; errors: Partial<Record<"content" | "kind" | "linkUrl" | "sourceUrl", string>> };
  function parseXStatusUrl(url: string): { statusId: string; handle: string } | null;
  type ManualReferenceResult =
    | { status: "created"; postId: string }
    | { status: "dropped"; reasons: string[] }
    | { status: "duplicate" };
  async function createManualReferenceDraft(brand: Brand, input: ManualReferenceInput, now: Date): Promise<ManualReferenceResult>;
  ```
- API: `POST` body `{ brandId, content, kind, linkUrl?, sourceUrl? }`
  - 400: `{ errors }`
  - 200: `ManualReferenceResult`
  - 403/404: `accessErrorResponse`
  - 500: `{ error }`

- [ ] **Step 1: 실패하는 테스트 작성**
  - 파서
    - 공백 뺀 길이가 19자면 `errors.content`가 있다.
    - 5,001자면 `errors.content`가 있다.
    - `kind: "news"`면 `errors.kind`가 있다.
    - `linkUrl: "ftp://a"`면 `errors.linkUrl`이 있다.
    - `sourceUrl: "https://x.com/a"`면 `errors.sourceUrl`이 있다.
    - 빈 문자열 링크와 주소는 `null`로 받는다.
    - `kind: "story"`인데 `linkUrl`이 있으면 `null`로 버린다.
  - `parseXStatusUrl`
    - `"https://twitter.com/Foo/status/123/photo/1?s=20"` → `{ statusId: "123", handle: "foo" }`
    - `"https://x.com/i/web/status/9"` → `statusId "9"`
  - 서비스 (prisma와 generate mock)
    - **sourceKey**: X 주소가 있으면 `"123"`, 없으면 `hashContent(content)`이다.
    - **upsert**: `where`가 `brandId_source_sourceKey`이고, `source: "manual_x"`, `rawMetrics`에 `{"manual":true,"kind":"info","linkUrl":…}`이 들어간다.
    - **duplicate**: `post.findFirst`가 `qualityReasons contains "ref_replay_source:<exampleId>"`로 결과를 찾으면 `{ status: "duplicate" }`를 돌려주고 generate는 호출하지 않는다.
    - **재시도**: Post는 없고 `replayAttemptedAt`만 찍힌 행이면 generate를 호출한다.
    - **generate 호출값**: `{ count: 1, insertAtFront: true, requestedCampaignId: null, approvedCampaignStart: false, postCategory: "GROWTH", initialStatus: "NEEDS_REVIEW", referenceReplay: { id, content, kind, linkUrl, manual: true } }`. `linkUrl`이 null이면 키를 넣지 않는다.
    - **결과 매핑**
      - `summary.count === 0` → `{ status: "dropped", reasons: failureReasons }`이고 `markReferenceAttempted`를 호출한다.
      - `result.ok === false` → `{ status: "dropped", reasons: [error] }`
      - 성공 → 방금 만든 `ref_replay_source:<id>` 태그 Post의 id를 돌려준다.
- [ ] **Step 2:** `pnpm vitest run src/lib/manual-reference.test.ts` → FAIL
- [ ] **Step 3:** 구현
  - 라우트는 다음 순서만 한다: 파싱 → `requireBrandForCurrentUser(brandId)` → 서비스 호출.
  - 기존 `src/app/api/viral/route.ts` 패턴을 따른다.
  - `authorUsername`은 `parseXStatusUrl` 결과의 handle을 쓴다(`i/web`이면 null). `publishedAt`은 `now`다.
- [ ] **Step 4:** 같은 테스트 → PASS
- [ ] **Step 5:** 커밋 `feat(viral): X 글 수동 레퍼런스로 승인 대기 초안 만드는 API 추가`

### Task 6: 소재 탭 카드 + 카드 라벨

**Files:**
- Create: `src/components/ManualReferenceCard.tsx`
- Modify: `src/components/Dashboard.tsx` (탭 버튼 986~1000, 1018~1020 렌더, `fetchPosts` 375, `setReviewOnly` 339)
- Modify: `src/components/PostCard.tsx:388` (NEEDS_REVIEW 라벨)

**Interfaces:**
- Consumes: Task 5 API와 `ManualReferenceResult`
- Produces: `<ManualReferenceCard brandId={string} brandName={string} onCreated={() => Promise<void>} />`

- [ ] **Step 1:** 시각 기준을 확인한다
  - 목업: `.superpowers/brainstorm/95910-1793235480/content/reference-input-layout.html`
  - 기존 톤: `NewsTrendingTab.tsx`의 slate·indigo, rounded-xl
- [ ] **Step 2: 카드 구현**
  - 입력 칸 4개는 스펙 3장 표 그대로다.
    - 유형 기본값은 `"info"`다.
    - 링크 칸은 `info`일 때만 보인다.
    - 칸 아래에 클라이언트 검증 메시지를 띄운다. 서버의 `errors`도 같은 자리에 매핑한다.
  - 상태
    - **만드는 중**: 버튼 문구가 "초안 만드는 중…"으로 바뀌고 모든 입력이 `disabled`다.
    - **created**: 입력을 비우고 `onCreated()`를 부른다.
    - **dropped**: 카드 안 빨간 박스에 `reasons`를 목록으로 보여주고 입력은 유지한다.
    - **duplicate**: "이 X 글로 만든 초안이 이미 있어"를 띄운다.
    - **네트워크 오류**: 토스트를 띄우고 입력은 유지한다.
  - 접근성
    - 모든 입력에 `<label htmlFor>`를 단다.
    - 세그먼트는 `role="radiogroup"`로 만든다.
    - `focus-visible:ring`을 단다.
    - 375px에서 세그먼트가 넘치면 `flex-wrap`으로 감싼다.
- [ ] **Step 3: Dashboard 수정**
  - 탭 라벨 "실시간 트렌드 뉴스"를 "소재"로 바꾼다. `autoTHREADS` 배지는 뺀다.
  - `activeTab === "news"`일 때 `<ManualReferenceCard>`를 `<NewsTrendingTab>` 위에 렌더한다.
  - `onCreated`는 `fetchPosts()` → `setReviewOnly(true)` → `setActiveTab("feed")` → `toast.success("레퍼런스 초안 1개, 승인 대기 중")` 순서로 실행한다.
- [ ] **Step 4: PostCard 라벨**
  - `qualityReasons`에 `"ref_replay_manual"`이 있고 `NEEDS_REVIEW`면 "승인 대기 (X 레퍼런스)"를 보여준다.
  - 다른 NEEDS_REVIEW 라벨은 그대로 둔다.
- [ ] **Step 5:** `pnpm typecheck && pnpm lint` → 에러 0
- [ ] **Step 6: 브라우저 확인** (dev 서버, preview 도구)
  - 소재 탭 카드: 데스크톱과 375px
  - 입력 오류, 만드는 중, 탈락, 중복, 성공 후 피드 탭의 "승인 대기 (X 레퍼런스)" 카드
  - 각각 스크린샷을 찍고, 콘솔 에러가 없는지 확인한다.
- [ ] **Step 7:** 커밋 `feat(dashboard): 소재 탭에 X 레퍼런스 입력 카드 추가`

### Task 7: 전체 검증과 PR

- [ ] **Step 1:** `pnpm typecheck && pnpm test && pnpm build` → 모두 통과
- [ ] **Step 2:** 스펙 7장 완료 기준 (a)~(h)를 하나씩 대응 테스트 이름과 짝지어 확인한다.
- [ ] **Step 3:** `git push -u origin feat/x-manual-reference` → main 대상 PR 생성 → Auto-fix 켜기 (머지는 사용자가 한다)
