# url-demo-asset-generator - Work Plan

## TL;DR (For humans)
**What you'll get:** A URL-to-demo-asset generator inside the existing product dashboard. A product owner enters a product URL, the system captures the real mobile page, then produces polished vertical demo promo videos and reusable demo images ready to download for Shorts, TikTok, Reels, landing pages, and ads.

**Why this approach:** The system uses real page capture as evidence, then uses AI only to plan the story, captions, and visual treatment. Final assets are rendered through a controlled renderer so they look intentional instead of like raw screen recordings.

**What it will NOT do:** It will not auto-post to TikTok, YouTube, or Instagram in this MVP. It will not use browser-cookie uploaders, scrape private data, fake product screens, invent product features, or weaken the existing TikTok manual-upload guardrails.

**Effort:** Large
**Risk:** High - browser capture and video rendering add new runtime, storage, and QA surfaces.
**Decisions I made for you:** Generate downloadable assets first: 3 videos and 6 images per URL; use Playwright for real mobile capture; use Remotion `renderMedia()` for MP4 video and `renderStill()` for still images; add a new `demo-assets` domain instead of overloading `TikTokVideoDraft`; defer platform upload integrations.

Your next move: start execution with a worker agent. Full execution detail follows below.

---

> TL;DR (machine): Large/high-risk MVP plan for URL intake, Playwright capture, AI creative planning, Remotion MP4 plus still-image rendering, asset library UI, and agent-run QA; no social auto-posting.

## Scope
### Must have
- Authenticated product owners can open a new Demo Assets panel from an existing product dashboard.
- The panel accepts a product URL, product context overrides, a style ID, and bounded asset counts. Defaults are 3 videos and 6 images; allowed ranges are 1-5 videos and 1-12 images.
- The backend validates the URL as `http:` or `https:`, rejects private/local network targets before and after DNS resolution/redirects, and records a durable generation job.
- A worker captures the real URL in a deterministic mobile viewport using Playwright and records screenshots, page metadata, action log, and failure details.
- AI generates a structured creative plan from only product profile data plus captured page evidence.
- The creative plan produces exactly 3 demo video concepts and 6 demo image concepts by default.
- A quality gate rejects plans that invent features, omit a CTA, have unsafe claims, reference unavailable capture evidence, or include text likely to overlap.
- Remotion renders 1080x1920 MP4 files for videos and 1080x1920 PNG or JPEG stills for images.
- Assets are stored through a provider abstraction with a local filesystem provider for MVP execution.
- The UI shows job progress, capture thumbnails, rendered previews, quality failures, download buttons, caption/hashtag copy, and regenerate actions.
- API, worker, renderer, and UI behavior have automated tests plus real browser QA evidence.
- Documentation clearly states that TikTok/YouTube/Instagram auto-posting is future work.

### Must NOT have (guardrails, anti-slop, scope boundaries)
- No automatic TikTok, YouTube, Instagram, Threads, or Reels posting.
- No TikTok Direct Post, YouTube upload, OAuth scopes, browser-cookie social uploaders, Selenium social posting, comments, DMs, likes, follows, or engagement automation.
- No private page crawling, authenticated third-party scraping, private analytics scraping, or local-network URL fetching.
- No private/local network access through redirects, DNS rebinding, or browser subresource requests.
- Localhost fixture URLs are allowed only when `NODE_ENV !== "production"` and `DEMO_ASSETS_ALLOW_LOCAL_FIXTURES=1`; production code must reject them.
- No fake demo screens or invented product features when the URL cannot provide evidence.
- No long render work inside a request/response API path.
- No hidden reliance on Vercel filesystem durability; local storage is the MVP provider behind an interface.
- No changes that regress current product creation, Threads posting, or TikTok Video Lab manual-upload guardrails.
- No `any`, `@ts-ignore`, or `@ts-expect-error`.

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: TDD for validation, contracts, quality gates, worker state transitions, and API access. Tests-after for dense dashboard UI states. Real browser QA for the complete generation surface and rendered artifact preview/download.
- Commands, scripts, routes, and tests named under a todo are post-implementation deliverables when they do not exist yet. The executor must create them inside that todo before running the acceptance or QA command.
- Browser QA lifecycle commands must be wrapped in scripts that start and tear down their own fixture server, dev server, worker process, and temporary files. Do not leave live ports, workers, or temp dirs after evidence capture.
- Unit and integration commands:
  - `npm run test -- src/lib/demo-assets/url-intake.test.ts`
  - `npm run test -- src/lib/demo-assets/creative-planner.test.ts`
  - `npm run test -- src/lib/demo-assets/quality-gate.test.ts`
  - `npm run test -- src/lib/demo-assets/render-plan.test.ts`
  - `npm run test -- src/app/api/demo-assets/jobs/route.test.ts`
  - `npm run test -- src/components/DemoAssetGeneratorPanel.test.ts`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`
- Real-surface evidence paths:
  - `.omo/evidence/task-1-url-demo-asset-generator.txt`
  - `.omo/evidence/task-2-url-demo-asset-generator.txt`
  - `.omo/evidence/task-3-url-demo-asset-generator.http`
  - `.omo/evidence/task-4-url-demo-asset-generator.txt`
  - `.omo/evidence/task-5-url-demo-asset-generator.txt`
  - `.omo/evidence/task-6-url-demo-asset-generator.txt`
  - `.omo/evidence/task-7-url-demo-asset-generator.txt`
  - `.omo/evidence/task-8-url-demo-asset-generator.png`
  - `.omo/evidence/task-9-url-demo-asset-generator.txt`
  - `.omo/evidence/f1-url-demo-asset-generator.txt`
  - `.omo/evidence/f2-url-demo-asset-generator.txt`
  - `.omo/evidence/f3-url-demo-asset-generator.md`
  - `.omo/evidence/f4-url-demo-asset-generator.txt`

## Execution strategy
### Parallel execution waves
- Wave 1: data contracts, URL safety, and job API. Tasks 1-3. Task 1 blocks all later work; Task 2 runs after Task 1, then Task 3 runs after Tasks 1-2.
- Wave 2: capture, creative planning, quality gates, and render plans. Tasks 4-6. Capture and planning are parallel after the data model exists; quality gate depends on the creative plan type.
- Wave 3: rendering worker, storage/download, and UI. Tasks 7-8. Rendering depends on capture and render plan contracts; UI can start once API response shapes are stable.
- Wave 4: documentation, regression, and final verification. Task 9 plus final verification wave.

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1 | none | 2, 3, 4, 5, 6, 7, 8, 9 | none |
| 2 | 1 | 3, 7, 8 | none |
| 3 | 1, 2 | 7, 8 | none |
| 4 | 1, 2 | 5, 6, 7 | 3 |
| 5 | 1, 2 | 6, 7 | 4 |
| 6 | 4, 5 | 7, 8 | none |
| 7 | 3, 4, 6 | 8, 9 | none |
| 8 | 3, 6, 7 | 9 | none |
| 9 | 1-8 | final verification | none |

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->
- [ ] 1. Add demo asset domain contracts and Prisma schema
  What to do / Must NOT do: Add a new `demo-assets` domain without changing existing TikTok draft semantics. Create Prisma models `DemoAssetJob`, `DemoCaptureArtifact`, and `DemoRenderedAsset`. Add typed config/response contracts in `src/types/demo-asset.ts`. Add status enums as string unions, not loose strings. Must not overload `TikTokVideoDraft`, `Post`, or `Brand.brandConfig` for rendered asset storage.
  Parallelization: Wave 1 | Blocked by: none | Blocks: all later todos
  References (executor has NO interview context - be exhaustive): `prisma/schema.prisma:235-283`; `src/types/tiktok-video.ts:1-69`; `src/lib/product-auto-setup.ts:20-85`; `.omo/drafts/url-demo-asset-generator.md`
  Acceptance criteria: `npm run test -- src/types/demo-asset.test.ts` proves status normalization, JSON serialization, default counts, count clamping to 1-5 videos and 1-12 images, style normalization, render target dimensions, and invalid status rejection. `npx prisma migrate dev --name add_demo_asset_generator --create-only` creates `prisma/migrations/<timestamp>_add_demo_asset_generator/migration.sql`; `npx prisma generate` exits 0; `npx prisma migrate deploy` exits 0 against the configured QA database.
  QA scenarios: Happy: `npm run test -- src/types/demo-asset.test.ts > .omo/evidence/task-1-url-demo-asset-generator.txt` and assert output contains the new passing suite. Failure: include a test that passes malformed persisted JSON/status and asserts a safe fallback or validation error; the same evidence file must show it passed.
  Commit: Y | `feat(demo-assets): add asset generation data contracts`

- [ ] 2. Implement URL intake, product evidence extraction, and SSRF-safe validation
  What to do / Must NOT do: Create `src/lib/demo-assets/url-intake.ts` with `normalizeDemoAssetRequest`, `validatePublicProductUrl`, `resolvePublicProductUrl`, `extractProductEvidenceFromHtml`, and `buildInitialProductBrief`. Only allow `http:` and `https:` on ports 80 and 443, except test-only fixture URLs when `NODE_ENV !== "production"` and `DEMO_ASSETS_ALLOW_LOCAL_FIXTURES=1`. Reject `localhost`, loopback, link-local, private IPv4 ranges, private IPv6, IPv6-mapped IPv4 private ranges, empty hosts, unsupported ports, CNAME/A/AAAA chains resolving private/local, and malformed URLs before fetch. Resolve DNS A/AAAA records and reject private/local resolved addresses. Re-validate every redirect target with a max redirect count of 3. Allow manual product profile overrides to win over extracted metadata. Must not fetch remote URLs from arbitrary API routes without calling the validator first.
  Parallelization: Wave 1 | Blocked by: 1 | Blocks: 3, 4, 5, 7, 8
  References: `src/lib/product-auto-setup.ts:20-85`; `src/app/api/products/auto-setup/route.ts`; `src/app/api/brands/route.ts:1-139`; Playwright screenshot docs in draft findings
  Acceptance criteria: `npm run test -- src/lib/demo-assets/url-intake.test.ts` proves valid URL normalization, private literal URL rejection, private DNS resolution rejection, redirect re-validation, max redirect handling, metadata extraction from HTML fixtures, and manual override precedence.
  QA scenarios: Happy: `npm run test -- src/lib/demo-assets/url-intake.test.ts > .omo/evidence/task-2-url-demo-asset-generator.txt` with fixture HTML containing title, meta description, Open Graph image, CTA button text, and pricing copy. Failure: the same test run includes rejected examples for `http://localhost`, `http://127.0.0.1`, `http://10.0.0.1`, `file://x`, `javascript:alert(1)`, a public-looking host resolving to `127.0.0.1`, and a public URL that redirects to `http://127.0.0.1/private`.
  Commit: Y | `feat(demo-assets): validate product URLs`

- [ ] 3. Add job APIs with auth, ownership, polling, fixture seed, and download-safe response shapes
  What to do / Must NOT do: Add routes under `src/app/api/demo-assets/jobs`: `POST /api/demo-assets/jobs`, `GET /api/demo-assets/jobs?brandId={brandId}`, `GET /api/demo-assets/jobs/[id]`, `POST /api/demo-assets/jobs/[id]/regenerate`. Add `GET /api/demo-assets/assets/[id]/download` only after storage paths are introduced in Todo 7. Add demo-assets ownership helpers to `src/lib/brand-access.ts` or a new `src/lib/demo-assets/access.ts` that delegates to the existing brand owner checks. Add `scripts/qa/seed-demo-assets.mjs` that creates/updates fixture user `ulw_qa_demo_assets_user`, brand slug `ulw-qa-demo-assets`, and prints `Cookie: auth_session=ulw_qa_demo_assets_user` plus `Brand: <id>`. Return stable response types from `src/types/demo-asset.ts`. Must not expose local filesystem paths, raw secrets, or other users' assets.
  Parallelization: Wave 1 | Blocked by: 1, 2 | Blocks: 7, 8
  References: `src/app/api/tiktok/videos/generate/route.ts`; `src/app/api/tiktok/videos/route.ts`; `src/app/api/tiktok/summary/route.ts`; `src/lib/brand-access.ts`; `docs/api-spec.md:786-794`; `docs/api-spec.md:884-900`
  Acceptance criteria: `npm run test -- src/app/api/demo-assets/jobs/route.test.ts` proves create/list/detail/regenerate success, unauthorized rejection, cross-owner rejection, invalid URL 400, and default counts of 3 videos/6 images.
  QA scenarios: Happy: run `node scripts/qa/seed-demo-assets.mjs --apply` and capture the printed cookie/brand, start dev server, then `curl -i -X POST http://localhost:3000/api/demo-assets/jobs -H 'Content-Type: application/json' -H 'Cookie: auth_session=ulw_qa_demo_assets_user' --data '{"brandId":"<printed-brand-id>","productUrl":"https://example.com","style":"clean-product-demo","videoCount":3,"imageCount":6}' > .omo/evidence/task-3-url-demo-asset-generator.http`; PASS if status is `202` and body has `status:"QUEUED"`. Failure: repeat with `http://127.0.0.1` and append to the same evidence file; PASS if status is `400` and no job row is created.
  Commit: Y | `feat(demo-assets): add generation job APIs`

- [ ] 4. Build Playwright capture worker for real mobile product evidence
  What to do / Must NOT do: Add `src/lib/demo-assets/capture-runner.ts`, fixture helpers under `scripts/qa/demo-assets-fixtures.mjs`, package scripts `demo-assets:fixture-server` and `demo-assets:worker`, and a worker entry `scripts/demo-assets-worker.mjs` that can process one queued job with `--once --stage capture`. Install the minimal Playwright dependency needed by this repo and document browser install requirements. Use Playwright `devices["iPhone 14 Pro"]` with locale `ko-KR`, timezone `America/Vancouver`, color scheme `light`, reduced motion `reduce`, and the device descriptor user agent/viewport/DPR. Capture at least: initial viewport screenshot, full-page screenshot, up to 4 section screenshots, visible text blocks, CTA candidates, page metadata, and an action log. Do not require raw Playwright video clips in MVP; final promo videos are Remotion outputs. Before navigation, use Todo 2 URL validation. During Playwright navigation, block `file:`, `data:`, `javascript:`, private/local IP hosts, and redirect/subresource requests that resolve to private/local addresses. Store capture artifacts through the storage interface from Todo 7 when available; until Todo 7, tests may use a temp directory. Must not login to third-party sites, click destructive buttons, submit forms, or capture private/authenticated content.
  Parallelization: Wave 2 | Blocked by: 1, 2 | Blocks: 5, 6, 7
  References: Playwright screenshots docs `https://playwright.dev/docs/screenshots`; Playwright videos docs `https://playwright.dev/docs/videos`; reference MOV metadata in draft; `package.json:17-46`
  Acceptance criteria: `npm run test -- src/lib/demo-assets/capture-runner.test.ts` proves capture command construction, exact device/locale/timezone config, timeout handling, artifact manifest shape, request blocking, DNS/redirect re-validation, test-only local fixture bypass, and safe no-submit action policy. A manual worker run against a fixture page creates at least two image artifacts and an action log.
  QA scenarios: Happy: `DEMO_ASSETS_ALLOW_LOCAL_FIXTURES=1 npm run demo-assets:fixture-server -- --seed-job invoiceflow` prints deterministic `JOB_ID=<value>` and `FIXTURE_PORT=<value>` lines; then `DEMO_ASSETS_ALLOW_LOCAL_FIXTURES=1 npm run demo-assets:worker -- --once --stage capture --job-id $JOB_ID > .omo/evidence/task-4-url-demo-asset-generator.txt`; PASS if output includes `CAPTURED` and generated artifact paths exist. Failure: run `DEMO_ASSETS_ALLOW_LOCAL_FIXTURES=1 npm run demo-assets:fixture-server -- --seed-job redirect-private` and process that job; append output; PASS if job status becomes `FAILED_CAPTURE` with a private redirect/subresource reason and no render starts.
  Commit: Y | `feat(demo-assets): capture product URLs with Playwright`

- [ ] 5. Add AI creative planner for video and image concepts from capture evidence
  What to do / Must NOT do: Add `src/lib/demo-assets/creative-planner.ts` with a deterministic fallback planner plus AI planner when `ANTHROPIC_API_KEY` exists. Use model `process.env.DEMO_ASSETS_AI_MODEL ?? "claude-sonnet-4-6"`, timeout 45 seconds, one retry on transient provider failures, and deterministic fallback for all tests unless `DEMO_ASSETS_TEST_AI=1`. Inputs: product profile, URL evidence, capture artifacts, style ID, counts. Output: `DemoCreativePlan` with defaults of 3 `videoConcepts` and 6 `imageConcepts`; enforce allowed ranges 1-5 videos and 1-12 images. Supported style IDs are `clean-product-demo` (default), `problem-solution-demo`, `feature-walkthrough`, and `social-proof-teaser`; unknown styles fall back to `clean-product-demo` with a warning reason. Each video concept must include hook, promise, scene beats, capture references, on-screen text, caption, hashtags, CTA, and duration. Each image concept must include layout type, capture references, headline, supporting copy, CTA, and export format. Must not use capture IDs that do not exist or invent unavailable product features.
  Parallelization: Wave 2 | Blocked by: 1, 2 | Blocks: 6, 7
  References: `src/lib/tiktok-video-service.ts:97-170`; `src/lib/tiktok-video-service.ts:312-452`; `src/lib/product-quality-gate.ts`; `src/lib/quality-gate.ts`; `docs/api-spec.md:858-870`
  Acceptance criteria: `npm run test -- src/lib/demo-assets/creative-planner.test.ts` proves default 3/6 counts, min/max count clamping, style fallback, fallback mode without API key, no hallucinated feature when evidence is sparse, capture-reference validity, and product override inclusion.
  QA scenarios: Happy: `npm run test -- src/lib/demo-assets/creative-planner.test.ts > .omo/evidence/task-5-url-demo-asset-generator.txt` with a fixture for an invoice SaaS page. Failure: include a fixture where evidence lacks a claimed feature and assert the planner omits that feature or returns a quality issue.
  Commit: Y | `feat(demo-assets): plan demo creative assets`

- [ ] 6. Add demo asset quality gates and render plan builders
  What to do / Must NOT do: Add `src/lib/demo-assets/quality-gate.ts` and `src/lib/demo-assets/render-plan.ts`. Quality gate must reject missing hook, missing CTA, unsupported capture references, ungrounded claims, unsafe certainty, overlapping text risk, too-long text for 9:16, blank capture references, and duration outside 15-45 seconds. Render plan builder converts creative plans into Remotion-friendly props with stable dimensions, typography tokens, safe text wrapping rules, image crop boxes, touch indicators, zoom timings, and asset IDs. Text-fit requirements: no line may exceed 26 Korean characters or 34 Latin characters before wrapping; max 3 headline lines; max 2 CTA lines; reject unbreakable words that cannot fit at 1080px width with configured font scale. Must not hardcode CosmicPath wording.
  Parallelization: Wave 2 | Blocked by: 4, 5 | Blocks: 7, 8
  References: `src/lib/tiktok-video-quality.ts`; `src/lib/tiktok-video-renderer.ts:1-104`; `src/lib/tiktok-video-canvas.ts`; explicit text-fit requirements in this todo; reference MOV metadata in draft
  Acceptance criteria: `npm run test -- src/lib/demo-assets/quality-gate.test.ts src/lib/demo-assets/render-plan.test.ts` proves pass/fail cases, text length clamping, capture-reference validation, and stable `1080x1920` render target.
  QA scenarios: Happy: `npm run test -- src/lib/demo-assets/quality-gate.test.ts src/lib/demo-assets/render-plan.test.ts > .omo/evidence/task-6-url-demo-asset-generator.txt`; PASS if grounded product demo fixture passes. Failure: fixture with invented feature, no CTA, and 200-character button label fails with specific reasons.
  Commit: Y | `feat(demo-assets): gate and shape render plans`

- [ ] 7. Implement Remotion renderer, local storage provider, and worker state machine
  What to do / Must NOT do: Add Remotion composition files under `src/remotion/demo-assets/`, renderer orchestration under `src/lib/demo-assets/renderer.ts`, and storage abstraction under `src/lib/demo-assets/storage.ts`. Add local storage provider writing under `.data/demo-assets/<jobId>/` and serving downloads only through API routes. Storage contract: normalize filenames to `[a-z0-9._-]`, allow only MP4/PNG/JPEG/WebP MIME types, cap each artifact at 100 MB, store SHA-256 and byte size, send `Content-Disposition: attachment`, and provide cleanup for jobs older than 14 days. Extend `scripts/demo-assets-worker.mjs` to process states `QUEUED -> CAPTURING -> PLANNING -> RENDERING -> READY` and failures `FAILED_CAPTURE`, `FAILED_PLAN`, `FAILED_RENDER`, `FAILED_QUALITY`. Add lock fields and behavior: worker claims one job with `lockedBy`, `lockedAt`, `heartbeatAt`, `attemptCount`; lock expires after 10 minutes; max attempts 2; duplicate workers must not process the same job; failed jobs are resumable from the last completed stage. Add package script `demo-assets:render-fixture` to `package.json`; `demo-assets:worker` and `demo-assets:fixture-server` were introduced in Todo 4 and may be extended here. Must not render inside API routes or expose raw local paths.
  Parallelization: Wave 3 | Blocked by: 3, 4, 6 | Blocks: 8, 9
  References: Remotion renderer docs `https://www.remotion.dev/docs/renderer`; Remotion `renderMedia` docs `https://www.remotion.dev/docs/renderer/render-media`; Remotion `renderStill` docs `https://www.remotion.dev/docs/renderer/render-still`; `package.json:5-15`; `src/lib/tiktok-video-renderer.ts:37-104`; `.omo/drafts/url-demo-asset-generator.md`
  Acceptance criteria: `npm run test -- src/lib/demo-assets/renderer.test.ts src/lib/demo-assets/storage.test.ts src/lib/demo-assets/worker.test.ts` proves render prop validation, local storage write/read, MIME/size/filename safety, `Content-Disposition`, cleanup, download token/path safety, worker state transitions, lock expiry, duplicate worker prevention, retry limits, and resumability. `npm run demo-assets:render-fixture` creates the default 3 MP4 files and 6 PNG/JPEG files from fixture data.
  QA scenarios: Happy: `DEMO_ASSETS_ALLOW_LOCAL_FIXTURES=1 npm run demo-assets:render-fixture > .omo/evidence/task-7-url-demo-asset-generator.txt`; PASS if output lists exactly 3 `.mp4` files and 6 `.png` or `.jpg` files, each exists and is non-zero. Failure: run fixture with an invalid missing capture artifact and append output; PASS if status is `FAILED_RENDER` or `FAILED_QUALITY`, not `READY`.
  Commit: Y | `feat(demo-assets): render downloadable demo assets`

- [ ] 8. Build the dashboard Demo Assets panel and preview/download UX
  What to do / Must NOT do: Add `src/components/DemoAssetGeneratorPanel.tsx`, integrate it into `src/components/Dashboard.tsx` behind a small prop boundary (`brandId`, `brandSlug`, `productProfile`, optional `initialJobs`) near the current TikTok Lab controls, and add browser QA script `scripts/qa/demo-assets-panel.mjs`. UI states: empty, validating URL, queued, capturing, planning, rendering, ready, failed, regenerate, and downloading. Controls: URL input, style segmented control using the four style IDs from Todo 5, count steppers/sliders clamped to 1-5 videos and 1-12 images, submit, job history, preview grid, video preview, still preview, copy caption/hashtags, download asset, regenerate failed or selected asset. Use existing UI primitives and lucide icons. Because current Vitest includes only `*.test.ts`, write `src/components/DemoAssetGeneratorPanel.test.ts` as a source/static-render contract test unless the executor explicitly adds jsdom/React Testing Library and updates Vitest config in the same todo. Must not create a marketing landing page, nested cards, or visible explanatory tutorial text beyond concise labels/errors.
  Parallelization: Wave 3 | Blocked by: 3, 6, 7 | Blocks: 9
  References: `src/components/Dashboard.tsx` TikTok Lab state and handlers; `src/components/ProductSettingsTab.tsx`; `src/components/ui/button.tsx`; `src/components/ui/card.tsx`; `docs/screen-flow.md:87-100`; UI constraints stated in this todo
  Acceptance criteria: `npm run test -- src/components/DemoAssetGeneratorPanel.test.ts` proves URL validation errors, successful job creation, polling status updates, ready asset preview, failed job retry, download link rendering, and count/style controls. `node scripts/qa/demo-assets-panel.mjs --help` prints required flags and exits 0.
  QA scenarios: Happy browser: start dev server and fixture server, then run `node scripts/qa/demo-assets-panel.mjs --brand-slug ulw-qa-demo-assets --url http://127.0.0.1:$FIXTURE_PORT/invoiceflow --evidence .omo/evidence/task-8-url-demo-asset-generator.png`; PASS if screenshot shows ready video and image asset previews with download buttons. Failure browser: same script with `http://127.0.0.1:1/private`; PASS if screenshot shows the validation error and no queued job.
  Commit: Y | `feat(demo-assets): add asset generator dashboard`

- [ ] 9. Update docs, regression contracts, and final quality safeguards
  What to do / Must NOT do: Update `docs/api-spec.md`, `docs/screen-flow.md`, and `README.md` with Demo Asset Generator contracts, endpoints, worker command, fixture command, storage caveat, output formats, and platform-upload non-goals. Add contract tests that existing TikTok Video Lab still says no upload automation and that Demo Assets owns URL-to-MP4/image generation. Explicitly scope the old `No server-side MP4/Remotion/FFmpeg render pipeline` statement to the earlier TikTok Video Lab cycle only, then add a separate Demo Assets contract that permits Remotion worker rendering. Add `scripts/qa/plan-compliance.mjs` if it does not already exist; this script is a required new QA utility and must check for incomplete plan markers, missing todo sections, missing QA scenarios, missing commit lines, and forbidden auto-posting scope. Add `scripts/qa/demo-assets-scope-fidelity.mjs` for allowlisted automation-scope checks. Add `scripts/qa/demo-assets-e2e.mjs` for final browser QA; it must start fixture server, seed fixture auth/brand, start the dev server on a free port, run/trigger the worker, capture browser evidence, download assets, and tear everything down. Must not imply TikTok/YouTube posting is included.
  Parallelization: Wave 4 | Blocked by: 1-8 | Blocks: final verification
  References: `README.md:1-91`; `docs/api-spec.md:725-900`; `docs/screen-flow.md:87-123`; `src/docs-contract.test.ts`
  Acceptance criteria: `npm run test -- src/docs-contract.test.ts` proves docs mention URL-to-demo-assets, downloadable MP4/images, worker command, fixture command, Demo Assets Remotion worker allowance, TikTok Lab no-upload guardrail, and no auto-posting. It also fails if an unscoped `No server-side MP4/Remotion/FFmpeg` statement contradicts Demo Assets. `npm run test`, `npm run typecheck`, `npm run lint`, and `npm run build` exit 0 or record pre-existing unrelated failures with proof.
  QA scenarios: Happy: `npm run test -- src/docs-contract.test.ts > .omo/evidence/task-9-url-demo-asset-generator.txt` and append `npm run typecheck`, `npm run lint`, and `npm run build` summaries. Failure: docs contract must fail if `TikTok upload included` or equivalent auto-post claim appears in Demo Asset MVP docs.
  Commit: Y | `docs(demo-assets): document asset generator workflow`

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [ ] F1. Plan compliance audit
  Invocation: `node scripts/qa/plan-compliance.mjs .omo/plans/url-demo-asset-generator.md > .omo/evidence/f1-url-demo-asset-generator.txt`.
  PASS observable: no incomplete plan markers remain, every todo has references, acceptance criteria, happy/failure QA, and commit line.
- [ ] F2. Code quality review
  Invocation: `{ npm run test && npm run typecheck && npm run lint && npm run build; } > .omo/evidence/f2-url-demo-asset-generator.txt 2>&1`.
  PASS observable: all commands exit 0, or any failure is documented as pre-existing and unrelated with exact command output.
- [ ] F3. Real manual QA
  Invocation: `DEMO_ASSETS_ALLOW_LOCAL_FIXTURES=1 node scripts/qa/demo-assets-e2e.mjs --brand-slug ulw-qa-demo-assets --fixture invoiceflow --evidence .omo/evidence/f3-url-demo-asset-generator.md`.
  PASS observable: evidence includes fixture/dev/worker lifecycle log, browser action log, screenshot paths, job ID, exactly 3 MP4 asset IDs, exactly 6 still asset IDs, downloaded MP4/PNG/JPEG file paths, file sizes greater than zero, and teardown receipt.
- [ ] F4. Scope fidelity
  Invocation: `node scripts/qa/demo-assets-scope-fidelity.mjs > .omo/evidence/f4-url-demo-asset-generator.txt`.
  PASS observable: script exits 0 after allowlisting existing metrics/safety text and failing only on new upload/post/engagement automation implementations such as Direct Post, YouTube upload, cookie uploaders, Selenium social posting, automated comments, automated likes, follows, DMs, or publish scopes outside explicit non-goal documentation.

## Commit strategy
- Use one conventional commit per todo, in dependency order.
- Recommended branch: `codex/url-demo-asset-generator`.
- Do not auto-commit unless the user requests it. Stage completed files and present draft commit messages when execution finishes.
- Final plan footer for any implementation commit touching this scope: `Plan: .omo/plans/url-demo-asset-generator.md`.
- Expected commits:
  - `feat(demo-assets): add asset generation data contracts`
  - `feat(demo-assets): validate product URLs`
  - `feat(demo-assets): add generation job APIs`
  - `feat(demo-assets): capture product URLs with Playwright`
  - `feat(demo-assets): plan demo creative assets`
  - `feat(demo-assets): gate and shape render plans`
  - `feat(demo-assets): render downloadable demo assets`
  - `feat(demo-assets): add asset generator dashboard`
  - `docs(demo-assets): document asset generator workflow`

## Success criteria
- A product owner can submit a public product URL from the dashboard and receive a durable job ID.
- A worker can process the job without human intervention and produce capture artifacts, a grounded creative plan, rendered MP4 videos, and rendered image assets.
- Default output is 3 vertical demo promo videos plus 6 vertical demo images.
- Every rendered asset is downloadable through an authenticated API route.
- The UI shows empty, in-progress, ready, failed, regenerate, preview, and download states.
- Quality gates prevent ungrounded product claims, missing CTA, invalid capture references, unsafe claims, blank artifacts, and text-overlap risks.
- Existing product creation, Threads generation, and TikTok Video Lab manual-upload behavior still pass their tests.
- Docs and UI make clear that TikTok/YouTube/Instagram auto-posting is not included in the MVP.
- All task-specific tests, full typecheck, lint, build, and browser manual QA pass with evidence files under `.omo/evidence/`.
