# Product Auto Setup + Approved Campaign Start Plan

## Objective

Build an MVP workflow for Portfolio Growth OS where a new product can be registered with product context, an editable marketing setup draft is generated, readiness is shown, and a 7-day product-growth campaign can be started only after the setup is ready and explicitly approved.

## Scope

- Add a deterministic product auto-setup service that derives product profile, system prompt, topics, targets, situations, baseline campaign, active experiment, formulas, and readiness gaps from product name, slug, description, landing URL, target customer, and offer promise.
- Add a server route for auto-setup preview so the create-product modal can request a draft before creating the product.
- Extend product creation to preserve an approved auto-setup draft and fallback safely when no draft is provided.
- Add product settings readiness/start controls with minimal wiring through the large settings form.
- Avoid broad edits to `Dashboard.tsx`, `BrandSettingsForm.tsx`, and `generate/route.ts`; prefer new small modules/components and targeted integration.

## Acceptance Criteria

### C001 Happy Path

Given a user registers "InvoiceFlow" with a useful description, target customer, offer promise, and landing URL, the auto-setup API returns a ready draft with score >= 80, product_growth campaign, 7-day active experiment, non-empty system prompt/topics/targets/situations/formulas, and product creation persists that approved setup. Evidence: RED/GREEN unit/API tests plus HTTP artifact under `.omo/ulw-loop/evidence/019e9180-d682-7553-aa30-cb52004e2102/C001-*`.

### C002 Edge Case

Given missing or malformed product context, the auto-setup API returns actionable readiness gaps, score below ready threshold, no ready campaign start state, and the UI/API does not silently create a ready campaign from empty product detail. Evidence: RED/GREEN tests plus HTTP artifact under `.omo/ulw-loop/evidence/019e9180-d682-7553-aa30-cb52004e2102/C002-*`.

### C003 Regression

Existing product-growth behavior remains intact: CosmicPath/career examples are not injected into generic product setup, TikTok remains disabled for product baseline, account discovery stays product-mode, and existing generate readiness/UTM tests pass. Evidence: targeted regression test output plus manual/browser smoke cleanup under `.omo/ulw-loop/evidence/019e9180-d682-7553-aa30-cb52004e2102/C003-*`.

## TDD Sequence

1. RED: add `src/lib/product-auto-setup.test.ts` for happy/edge draft generation.
2. RED: add API tests in `src/app/api/products/auto-setup/route.test.ts` for ready and insufficient inputs.
3. RED: extend `src/app/api/brands/route.test.ts` to assert approved setup persists system prompt/topics/profile/campaign.
4. RED: extend `src/components/portfolio-surface.test.ts` to require create modal auto-setup fields/readiness/start labels.
5. GREEN: implement `src/lib/product-auto-setup.ts`.
6. GREEN: implement `src/app/api/products/auto-setup/route.ts`.
7. GREEN: minimally update `src/app/api/brands/route.ts`.
8. GREEN: minimally update `src/app/brands/page.tsx`, `src/components/ProductSettingsTab.tsx`, and `src/components/BrandSettingsForm.tsx`.
9. Run `npm test -- --run src/lib/product-auto-setup.test.ts src/app/api/products/auto-setup/route.test.ts src/app/api/brands/route.test.ts src/app/api/generate/route.test.ts src/components/portfolio-surface.test.ts`.
10. Run `npm run typecheck` and `npm run build` when targeted tests are green.

## Manual QA

- HTTP C001: POST `/api/products/auto-setup` with InvoiceFlow-style data; save JSON response artifact.
- HTTP C002: POST `/api/products/auto-setup` with missing description/landing; save JSON response artifact.
- Browser C001/C003: start local app, open `/brands`, verify create modal has product context fields and auto-setup readiness copy; capture screenshot.
- Browser campaign start: open a product settings surface with ready setup and verify the start button is disabled only when readiness fails or already generating; capture screenshot or DOM text artifact.
- Cleanup: stop dev server, record `lsof`/process cleanup output.

## Worker Decomposition

- Worker A owns tests and the pure setup service.
- Worker B owns API routes and brand create persistence.
- Worker C owns UI wiring in create modal and product settings only.
- Root owns ULW state, Momus plan review, RED/GREEN evidence capture, manual QA, cleanup, and final reviewer audit.

## Risks

- `BrandSettingsForm.tsx` and `Dashboard.tsx` are large. Do not add business logic there; use props and extracted helpers/components.
- The app may require auth/database for browser QA. If full browser persistence is blocked, use HTTP route artifacts and static/UI contract screenshots, then document the blocker.
- No external AI/network should be required for auto-setup; the MVP must be deterministic and testable locally.
