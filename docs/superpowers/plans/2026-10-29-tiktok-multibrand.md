# TikTok 스튜디오 멀티브랜드화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사주가 아닌 브랜드도 TikTok 스튜디오에서 자기 productProfile 기반 대본(Claude, 키 없으면 템플릿)을 만들고, 사주 브랜드 결과는 그대로 둔다.

**Architecture:** `resolveTikTokEngine(slug, qualityProfile)`이 `"saju" | "product"`를 정한다. 사주는 기존 `generateTikTokScript` 그대로, 제품은 새 `product-script-engine.ts`가 문구(Claude JSON 또는 템플릿)를 받아 같은 4장면 `TikTokScriptResult`로 조립하고 자체 품질 게이트를 매긴다. API·페이지가 브랜드 설정으로 엔진을 고르고, 스튜디오 클라이언트는 엔진별 입력칸을 보여준다.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma, `@anthropic-ai/sdk`(설치됨), vitest.

**Spec:** `docs/superpowers/specs/2026-10-29-tiktok-multibrand-design.md`

## Global Constraints

- 패키지 매니저 npm. 새 의존성 없음. `any` 금지(`unknown` + 좁히기).
- 사주 브랜드(cosmicpath, cosmicpath-global) 대본·드래프트 필드가 한 글자도 바뀌면 안 됨. `src/lib/tiktok/tiktok-engine.test.ts`는 수정 없이 통과.
- 테스트에서 실제 Claude·DB 호출 금지. Claude는 `vi.mock("@anthropic-ai/sdk")`(패턴: `src/lib/viral-llm-analysis.test.ts:5-8`), 템플릿 경로는 `vi.stubEnv("ANTHROPIC_API_KEY", "")`.
- Claude 호출은 `src/lib/command-plan.ts:38-50` 패턴: `new Anthropic({ apiKey, timeout: 30_000, maxRetries: 1 })`, `model: CLAUDE_TEXT_MODEL`, `output_config: { format: { type: "json_schema", schema } }`, `readMessageText`.
- 커밋 메시지: conventional commits, 한국어 설명.
- 장면 길이 3.5 / 5.5 / 7 / 4초(합 20초). 훅 최대 길이 ko 30자 / en 64자.

## Review Focus

- Claude가 30자 넘는 훅이나 제품명 없는 답을 돌려줌 → 500이 아니라 `qualityPass: false` 드래프트로 저장 (Task 2 테스트)
- career_decision 브랜드 대본에 "사주"·"운세"가 섞임 → 게이트 실패 (Task 2 테스트)
- productProfile이 비어 `"Untitled Product"` → 브랜드 이름으로 대체 (Task 2 테스트)
- Claude가 JSON이 아닌 응답·refusal → 500 + 에러 메시지, 드래프트 생성 안 함 (Task 3 테스트)
- 제품 브랜드 요청에 `dayMaster`가 실려 옴 / `topic` 빈 값 → dayMaster 무시, 프리셋 `defaultTopics[0]` 사용 (Task 3 테스트)

---

### Task 1: 엔진 판정과 드래프트 저장값

**Files:**
- Modify: `src/lib/tiktok/tiktok-draft-service.ts` (타입·함수 추가, `buildTikTokDraftCreateData`에 인자 추가)
- Test: `src/lib/tiktok/tiktok-multibrand.test.ts` (새 파일)

**Interfaces:**
- Produces:
  - `export type TikTokEngine = "saju" | "product"`
  - `export function resolveTikTokEngine(brandSlug: string, qualityProfile: string): TikTokEngine` — `qualityProfile === "saju_viral" || brandSlug in NEW_YEAR_BRANDS` → `"saju"`
  - `buildTikTokDraftCreateData(brandId: string, script: TikTokScriptResult, status: string, engine: TikTokEngine = "saju")`

- [ ] **Step 1: 실패하는 테스트 작성** (`tiktok-multibrand.test.ts`)

```ts
describe("resolveTikTokEngine", () => {
  it("routes saju brands to the saju engine", () => {
    expect(resolveTikTokEngine("cosmicpath", "saju_viral")).toBe("saju");
    expect(resolveTikTokEngine("cosmicpath-global", "ecommerce_d2c")).toBe("saju");
  });
  it("routes every other brand to the product engine", () => {
    expect(resolveTikTokEngine("catchdex", "product_growth")).toBe("product");
    expect(resolveTikTokEngine("ulw-qa-demo-assets", "career_decision")).toBe("product");
  });
});
describe("buildTikTokDraftCreateData engine", () => {
  // script: generateTikTokScript({ topic: "사주" })
  it("keeps saju campaign values by default", () => { /* campaignId "saju_tiktok_campaign", qualityProfile "tiktok_saju_retention" */ });
  it("tags product drafts", () => { /* engine "product" → campaignId "product_tiktok_campaign", qualityProfile "tiktok_product_retention" */ });
});
```

- [ ] **Step 2:** `npx vitest run src/lib/tiktok/tiktok-multibrand.test.ts` → FAIL (`resolveTikTokEngine` 없음)
- [ ] **Step 3:** 위 Interfaces대로 구현. `NEW_YEAR_BRANDS`는 `@/lib/new-year/new-year-season`에서 import.
- [ ] **Step 4:** 같은 테스트 + `npx vitest run src/lib/tiktok/tiktok-engine.test.ts` → 모두 PASS
- [ ] **Step 5: 커밋**

```bash
git add src/lib/tiktok/tiktok-draft-service.ts src/lib/tiktok/tiktok-multibrand.test.ts
git commit -m "feat(tiktok): 브랜드별 대본 엔진 판정과 드래프트 캠페인 구분"
```

### Task 2: 제품 대본 엔진

**Files:**
- Create: `src/lib/tiktok/product-script-engine.ts`
- Modify: `src/lib/tiktok/tiktok-script-engine.ts` — `OVERPROMISE_PATTERN`, `HOOK_MAX_CHARS`, `ExplainerQuality`(이미 export)를 export만 추가. 사주 로직은 건드리지 않음.
- Test: `src/lib/tiktok/product-script-engine.test.ts`

**Interfaces:**
- Consumes: `TikTokScriptResult`, `TikTokSceneBeat`, `ScriptLang`, `ScriptGenerationParams["tone"]`, `OVERPROMISE_PATTERN`, `HOOK_MAX_CHARS` (tiktok-script-engine), `ProductProfile` (`@/types/brand`), `DomainPresetConfig` (`@/lib/domain-registry`), `CLAUDE_TEXT_MODEL`/`readMessageText` (`@/lib/claude-text`)
- Produces:
  - `export const SAJU_TERMS: readonly string[]` — 최소 `["사주", "일간", "명식", "대운", "운세", "saju", "day master"]`
  - `export interface ProductScriptParams { brandName: string; productProfile: ProductProfile; preset: Pick<DomainPresetConfig, "name" | "description" | "forbiddenCrossDomainTerms">; topic: string; tone?: "urgent" | "mysterious" | "encouraging"; lang?: ScriptLang }`
  - `export interface ProductScriptCopy { hookText: string; hookSpoken: string; answerSpoken: string; answerScreen: string; proofSpoken: string; proofScreen: string[]; ctaSpoken: string; ctaScreen: string; hashtags: string[] }`
  - `export function resolveProductName(brandName: string, profile: ProductProfile): string` — 빈 값·`"Untitled Product"`면 `brandName`
  - `export function buildProductCopyLocally(params: ProductScriptParams): ProductScriptCopy` — 결정적 템플릿. 훅은 `?`로 끝나고 ko 30자 이내(주제가 길면 대상 고객/제품 기반 짧은 질문으로), 답 음성에 제품명 포함, 빈 필드는 `preset.description`으로 대신
  - `export function assembleProductScript(copy: ProductScriptCopy, params: ProductScriptParams): TikTokScriptResult` — 4장면: `scene-01-hook` kinetic-card, `scene-02-answer` placeholder(`visualProps.hookText = answerScreen`), `scene-03-proof` kinetic-card, `scene-04-cta` kinetic-card(colorScheme `neon-yellow`). 훅 colorScheme은 tone `urgent`면 `fire-red` 아니면 `electric-purple`(사주와 같음). `cta = ctaScreen`, `formatId` 없음, 품질은 아래 함수
  - `export function evaluateProductQuality(script: Pick<TikTokScriptResult, "scenes" | "totalDurationSeconds">, productName: string, forbiddenTerms: readonly string[], lang?: ScriptLang): ExplainerQuality` — 항목: 훅 질문(`/이유|\?|why/i`), 훅 ≤ `HOOK_MAX_CHARS[lang]`, 2번 장면 spokenLine에 productName, `OVERPROMISE_PATTERN` 없음, 금지어(대소문자 무시) 없음, 15~30초
  - `export async function generateProductScript(params: ProductScriptParams): Promise<TikTokScriptResult>` — `ANTHROPIC_API_KEY` 있으면 Claude JSON(스키마 = ProductScriptCopy 필드, `additionalProperties: false`), 없으면 템플릿. 금지어 = `[...preset.forbiddenCrossDomainTerms, ...SAJU_TERMS]`를 프롬프트와 게이트에 같이 사용. 응답이 객체가 아니거나 필드 타입이 틀리면 `throw new Error("대본 응답을 읽을 수 없습니다")`

- [ ] **Step 1: 실패하는 테스트 작성** — `CATCHDEX` 고정값: `productName: "Catchdex"`, `targetCustomer: "1인 메이커"`, `offerPromise: "반복 업무 자동화"`, preset = `getDomainPreset("product_growth")`

```ts
it("builds a 4-scene product script without the API key", async () => {
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  const script = await generateProductScript({ brandName: "catchdex", productProfile: CATCHDEX, preset, topic: preset.defaultTopics[0] });
  expect(script.scenes.map((s) => s.type)).toEqual(["kinetic-card", "placeholder", "kinetic-card", "kinetic-card"]);
  expect(script.totalDurationSeconds).toBe(20);
  expect(script.scenes[1].spokenLine).toContain("Catchdex");
  expect(script.fullScript).not.toMatch(/사주|일간|명식/);
  expect(script.qualityPass).toBe(true);
  expect(messagesCreate).not.toHaveBeenCalled();
});
it("uses Claude copy when the key is set", async () => { /* stubEnv key "test"; messagesCreate → { content: [{ type: "text", text: JSON.stringify(validCopy) }], stop_reason: "end_turn" }; expect scenes[0].onScreenText[0] === validCopy.hookText; prompt (calls[0][0].messages[0].content) contains "Catchdex" and "사주" (as forbidden) */ });
it("fails the gate instead of throwing on weak Claude copy", async () => { /* hookText 31자+, answerSpoken without product name → resolves, qualityPass false, qualityReasons length >= 2 */ });
it("fails the gate when saju terms leak into a career brand script", () => { /* evaluateProductQuality with a scene containing "운세" and forbidden [...career preset terms, ...SAJU_TERMS] → qualityPass false */ });
it("falls back to the brand name for an empty product profile", () => { /* resolveProductName("catchdex", normalizeProductProfile({})) === "catchdex" */ });
it("rejects a malformed Claude response", async () => { /* text "not json" → rejects */ });
```

- [ ] **Step 2:** `npx vitest run src/lib/tiktok/product-script-engine.test.ts` → FAIL (모듈 없음)
- [ ] **Step 3:** Interfaces대로 구현. 프롬프트(ko/en 언어 지시 포함)에는 제품명·한 줄 설명·대상 고객·약속·포지셔닝(빈 값 생략), 프리셋 이름·설명, 주제, 톤, 금지어, 4장면 역할(훅=대상 고객 문제를 "왜?"로 묻는 질문 30자 이내 / 답=제품명 포함 / 근거=약속 1가지 / CTA=프로필 링크)을 넣는다.
- [ ] **Step 4:** 새 테스트 + `tiktok-engine.test.ts` → PASS
- [ ] **Step 5: 커밋**

```bash
git add src/lib/tiktok/product-script-engine.ts src/lib/tiktok/product-script-engine.test.ts src/lib/tiktok/tiktok-script-engine.ts
git commit -m "feat(tiktok): productProfile 기반 제품 숏폼 대본 엔진 추가"
```

### Task 3: 생성 API 라우팅

**Files:**
- Modify: `src/app/api/tiktok/generate/route.ts`
- Test: `src/app/api/tiktok/tiktok-routes.test.ts` (기존 생성 테스트 픽스처에 `slug: "cosmicpath"`, `brandConfig: "{}"`만 추가 — mock 브랜드가 실제 Brand 모양을 갖추게 하는 것이고 기대값은 그대로)

**Interfaces:**
- Consumes: `resolveTikTokEngine`, `buildTikTokDraftCreateData(..., engine)` (Task 1), `generateProductScript` (Task 2), `parseBrandConfig` (`@/types/brand`), `getDomainPreset` (`@/lib/domain-registry`)

- [ ] **Step 1: 실패하는 테스트 작성** — `requireBrandForCurrentUser` mock이 돌려주는 brand에 slug/brandConfig를 지정하는 헬퍼

```ts
it("generates a product script for a product_growth brand", async () => {
  // brand: { id: "b-cd", name: "Catchdex", slug: "catchdex", brandConfig: JSON.stringify({ qualityProfile: "product_growth", productProfile: { productName: "Catchdex" } }) }
  // ANTHROPIC_API_KEY "" ; body { brandId, dayMaster: "갑목", topic: "" }
  // expect 200; scriptResult.scenes[1].spokenLine contains "Catchdex"; no scene type "saju-card";
  // create called with data.campaignId "product_tiktok_campaign"; title not contains "갑목"
});
it("keeps cosmicpath-global on the English saju script", async () => {
  // brand slug "cosmicpath-global", brandConfig qualityProfile "ecommerce_d2c"; body dayMaster "갑목"
  // expect scriptResult equal to generateTikTokScript({ topic: "사주 대운 분석", dayMaster: "갑목", tone: "mysterious", lang: "en" })
});
it("returns 500 and saves nothing when Claude returns garbage", async () => { /* key set, messagesCreate → text "nope"; expect 500, tikTokVideoDraft.create not called */ });
```

- [ ] **Step 2:** `npx vitest run src/app/api/tiktok/tiktok-routes.test.ts` → 새 테스트 FAIL
- [ ] **Step 3:** 라우트: `const config = parseBrandConfig(brand.brandConfig)`, `engine = resolveTikTokEngine(brand.slug, config.qualityProfile)`. 사주 분기는 기존 `generateTikTokScript` 호출 그대로. 제품 분기: `preset = getDomainPreset(config.qualityProfile)`, `await generateProductScript({ brandName: brand.name, productProfile: config.productProfile, preset, topic: topic || preset.defaultTopics[0] || brand.name, tone: tone || "mysterious", lang: brandVideoLang(brand.slug) })`. 저장 시 `buildTikTokDraftCreateData(brand.id, scriptResult, "DRAFT", engine)`.
- [ ] **Step 4:** 라우트 테스트 + Task 1·2 테스트 → PASS
- [ ] **Step 5: 커밋**

```bash
git add src/app/api/tiktok/generate/route.ts src/app/api/tiktok/tiktok-routes.test.ts
git commit -m "feat(tiktok): 생성 API가 브랜드 설정으로 대본 엔진을 고르게 변경"
```

### Task 4: 스튜디오 화면

**Files:**
- Modify: `src/app/brands/[slug]/tiktok/page.tsx`, `src/components/tiktok/TikTokStudioClient.tsx`
- Test: `src/app/brands/[slug]/tiktok/page.test.ts` (props 확인 테스트 1개 추가)

**Interfaces:**
- Consumes: `resolveTikTokEngine`, `resolveProductName`, `parseBrandConfig`, `getDomainPreset`
- Produces: `TikTokStudioClientProps`에 `engine: TikTokEngine; productName: string; suggestedTopics: string[]` 추가 (사주 브랜드는 `productName: ""`, `suggestedTopics: []`)

- [ ] **Step 1: 실패하는 테스트 작성** — client mock을 `vi.fn(() => null)`로 바꾸고 반환된 element의 props 확인

```ts
it("passes the product engine and preset topics for a product brand", async () => {
  // makeBrand with slug "catchdex", brandConfig qualityProfile product_growth, productProfile.productName "Catchdex"
  // const el = await renderPage(); expect(el.props).toMatchObject({ engine: "product", productName: "Catchdex" }); expect(el.props.suggestedTopics[0]).toBe(getDomainPreset("product_growth").defaultTopics[0])
});
```

- [ ] **Step 2:** `npx vitest run 'src/app/brands/[slug]/tiktok/page.test.ts'` → FAIL
- [ ] **Step 3:** page.tsx에서 위 props 계산. 클라이언트: `engine === "saju"`면 현재 마크업·기본값·문구 그대로. `"product"`면 일간 `<select>` 자리에 제품명 표시(읽기 전용), 주제 기본값 `suggestedTopics[0] ?? ""`, 주제 input에 `list` + `<datalist>`(suggestedTopics), 헤더 설명 "제품 카드뉴스 숏폼을 순수 React 코드로 자동 렌더링합니다.", 섹션 제목 "숏폼 기획", 빈 상태 안내에서 "일주와" 제거, 생성 요청 body에 dayMaster 안 보냄. 입력·버튼에 보이는 focus 스타일 유지.
- [ ] **Step 4:** 테스트 PASS, 그다음 개발 서버로 `/brands/catchdex/tiktok`, `/brands/cosmicpath/tiktok`을 데스크톱·375px로 스크린샷. 사주 화면이 변경 전과 같은지, 제품 화면에 사주 단어가 없는지, 생성 버튼 → 4장면 스토리보드가 뜨는지 확인.
- [ ] **Step 5: 커밋**

```bash
git add 'src/app/brands/[slug]/tiktok/page.tsx' 'src/app/brands/[slug]/tiktok/page.test.ts' src/components/tiktok/TikTokStudioClient.tsx
git commit -m "feat(tiktok): 스튜디오 입력칸을 브랜드 엔진에 맞게 분기"
```

### Task 5: 전체 검증

- [ ] `npm run typecheck` → 에러 0
- [ ] `npm test` → 전부 PASS (`tiktok-engine.test.ts` 무수정 확인: `git diff origin/main -- src/lib/tiktok/tiktok-engine.test.ts` 비어 있음)
- [ ] `npm run lint` → 새 경고 없음
- [ ] `npm run build` → 성공
- [ ] 설계·계획 문서 커밋: `git add docs/superpowers/specs/2026-10-29-tiktok-multibrand-design.md docs/superpowers/plans/2026-10-29-tiktok-multibrand.md && git commit -m "docs(tiktok): 멀티브랜드 스튜디오 설계와 계획"`
- [ ] push는 사용자 승인 후
