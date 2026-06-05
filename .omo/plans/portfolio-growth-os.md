# Portfolio Growth OS Plan

## TL;DR
> **Summary**: Convert `threads-uploader` from a CosmicPath-flavored Threads/TikTok tool into an internal Portfolio Growth OS for the user's own products. Keep the existing `Brand` database model as the product container, but add product/experiment semantics, test infrastructure, generalized quality/config registries, and clearer daily growth workflow.
> **Deliverables**:
> - Internal product profile config for each owned product
> - Generalized active experiment model and metrics framing
> - Product-safe quality profile registry
> - Fixed QA seed records, empty-state fixtures, and dev-server harness
> - Portfolio-facing UI copy and settings flow
> - Tests + manual QA evidence for all changed surfaces
> **Effort**: Medium
> **Parallel**: YES - 5 waves
> **Critical Path**: Task 1 -> Task 2 -> Task 3 -> Task 4 -> Task 7 -> Task 9 -> Task 8 -> Task 11 -> Final Verification

## Context
### Original Request
- User asked to run `omo:ulw-plan`.
- User clarified this is not for other people to use; it is an internal marketing tool for promoting the user's own products.
- User clarified it should support multiple products, not only CosmicPath.

### Interview Summary
- No extra user question is required. Use defaults:
  - Product name: `Portfolio Growth OS`
  - Keep `Brand` as the DB model name; use `Product`/`Portfolio` in UI and docs
  - Seed CosmicPath as the first product profile
  - Do not require the second product name before implementation
  - Preserve Threads and TikTok surfaces, but do not add new channel automation yet

### Metis Review (gaps addressed)
- Metis was spawned twice but did not return substantive output before timeout. Manual gap classification:
  - Risk: scope creep into public SaaS. Guardrail: no billing, public onboarding, or external-tenant polish.
  - Risk: CosmicPath leakage into every product. Guardrail: move CosmicPath defaults into a preset/registry path.
  - Risk: no test baseline. Guardrail: first implementation task adds Vitest and requires RED-GREEN for every production change.
  - Risk: dense dashboard grows harder to use. Guardrail: add a product overview and keep advanced panels collapsible.
  - Risk: experiment data remains vanity-only. Guardrail: every active experiment has one primary metric and one conversion-facing metric.

## Work Objectives
### Core Objective
Turn the current multi-brand Threads/TikTok marketing app into an internal portfolio marketing OS where each user-owned product has its own positioning, campaign, quality gate, channel settings, UTM tracking, and learning loop.

### Deliverables
- `BrandConfig` extension for product profile and active experiment metadata
- Registry for product presets and quality profiles
- Settings UI for product profile and experiment metric fields
- Portfolio-facing rename in metadata, brand list, login, and dashboard copy
- Generation prompt changes that use product profile context and prevent CosmicPath defaults from leaking
- Product dashboard summary for active experiment status and next action
- Fixed QA seed/dev-server harness for browser, HTTP, and empty-state verification
- Test infrastructure and focused tests
- Updated docs/API spec/screen flow

### Definition of Done (verifiable conditions with commands)
- `npm run test` exits 0 and includes RED-GREEN proof in `.omo/evidence/`
- `npm run typecheck` exits 0
- `npm run lint` exits 0
- `npm run build` exits 0
- Browser QA against `http://127.0.0.1:3107` shows `/brands` as `Portfolio Growth OS` and "Product" language, not "Threads Uploader" or SaaS onboarding copy
- HTTP QA proves product config create/update/read works through `/api/brands`
- HTTP QA proves `/api/generate` uses product-specific config and still rejects missing prompt/topics/formulas

### Must Have
- Internal-only portfolio framing
- Existing auth and brand ownership boundaries preserved
- CosmicPath remains usable as a seed product
- A second generic product can be configured without code changes
- Tests written before production changes in each implementation task
- Manual QA evidence captured per task

### Must NOT Have
- No public SaaS billing/pricing/subscriptions
- No automatic TikTok upload
- No scraping or private platform data collection
- No auto-replies, DMs, follows, likes
- No new root DB entity unless a task proves JSON config cannot satisfy the acceptance criteria
- No `as any`, `@ts-ignore`, or skipped tests

## Verification Strategy
> ZERO HUMAN INTERVENTION - all verification is agent-executed.
- Test decision: TDD with Vitest added first; Playwright/browser QA for user-facing surfaces; HTTP `curl` for API surfaces.
- QA policy: Every task has agent-executed scenarios.
- Evidence: `.omo/evidence/task-{N}-{slug}.{ext}`
- Fixed QA seed contract:
  - User id: `ulw_qa_user_portfolio`
  - User email: `ulw-qa@example.test`
  - Cookie header: `Cookie: auth_session=ulw_qa_user_portfolio`
  - Browser auth setup: before any authenticated browser scenario, add a host cookie for `127.0.0.1` with `name=auth_session`, `path=/`, and `sameSite=Lax`; use `value=ulw_qa_user_portfolio` for main-product scenarios and `value=ulw_qa_user_empty_portfolio` for empty-portfolio scenarios. No password login is required for QA because the app reads the user id from this cookie.
  - Empty portfolio user id: `ulw_qa_user_empty_portfolio`
  - Empty portfolio cookie header: `Cookie: auth_session=ulw_qa_user_empty_portfolio`
  - Primary product id: `ulw_qa_product_cosmicpath`
  - Primary product slug: `ulw-qa-cosmicpath`
  - Missing-prompt product id: `ulw_qa_product_missing_prompt`
  - No-posts product id: `ulw_qa_product_no_posts`
  - No-posts product slug: `ulw-qa-no-posts`
  - Unknown campaign id: `missing_campaign`
- Shared browser/HTTP QA server contract:
  - Start command: `npm run dev -- --hostname 127.0.0.1 --port 3107`
  - Base URL: `http://127.0.0.1:3107`
  - Evidence: `.omo/evidence/shared-dev-server.txt`

## Execution Strategy
### Parallel Execution Waves
> Target: 5-8 tasks per wave. This plan has fewer tasks because the product is a medium brownfield transition; waves are still separated by dependency.

Wave 1: Task 1, Task 2
Wave 2: Task 3, Task 4
Wave 3: Task 5, Task 6, Task 7, Task 9
Wave 4: Task 8, Task 10
Wave 5: Task 11

### Dependency Matrix (full, all tasks)
| Task | Depends On | Blocks |
| --- | --- | --- |
| 1 | none | 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 |
| 2 | 1 | 3, 4, 5, 7, 8, 9, 10, 11 |
| 3 | 1, 2 | 5, 6, 7, 8, 9, 10, 11 |
| 4 | 1, 2 | 7, 9, 11 |
| 5 | 1, 2, 3 | 8, 10, 11 |
| 6 | 1, 3 | 10, 11 |
| 7 | 1, 2, 3, 4 | 9, 11 |
| 8 | 1, 2, 3, 5, 9 | 11 |
| 9 | 1, 2, 3, 4, 7 | 8, 11 |
| 10 | 1, 2, 3, 5, 6, 8 | 11 |
| 11 | 1-10 | Final Verification |

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: References + Acceptance Criteria + QA Scenarios.

- [ ] 1. Add Minimal Test Infrastructure

  **What to do**: Add Vitest as the project test runner with TypeScript support and `npm run test`. Keep this task limited to the test harness plus passing tests for existing pure logic, so later product-profile RED/GREEN work remains owned by Task 2.
  **Must NOT do**: Do not add Playwright yet. Do not rewrite package management. Do not change production behavior in this task except code necessary to expose pure functions for testing if a test proves it is needed.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 | Blocked By: none

  **References**:
  - Pattern: `package.json:5` - current scripts contain `build`, `lint`, `typecheck`, but no `test`.
  - Pattern: `src/lib/growth-learning.ts:30` - pure performance scoring is a safe first unit-test target.
  - Pattern: `src/types/brand.ts:270` - `parseBrandConfig` is the primary future config normalization test target.
  - Skill: `testing-strategy` - use Vitest for pure utils and API-adjacent logic.

  **Automated Tests**:
  - `src/lib/growth-learning.test.ts > calculatePerformanceScore > weights views, replies, reposts, clicks, conversions, and paid conversions`
  - `src/types/brand.test.ts > parseBrandConfig > preserves existing campaign, quality profile, and TikTok defaults`

  **Acceptance Criteria**:
  - [ ] `package.json` includes `test` script that runs Vitest once.
  - [ ] RED evidence captures the current missing `npm run test` script or failing harness before Vitest setup.
  - [ ] `npm run test` passes GREEN after adding only the minimum test harness and existing-logic tests.
  - [ ] No product-profile default expectations are added in Task 1; those belong to Task 2.
  - [ ] `npm run typecheck` passes.

  **QA Scenarios**:
  ```
  Scenario: Test command is runnable
    Tool: bash / Codex exec_command
    Steps: cd /Users/kim-young-gwang/Desktop/projects/threads-uploader && npm run test
    Expected: output includes Vitest summary and exits 0
    Evidence: .omo/evidence/task-1-test-command.txt

  Scenario: Typecheck still passes
    Tool: bash / Codex exec_command
    Steps: cd /Users/kim-young-gwang/Desktop/projects/threads-uploader && npm run typecheck
    Expected: output includes `tsc --noEmit` and no TypeScript errors
    Evidence: .omo/evidence/task-1-typecheck.txt
  ```

  **Commit**: YES | Message: `test(portfolio): add growth OS test baseline` | Files: `package.json`, optional lockfile, `vitest.config.ts`, `src/**/*.test.ts`

- [ ] 2. Add Product Profile And Experiment Contracts To BrandConfig

  **What to do**: Extend `BrandConfig` with `productProfile` and `activeExperiment` fields. Keep backward compatibility in `parseBrandConfig`. Required product profile fields: `productName`, `oneLineDescription`, `targetCustomer`, `offerPromise`, `landingUrl`, `primaryChannel`, `primaryMetric`, `conversionMetric`, `positioningNotes`. Required active experiment fields: `id`, `name`, `hypothesis`, `stage`, `startedAt`, `durationDays`, `primaryMetric`, `guardrailMetric`, `status`. Default CosmicPath values must be moved into a named seed preset, not scattered through UI copy.
  **Must NOT do**: Do not add a new Prisma model. Do not rename the `Brand` database model. Do not remove existing fields such as `topics`, `formulas`, `campaigns`, or `tiktokVideo`.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 3, 4, 5, 7, 8, 9, 10, 11 | Blocked By: 1

  **References**:
  - API/Type: `src/types/brand.ts:87` - current `BrandConfig` extension point.
  - Pattern: `src/types/brand.ts:138` - current CosmicPath campaign seed to preserve.
  - Pattern: `src/types/brand.ts:218` - default config should add product profile defaults.
  - Data: `prisma/schema.prisma:20` - keep `Brand.brandConfig` JSON storage.

  **Automated Tests**:
  - `src/types/brand.test.ts > parseBrandConfig > normalizes empty config to product profile and active experiment`
  - `src/types/brand.test.ts > parseBrandConfig > preserves CosmicPath campaign defaults`
  - `src/types/brand.test.ts > parseBrandConfig > normalizes malformed product profile safely`

  **Acceptance Criteria**:
  - [ ] A RED test proves `parseBrandConfig("{}")` returns product profile defaults.
  - [ ] GREEN test proves existing CosmicPath campaign defaults remain present.
  - [ ] GREEN test proves unknown/malformed product profile fields normalize to safe strings/defaults.
  - [ ] `npm run test -- brand` passes.

  **QA Scenarios**:
  ```
  Scenario: Empty config normalizes to internal product profile
    Tool: bash / Codex exec_command
    Steps: cd /Users/kim-young-gwang/Desktop/projects/threads-uploader && npm run test -- brand
    Expected: output includes product profile default test PASS
    Evidence: .omo/evidence/task-2-product-config.txt

  Scenario: Malformed profile does not break config parsing
    Tool: bash / Codex exec_command
    Steps: cd /Users/kim-young-gwang/Desktop/projects/threads-uploader && npm run test -- brand
    Expected: test passes and normalized config has string defaults plus existing campaigns
    Evidence: .omo/evidence/task-2-malformed-config.txt
  ```

  **Commit**: YES | Message: `feat(portfolio): add product profile contracts` | Files: `src/types/brand.ts`, tests

- [ ] 3. Add Shared QA Seed And Dev Server Harness

  **What to do**: Add a non-destructive QA setup harness that creates fixed local QA records for browser/HTTP scenarios and documents how to start the dev server on port `3107`. The harness must support `--dry-run` and `--apply`. The fixed QA records are `ulw_qa_user_portfolio`, `ulw_qa_user_empty_portfolio`, `ulw_qa_product_cosmicpath`, `ulw_qa_product_missing_prompt`, and `ulw_qa_product_no_posts`.
  **Must NOT do**: Do not run this seed automatically in `postinstall`. Do not overwrite real product records. Do not require production credentials. Do not bind to port `3000`.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 5, 6, 7, 8, 9, 10, 11 | Blocked By: 1, 2

  **References**:
  - Data: `prisma/schema.prisma:11` - user record shape for QA user.
  - Data: `prisma/schema.prisma:20` - brand/product record shape for QA products.
  - Pattern: `src/app/api/brands/route.ts:66` - expected brand create fields.
  - Pattern: `src/types/brand.ts:218` - default product config to seed safely.

  **Automated Tests**:
  - `scripts/qa/seed-portfolio-growth-os.test.ts > dry run > prints fixed QA user and product ids without DB writes`
  - `scripts/qa/seed-portfolio-growth-os.test.ts > apply > upserts QA users and products idempotently against test database`

  **Acceptance Criteria**:
  - [ ] `node scripts/qa/seed-portfolio-growth-os.mjs --dry-run` exits 0 and prints fixed QA user/product ids.
  - [ ] `node scripts/qa/seed-portfolio-growth-os.mjs --apply` creates or updates only fixed QA records.
  - [ ] `.omo/evidence/task-3-qa-seed-apply.txt` proves the fixed QA records exist before any later browser/HTTP scenario.
  - [ ] `.omo/evidence/shared-dev-server.txt` records the exact dev-server command and readiness line.
  - [ ] All later browser/HTTP scenarios use `http://127.0.0.1:3107`.
  - [ ] All later authenticated browser scenarios explicitly set the appropriate fixed `auth_session` cookie before navigation.

  **QA Scenarios**:
  ```
  Scenario: QA seed dry-run is non-destructive
    Tool: bash / Codex exec_command
    Steps: cd /Users/kim-young-gwang/Desktop/projects/threads-uploader && node scripts/qa/seed-portfolio-growth-os.mjs --dry-run
    Expected: stdout lists `ulw_qa_user_portfolio`, `ulw_qa_user_empty_portfolio`, `ulw_qa_product_cosmicpath`, `ulw_qa_product_missing_prompt`, `ulw_qa_product_no_posts`, and `no database writes`
    Evidence: .omo/evidence/task-3-qa-seed-dry-run.txt

  Scenario: QA seed apply creates fixed auth and product records
    Tool: bash / Codex exec_command
    Steps: cd /Users/kim-young-gwang/Desktop/projects/threads-uploader && node scripts/qa/seed-portfolio-growth-os.mjs --apply
    Expected: stdout confirms upserted `ulw_qa_user_portfolio`, `ulw_qa_user_empty_portfolio`, `ulw_qa_product_cosmicpath`, `ulw_qa_product_missing_prompt`, and `ulw_qa_product_no_posts`; no non-QA records are changed
    Evidence: .omo/evidence/task-3-qa-seed-apply.txt

  Scenario: Dev server starts on fixed QA port
    Tool: bash / Codex exec_command
    Steps: cd /Users/kim-young-gwang/Desktop/projects/threads-uploader && npm run dev -- --hostname 127.0.0.1 --port 3107
    Expected: stdout includes `http://127.0.0.1:3107` and `Ready`
    Evidence: .omo/evidence/shared-dev-server.txt

  Scenario: Browser auth cookie reaches seeded product list
    Tool: browser use
    Steps: set browser cookie `auth_session=ulw_qa_user_portfolio` for `127.0.0.1`, open http://127.0.0.1:3107/brands
    Expected: browser is not redirected to `/login` and the seeded `ulw-qa-cosmicpath` product is visible
    Evidence: .omo/evidence/task-3-browser-auth-cookie.png and .omo/evidence/task-3-browser-auth-cookie-log.txt
  ```

  **Commit**: YES | Message: `test(portfolio): add qa seed harness` | Files: `scripts/qa/seed-portfolio-growth-os.mjs`, tests, optional README QA note

- [ ] 4. Create Quality Profile Registry Without CosmicPath Leakage

  **What to do**: Refactor quality profile handling into a registry that keeps `saju_viral`, `career_decision`, and `tiktok_career_timing` available while allowing future products to register new quality profiles by configuration/name. Add a generic `product_growth` profile that checks first-line hook presence, product/category relevance, CTA presence, and generic filler rejection using product profile keywords.
  **Must NOT do**: Do not weaken existing `saju_viral` or `career_decision` gates. Do not make every product require 사주/CosmicPath terms.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 7, 9, 11 | Blocked By: 1, 2

  **References**:
  - Pattern: `src/lib/quality-gate.ts:147` - current profile switch.
  - Pattern: `src/lib/quality-gate.ts:152` - `saju_viral` behavior to preserve.
  - Pattern: `src/lib/quality-gate.ts:184` - `career_decision` behavior to preserve.
  - API/Type: `src/types/brand.ts:19` - extend `QualityProfileId` carefully.

  **Automated Tests**:
  - `src/lib/quality-gate.test.ts > saju_viral > preserves existing pass and fail fixtures`
  - `src/lib/quality-gate.test.ts > career_decision > preserves existing pass and fail fixtures`
  - `src/lib/quality-gate.test.ts > product_growth > passes non-CosmicPath product content and rejects filler`

  **Acceptance Criteria**:
  - [ ] RED test proves a non-CosmicPath product post currently fails or cannot use product-specific quality criteria.
  - [ ] GREEN tests prove `saju_viral` and `career_decision` outputs are unchanged for representative passing/failing samples.
  - [ ] GREEN test proves `product_growth` can pass a second-product sample without 사주/CosmicPath language.
  - [ ] `npm run test -- quality` passes.

  **QA Scenarios**:
  ```
  Scenario: Existing CosmicPath quality gates remain stable
    Tool: bash / Codex exec_command
    Steps: cd /Users/kim-young-gwang/Desktop/projects/threads-uploader && npm run test -- quality
    Expected: saju and career fixture tests PASS
    Evidence: .omo/evidence/task-4-existing-quality.txt

  Scenario: Generic product quality gate rejects filler
    Tool: bash / Codex exec_command
    Steps: cd /Users/kim-young-gwang/Desktop/projects/threads-uploader && npm run test -- quality
    Expected: test PASS shows reject reason contains generic/filler language
    Evidence: .omo/evidence/task-4-generic-reject.txt
  ```

  **Commit**: YES | Message: `feat(portfolio): generalize quality profiles` | Files: `src/types/brand.ts`, `src/lib/quality-gate.ts`, tests

- [ ] 5. Add Product Profile Fields To Settings UI

  **What to do**: Add a `Product` tab or rename the existing `basic/ai` grouping so the user can edit product profile and active experiment fields. Persist fields through the existing `PATCH /api/brands/[id]` payload. Use Korean labels aligned with internal use: 제품명, 한 줄 설명, 타깃 고객, 오퍼 약속, 랜딩 URL, 주요 채널, 핵심 지표, 전환 지표, 현재 실험, 가설, 가드레일. Preserve existing Threads token fields but visually separate them as channel credentials.
  **Must NOT do**: Do not ask for billing or public onboarding details. Do not remove current campaign/topic/formula editing.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: 8, 10, 11 | Blocked By: 1, 2, 3

  **References**:
  - Pattern: `src/components/BrandSettingsForm.tsx:31` - settings component state pattern.
  - Pattern: `src/components/BrandSettingsForm.tsx:82` - save handler payload construction.
  - Pattern: `src/components/BrandSettingsForm.tsx:129` - tab registration pattern.
  - Pattern: `src/components/BrandSettingsForm.tsx:203` - content section rendering pattern.

  **Automated Tests**:
  - `src/components/BrandSettingsForm.test.tsx > product profile > renders editable product and experiment fields`
  - `src/components/BrandSettingsForm.test.tsx > product profile > save payload includes productProfile and activeExperiment`

  **Acceptance Criteria**:
  - [ ] RED UI/unit test proves product profile fields are missing from settings state/render.
  - [ ] GREEN test proves editing product profile fields updates the saved `brandConfig` payload.
  - [ ] Existing campaign/topics/formulas tabs still render.
  - [ ] `npm run typecheck` passes.

  **QA Scenarios**:
  ```
  Scenario: Product profile is editable in settings
    Tool: browser use
    Steps: set browser cookie `auth_session=ulw_qa_user_portfolio` for `127.0.0.1`, open http://127.0.0.1:3107/brands/ulw-qa-cosmicpath/settings, click Product tab, fill `제품명=CosmicPath`, `타깃 고객=20-35 커리어 고민 여성`, save
    Expected: success toast appears and refresh preserves entered values
    Evidence: .omo/evidence/task-5-product-settings.png and .omo/evidence/task-5-product-settings-log.txt

  Scenario: Channel credentials stay separate
    Tool: browser use
    Steps: with browser cookie `auth_session=ulw_qa_user_portfolio` still set, open same settings page, inspect basic/channel credential area
    Expected: Threads token fields are still present but not mixed with product positioning fields
    Evidence: .omo/evidence/task-5-channel-credentials.png
  ```

  **Commit**: YES | Message: `feat(portfolio): add product settings fields` | Files: `src/components/BrandSettingsForm.tsx`, tests

- [ ] 6. Rebrand App Shell From Threads Uploader To Portfolio Growth OS

  **What to do**: Update metadata, login, brand list, empty state, dashboard header, and settings copy so the app reads as internal Portfolio Growth OS. Use "Product" or "제품" where the user is selecting a product. Keep route names and DB names unchanged for minimal churn.
  **Must NOT do**: Do not redesign the whole UI. Do not introduce landing-page marketing copy. Do not change auth/session behavior.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: 10, 11 | Blocked By: 1, 3

  **References**:
  - Pattern: `src/app/layout.tsx:15` - currently still `Create Next App`.
  - Pattern: `src/app/brands/page.tsx:52` - current `Threads Uploader` heading.
  - Pattern: `src/app/brands/page.tsx:86` - empty state copy.
  - Pattern: `src/components/BrandSettingsForm.tsx:161` - settings header copy.

  **Automated Tests**:
  - `src/app/layout.test.ts > metadata > title is Portfolio Growth OS`
  - `src/app/brands/page.test.tsx > copy > renders product portfolio language`
  - `src/app/login/page.test.tsx > copy > renders Portfolio Growth OS`

  **Acceptance Criteria**:
  - [ ] RED test or snapshot proves old metadata/copy exists.
  - [ ] GREEN test proves metadata title is `Portfolio Growth OS`.
  - [ ] Browser QA shows `/login` and `/brands` do not show `Create Next App`.
  - [ ] Browser QA shows product portfolio language on `/brands`.

  **QA Scenarios**:
  ```
  Scenario: Login and product list use Portfolio Growth OS language
    Tool: browser use
    Steps: open http://127.0.0.1:3107/login, record title and visible heading; then open /brands while unauthenticated and confirm redirect keeps app title
    Expected: page title or visible heading includes `Portfolio Growth OS`; no `Create Next App`
    Evidence: .omo/evidence/task-6-login-rebrand.png and .omo/evidence/task-6-login-rebrand-log.txt

  Scenario: Product list empty state is internal portfolio-oriented
    Tool: browser use
    Steps: set browser cookie `auth_session=ulw_qa_user_empty_portfolio` for `127.0.0.1`, open http://127.0.0.1:3107/brands
    Expected: copy says first product/marketing experiment, not first brand/Threads automation
    Evidence: .omo/evidence/task-6-empty-products.png
  ```

  **Commit**: YES | Message: `refactor(ui): rebrand app as portfolio growth os` | Files: `src/app/layout.tsx`, `src/app/login/page.tsx`, `src/app/brands/page.tsx`, `src/components/Dashboard.tsx`, `src/components/BrandSettingsForm.tsx`, tests

- [ ] 7. Update Generation Pipeline To Use Product Profile Context

  **What to do**: Inject product profile and active experiment context into the generation prompt. Make the generation path use active campaign + product profile + quality profile rather than CosmicPath-specific assumptions. Preserve existing error behavior for missing brandId, missing formulas, missing system prompt, missing topics, and invalid count. Keep campaign UTM generation intact.
  **Must NOT do**: Do not call Anthropic in tests. Mock/stub `client.messages.create` or extract pure prompt builders. Do not change publish behavior in this task.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: 9, 11 | Blocked By: 1, 2, 3, 4

  **References**:
  - Pattern: `src/app/api/generate/route.ts:182` - prompt construction seam.
  - Pattern: `src/app/api/generate/route.ts:210` - current campaign prompt injection.
  - Pattern: `src/app/api/generate/route.ts:277` - route input and validation.
  - Pattern: `src/app/api/generate/route.ts:383` - UTM link update behavior to preserve.

  **Automated Tests**:
  - `src/app/api/generate/route.test.ts > prompt > includes product profile and active experiment context`
  - `src/app/api/generate/route.test.ts > validation > preserves missing prompt/topics/formulas errors`
  - `src/app/api/generate/route.test.ts > campaign links > preserves UTM fields`

  **Acceptance Criteria**:
  - [ ] RED test proves current prompt does not include product profile fields.
  - [ ] GREEN test proves prompt includes product name, target customer, offer promise, primary metric, active experiment hypothesis, and guardrail.
  - [ ] GREEN test proves missing topics/formulas/system prompt error messages remain unchanged.
  - [ ] GREEN test proves UTM `utm_source`, `utm_campaign`, and `utm_content` behavior is unchanged for campaign posts.

  **QA Scenarios**:
  ```
  Scenario: Generate rejects incomplete product config
    Tool: HTTP call
    Steps: curl -i -X POST http://127.0.0.1:3107/api/generate -H 'Content-Type: application/json' -H 'Cookie: auth_session=ulw_qa_user_portfolio' -d '{"brandId":"ulw_qa_product_missing_prompt","count":1}'
    Expected: HTTP 400 and body contains `브랜드에 시스템 프롬프트가 설정되지 않았습니다.`
    Evidence: .omo/evidence/task-7-generate-missing-prompt.http

  Scenario: Generate creates product-specific campaign posts
    Tool: HTTP call
    Steps: curl -i -X POST http://127.0.0.1:3107/api/generate -H 'Content-Type: application/json' -H 'Cookie: auth_session=ulw_qa_user_portfolio' -d '{"brandId":"ulw_qa_product_cosmicpath","count":3}'
    Expected: HTTP 200 body includes `"success":true`, `"count":3`, and `"campaignId"` for active experiment
    Evidence: .omo/evidence/task-7-generate-product.http
  ```

  **Commit**: YES | Message: `feat(portfolio): inject product context into generation` | Files: `src/app/api/generate/route.ts`, `src/types/brand.ts`, tests

- [ ] 8. Add Portfolio Product Overview To Dashboard

  **What to do**: Add a compact overview band at the top of the product dashboard showing product name, target customer, active experiment, primary metric, conversion metric, today's generated count, link ratio, quality pass count, and one next action. Use existing campaign summary and growth/viral endpoints rather than new data sources where possible.
  **Must NOT do**: Do not put a marketing hero on the dashboard. Do not remove existing operational panels. Do not make the dashboard require TikTok data.

  **Parallelization**: Can Parallel: YES | Wave 4 | Blocks: 11 | Blocked By: 1, 2, 3, 5, 9

  **References**:
  - Pattern: `src/components/Dashboard.tsx:360` - dashboard state pattern.
  - Pattern: `src/components/Dashboard.tsx:471` - campaign summary loader.
  - Pattern: `src/components/Dashboard.tsx:494` - generate action refresh sequence.
  - Pattern: `src/app/api/campaigns/summary/route.ts:76` - existing response includes quality, metrics, link ratio, playbook.

  **Automated Tests**:
  - `src/components/Dashboard.test.tsx > portfolio overview > renders product profile and experiment metrics`
  - `src/components/Dashboard.test.tsx > portfolio overview > renders empty learning state without campaign data`

  **Acceptance Criteria**:
  - [ ] RED component test proves no product overview is rendered from product profile.
  - [ ] GREEN test proves overview renders product name, active experiment, primary metric, and conversion metric.
  - [ ] GREEN test proves missing campaign summary renders a clear empty/learning state.
  - [ ] Existing campaign/TikTok/viral panels remain accessible and collapsible.

  **QA Scenarios**:
  ```
  Scenario: Dashboard shows product growth overview
    Tool: browser use
    Steps: set browser cookie `auth_session=ulw_qa_user_portfolio` for `127.0.0.1`, open http://127.0.0.1:3107/brands/ulw-qa-cosmicpath, wait for posts/campaign summary, capture top viewport
    Expected: visible overview includes product name, active experiment, primary metric, and next action
    Evidence: .omo/evidence/task-8-dashboard-overview.png and .omo/evidence/task-8-dashboard-overview-log.txt

  Scenario: Dashboard handles no experiment data
    Tool: browser use
    Steps: set browser cookie `auth_session=ulw_qa_user_portfolio` for `127.0.0.1`, open http://127.0.0.1:3107/brands/ulw-qa-no-posts
    Expected: overview shows learning/empty state and generate action; no crash or misleading success metrics
    Evidence: .omo/evidence/task-8-dashboard-empty.png
  ```

  **Commit**: YES | Message: `feat(portfolio): add product growth overview` | Files: `src/components/Dashboard.tsx`, tests

- [ ] 9. Generalize Experiment Metrics And Summary Response

  **What to do**: Extend campaign summary output to include product profile, active experiment, primary metric value, conversion metric value, evidence state, and next action. Map existing post metrics (`views`, `replies`, `reposts`, `clicks`, `conversions`, `manualPaidConversions`) to configured primary/conversion metrics. Keep today-based summary but expose enough metadata for portfolio overview.
  **Must NOT do**: Do not add analytics providers. Do not change score weights unless tests prove current weights are unusable. Do not remove reply playbook.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: 8, 11 | Blocked By: 1, 2, 3, 4, 7

  **References**:
  - Pattern: `src/app/api/campaigns/summary/route.ts:42` - campaign summary route.
  - Pattern: `src/app/api/campaigns/summary/route.ts:66` - link/quality metric calculation.
  - Pattern: `src/app/api/campaigns/summary/route.ts:113` - existing metrics payload.
  - Pattern: `src/lib/growth-learning.ts:30` - current performance scoring.

  **Automated Tests**:
  - `src/app/api/campaigns/summary/route.test.ts > summary > returns productProfile activeExperiment and metric mapping`
  - `src/app/api/campaigns/summary/route.test.ts > summary > returns 404 for missing campaign`

  **Acceptance Criteria**:
  - [ ] RED integration/unit test proves summary lacks product/experiment metadata.
  - [ ] GREEN test proves summary includes `productProfile`, `activeExperiment`, `primaryMetric`, `conversionMetric`, and `nextAction`.
  - [ ] GREEN test proves invalid/missing `campaignId` still returns 404 `campaign not found`.
  - [ ] GREEN test proves metrics values are derived from existing post fields for `views`, `replies`, `clicks`, `conversions`, and `manualPaidConversions`.

  **QA Scenarios**:
  ```
  Scenario: Summary returns product experiment metadata
    Tool: HTTP call
    Steps: curl -i 'http://127.0.0.1:3107/api/campaigns/summary?brandId=ulw_qa_product_cosmicpath' -H 'Cookie: auth_session=ulw_qa_user_portfolio'
    Expected: HTTP 200 body contains `productProfile`, `activeExperiment`, `primaryMetric`, `conversionMetric`, and `nextAction`
    Evidence: .omo/evidence/task-9-summary-product.http

  Scenario: Summary rejects unknown campaign
    Tool: HTTP call
    Steps: curl -i 'http://127.0.0.1:3107/api/campaigns/summary?brandId=ulw_qa_product_cosmicpath&campaignId=missing_campaign' -H 'Cookie: auth_session=ulw_qa_user_portfolio'
    Expected: HTTP 404 body contains `campaign not found`
    Evidence: .omo/evidence/task-9-summary-missing-campaign.http
  ```

  **Commit**: YES | Message: `feat(portfolio): expose experiment summary metrics` | Files: `src/app/api/campaigns/summary/route.ts`, `src/types/brand.ts`, tests

- [ ] 10. Seed CosmicPath And Generic Product Presets

  **What to do**: Add product preset definitions or a safe seed script that can initialize CosmicPath as the first product and create a generic placeholder product profile without source-code edits. The seed must not overwrite existing brands unless explicitly told. It should document exactly which fields are inserted.
  **Must NOT do**: Do not run a destructive migration. Do not change production DB data automatically in `postinstall`. Do not hardcode a second real product name.

  **Parallelization**: Can Parallel: YES | Wave 4 | Blocks: 11 | Blocked By: 1, 2, 3, 5, 6, 8

  **References**:
  - Pattern: `src/types/brand.ts:138` - CosmicPath campaign default.
  - Pattern: `src/app/brands/page.tsx:147` - create product modal currently seeds `DEFAULT_BRAND_CONFIG`.
  - Pattern: `scripts/add-advanced-creator-patterns.js` - existing script style for additive config.
  - Data: `.agent/memory/revenue/experiments/career_timing_wedge_399.json` - CosmicPath experiment source of truth.

  **Automated Tests**:
  - `src/app/brands/page.test.tsx > create product > submits product profile defaults`
  - `src/types/brand.test.ts > product presets > preserves CosmicPath and neutral product presets`
  - `scripts/qa/seed-portfolio-growth-os.test.ts > presets > prints preset changes without writes`

  **Acceptance Criteria**:
  - [ ] RED test proves create-product flow currently does not include product profile defaults in submitted payload.
  - [ ] GREEN test proves new products get neutral product profile + active experiment defaults.
  - [ ] Seed command can create fixed QA records: `ulw_qa_user_portfolio`, `ulw_qa_user_empty_portfolio`, `ulw_qa_product_cosmicpath`, `ulw_qa_product_missing_prompt`, and `ulw_qa_product_no_posts`.
  - [ ] Seed/dry-run command prints intended changes without writing unless a non-dry-run flag is passed.
  - [ ] Existing CosmicPath config can be normalized without losing campaign, quality, viral, or TikTok settings.

  **QA Scenarios**:
  ```
  Scenario: Dry-run seed is non-destructive
    Tool: bash / Codex exec_command
    Steps: cd /Users/kim-young-gwang/Desktop/projects/threads-uploader && node scripts/qa/seed-portfolio-growth-os.mjs --dry-run
    Expected: output lists CosmicPath/default product fields and says no database writes performed
    Evidence: .omo/evidence/task-10-seed-dry-run.txt

  Scenario: Create modal submits product profile defaults
    Tool: browser use
    Steps: set browser cookie `auth_session=ulw_qa_user_portfolio` for `127.0.0.1`, open http://127.0.0.1:3107/brands, click add product, fill name/slug/token/user id/date, intercept POST /api/brands payload
    Expected: payload includes `brandConfig.productProfile` and `brandConfig.activeExperiment`
    Evidence: .omo/evidence/task-10-create-product-payload.png and .omo/evidence/task-10-create-product-payload-log.txt
  ```

  **Commit**: YES | Message: `feat(portfolio): seed product presets` | Files: `src/types/brand.ts`, `src/app/brands/page.tsx`, `scripts/qa/seed-portfolio-growth-os.mjs`, tests

- [ ] 11. Update Docs And Operator Workflow

  **What to do**: Update README, API spec, screen flow, and task board language to describe the internal Portfolio Growth OS. Document daily operator loop: choose product -> check active experiment -> generate batch -> publish/review -> enter metrics -> learn -> next action. Include explicit out-of-scope items and evidence sprint guidance.
  **Must NOT do**: Do not claim features that implementation did not build. Do not describe public SaaS capabilities. Do not remove cron endpoint docs that still exist.

  **Parallelization**: Can Parallel: NO | Wave 5 | Blocks: Final Verification | Blocked By: 1-10

  **References**:
  - Pattern: `README.md:1` - current title and product description.
  - Pattern: `docs/api-spec.md:1` - current API spec calls it Threads Auto Uploader.
  - Pattern: `docs/screen-flow.md:1` - current screen flow is CosmicPath-specific.
  - Pattern: `.agent/memory/task_board.md:1` - current mission is TikTok Video Experiment Engine MVP.

  **Automated Tests**:
  - `src/docs-contract.test.ts > docs > portfolio docs mention internal owned products and 7-day evidence sprint`
  - `src/docs-contract.test.ts > docs > docs do not advertise billing or public SaaS`

  **Acceptance Criteria**:
  - [ ] Docs call the product `Portfolio Growth OS`.
  - [ ] Docs state it is internal-only for the user's owned products.
  - [ ] Docs include the 7-day evidence sprint loop and metrics.
  - [ ] Docs preserve actual command list and endpoint list; no fake commands.
  - [ ] `npm run build` still passes.

  **QA Scenarios**:
  ```
  Scenario: Docs contain internal portfolio framing
    Tool: bash / Codex exec_command
    Steps: cd /Users/kim-young-gwang/Desktop/projects/threads-uploader && rg "Portfolio Growth OS|internal|owned products|7-day" README.md docs .agent/memory/task_board.md
    Expected: output shows matches in README, docs/api-spec.md, docs/screen-flow.md, and task_board.md
    Evidence: .omo/evidence/task-11-docs-rg.txt

  Scenario: Docs do not advertise SaaS/billing
    Tool: bash / Codex exec_command
    Steps: cd /Users/kim-young-gwang/Desktop/projects/threads-uploader && ! rg "Stripe|billing|pricing plan|public SaaS" README.md docs .agent/memory/task_board.md
    Expected: command exits 0 and output has no prohibited SaaS claims
    Evidence: .omo/evidence/task-11-docs-scope.txt
  ```

  **Commit**: YES | Message: `docs(portfolio): document internal growth workflow` | Files: `README.md`, `docs/api-spec.md`, `docs/screen-flow.md`, `.agent/memory/task_board.md`


## Final Verification Wave (MANDATORY - after ALL implementation tasks)
> ALL checks are agent-executed. Record consolidated results before completion.
- [ ] F1. Plan Compliance Audit
  - Confirm every task acceptance criterion has evidence.
  - Command: `npm run test && npm run typecheck && npm run lint && npm run build`
  - Evidence: `.omo/evidence/final-plan-compliance.txt`
- [ ] F2. Code Quality Review
  - Review for CosmicPath leakage, `as any`, skipped tests, public SaaS scope, and destructive changes.
  - Evidence: `.omo/evidence/final-code-review.md`
- [ ] F3. Real Manual QA
  - Browser and HTTP scenarios from Tasks 4, 5, 7, 8, 9 must be re-run on the final build.
  - Evidence: `.omo/evidence/final-manual-qa.md`
- [ ] F4. Scope Fidelity Check
  - Confirm no billing, public onboarding, automatic TikTok upload, scraping, auto-DM/reply/follow behavior was added.
  - Evidence: `.omo/evidence/final-scope-fidelity.md`

## Commit Strategy
- Do not auto-commit unless user explicitly asks.
- If committing, use atomic Conventional Commits.
- Suggested final draft messages:
  - `test(portfolio): add growth OS test baseline`
  - `feat(portfolio): add product profile configuration`
  - `feat(portfolio): generalize quality and experiment workflow`
  - `refactor(ui): rename app surface to Portfolio Growth OS`
  - `docs(portfolio): document internal growth workflow`

## Success Criteria
- The app is clearly framed as an internal Portfolio Growth OS.
- CosmicPath works as one product, not the hardcoded product identity.
- A generic second product can be created/configured through the existing brand/product flow.
- Active experiment, primary metric, target customer, offer, and landing URL are visible and persisted.
- Generation and summary APIs use product-specific config.
- All tests, static checks, build, and manual QA pass with captured evidence.
