---
slug: url-demo-asset-generator
status: plan-written
intent: unclear
pending-action: execution may start from .omo/plans/url-demo-asset-generator.md when requested
approach: URL ingestion -> mobile capture -> AI creative plan -> Remotion MP4/still renderer -> asset library/download, with platform upload deferred.
---

# Draft: url-demo-asset-generator

## Components (topology ledger)
<!-- Lock the SHAPE before depth. One row per top-level component that can succeed or fail independently. -->
<!-- id | outcome (one line) | status: active|deferred | evidence path -->
| C1 URL intake and product brief | A user can submit a product URL and get normalized product context plus capture readiness diagnostics. | active | src/lib/product-auto-setup.ts:20-85; Playwright screenshots docs |
| C2 Capture engine | The app captures mobile screenshots, page evidence, and action logs from the URL with deterministic viewport, request blocking, and failure reasons; final videos are rendered by Remotion, not raw Playwright clips. | active | Playwright screenshots docs; reference MOV metadata |
| C3 Creative planner and quality gate | AI turns product/capture evidence into demo-video and demo-image plans with product-specific hooks, CTA, claims guardrails, and reusable templates. | active | docs/api-spec.md:725-870; src/lib/tiktok-video-service.ts |
| C4 Render/export pipeline | The app renders 1080x1920 MP4 plus image assets and stores downloadable artifacts with preview status. | active | Remotion renderer docs; src/lib/tiktok-video-renderer.ts:1-104 |
| C5 Asset library UI | The product dashboard exposes generation jobs, previews, downloads, regeneration, and manual publish copy. | active | docs/api-spec.md:786-794; src/components/Dashboard.tsx TikTok lab surface |
| C6 Platform publishing | Direct TikTok/YouTube upload is documented as a future phase, not included in MVP implementation. | deferred | docs/api-spec.md:891-900; TikTok/YouTube official upload docs |

## Open assumptions (announced defaults)
<!-- Intent is UNCLEAR: research resolves ambiguity, defaults are adopted (not asked), and each is surfaced in the plan's human TL;DR for veto. -->
<!-- assumption | adopted default | rationale | reversible? -->
| MVP output | Generate downloadable assets first: 3 demo videos + 6 demo images per URL, no auto-posting. | Rendering quality and trust matter before platform OAuth/audits; existing app also makes TikTok upload a non-goal. | yes |
| Video format | 1080x1920, 30fps, 25-35s MP4/H.264, with optional WebM preview only for browser-side draft preview. | Reference MOV is 326x614, 32.5s, H.264/AAC vertical screen recording; Shorts/TikTok expect vertical assets. | yes |
| Capture strategy | Use Playwright for mobile screenshots and short capture clips, but use Remotion for final compositing instead of raw browser recording only. | Playwright is good for deterministic page capture; Remotion is better for polished text, timing, stills, and MP4 output. | yes |
| Product source | URL is the primary input; optional manual fields override extracted title/description/CTA. | User asked for URL-based generation; existing product auto-setup already supports product name, description, target, promise, landing URL. | yes |
| Storage/job model | Add first-class asset-generation jobs and assets rather than overloading TikTokVideoDraft. | Existing TikTok draft schema is CosmicPath-specific and WebM/manual-upload oriented. New product has images and URL capture artifacts too. | yes |
| Upload integrations | Defer TikTok Direct Post and YouTube upload until after downloaded asset MVP works. | Both APIs require user OAuth/permissions and may restrict unaudited/unverified apps to private visibility. | yes |
| QA strategy | TDD for parsing/planning/schema; tests-after for UI states; real browser QA for the generation surface and artifact preview/download. | User-visible proof must include actual page flow and generated files, not only green units. | yes |

## Findings (cited - path:lines)
- Skill survey: using `omo:ulw-plan` because the user explicitly requested planning; loosely relevant but not used now: `build-web-apps:frontend-app-builder` and `remotion:remotion-best-practices` fit execution later, while `product-design:*` would fit visual direction after plan approval. This turn remains planner-only.
- Tier: HEAVY. The plan will touch a new asset-generation domain model, URL capture/browser automation, render pipeline, storage/job status, UI surface, and external-platform guardrails.
- Current app already stores product profile/readiness inputs: `src/lib/product-auto-setup.ts:20-85`.
- Current TikTok lab creates draft specs and manual metrics, with endpoints documented at `docs/api-spec.md:786-794`.
- Current TikTok contract explicitly says browser render is WebM and server-side MP4/Remotion/FFmpeg is out of scope for the earlier cycle: `docs/api-spec.md:891-900`. This new work must intentionally change that boundary.
- Current browser renderer uses canvas + MediaRecorder and outputs WebM candidates only: `src/lib/tiktok-video-renderer.ts:37-104`.
- Current TikTok draft DB model is optimized for scripts, captions, quality, and metrics, not URL captures or still images: `prisma/schema.prisma:235-283`.
- `package.json:17-46` does not include Playwright, Remotion, queue, object storage SDK, or image processing dependencies today.
- Reference video metadata: `/Users/kim-young-gwang/Downloads/화면 기록 2025-12-11 오후 9.53.56.MOV` is H.264/AAC, screen recording, 32.5247 seconds, 326x614 vertical.
- Playwright official docs support screenshots with `page.screenshot()` and full-page screenshots: https://playwright.dev/docs/screenshots lines 95-105.
- Playwright official docs support screenshots; raw Playwright video recording is not required for MVP capture because final videos are rendered by Remotion: https://playwright.dev/docs/screenshots lines 95-105.
- Remotion official docs support server-side programmatic rendering through `@remotion/renderer`: https://www.remotion.dev/docs/renderer lines 150-207.
- Remotion `renderMedia()` supports H.264 output and `inputProps` for composition data: https://www.remotion.dev/docs/renderer/render-media lines 151-205.
- TikTok Direct Post requires creator info, init, export, `video.publish` scope, and unaudited clients are private-only: https://developers.tiktok.com/doc/content-posting-api-reference-direct-post lines 282-310.
- YouTube `videos.insert` uploads video with metadata, requires upload authorization scopes, and unverified post-2020 API projects are private-only: https://developers.google.com/youtube/v3/docs/videos/insert lines 181-205.

## Decisions (with rationale)
- Treat the requested product as a new "demo asset generator" module, not a small extension of the existing TikTok lab. Rationale: user needs perfect promo videos and demo images from arbitrary URLs; existing TikTok lab is profile-script-first and CosmicPath-shaped.
- Build in two surfaces: server-side job pipeline for durable assets and browser-facing generation UI for review/regeneration/download. Rationale: rendering can be slow and must survive refreshes.
- Use Playwright capture artifacts as raw material, not the final polished deliverable. Rationale: raw screen recordings look brittle; final marketing quality needs motion design, captions, and still layouts.
- Use Remotion for final video/still output. Rationale: official renderer supports server-side programmatic video and still rendering; it also aligns with React/Next skills already in the project.
- Do not plan automatic TikTok/YouTube publishing in the first execution plan. Rationale: official APIs add OAuth/audit/private-mode constraints and would slow the first useful asset loop.
- Add strict "claim safety" and "visual quality" gates so the generator cannot invent product features, fake UI states, or produce blank/overlapped assets.

## Scope IN
- URL submission flow for an authenticated product owner.
- URL metadata extraction and manual override fields.
- Playwright mobile capture service with screenshots, page evidence, action trace, request blocking, timeouts, and failure states.
- AI creative planner that creates multiple demo video/image concepts from real capture evidence.
- New data contracts for asset jobs, capture artifacts, rendered assets, template/style settings, and quality status.
- Remotion-based renderer for 9:16 MP4 and still image exports.
- Dashboard UI for generate, preview, download, regenerate, and copy caption/hashtags.
- Agent-executed tests and browser QA with evidence files under `.omo/evidence/`.
- Documentation update explaining MVP limits and publish/export workflow.

## Scope OUT (Must NOT have)
- No automatic TikTok/YouTube/Instagram posting in the MVP plan.
- No browser-cookie uploaders, Selenium social posting, scraping private data, DMs, comments, likes, follows, or engagement automation.
- No fake demo screens, invented features, or image-only hallucinated product states when a real URL can be captured.
- No serverless-only assumption for long renders; the plan must allow a worker/queue path.
- No weakening existing TikTok manual-upload guardrails.

## Open questions
- None blocking. Because this was routed UNCLEAR, defaults above are adopted for the approval brief and can be vetoed by the user.

## Approval gate
status: approved-and-written
pending action: execute .omo/plans/url-demo-asset-generator.md only when user requests implementation
brief: Plan a downloadable demo asset generator MVP. URL goes in; the system captures real mobile product footage, plans hooks/CTA from the page, renders polished vertical MP4 plus still images, and exposes preview/download/regenerate in the dashboard. Auto-posting is deferred.
review notes: Initial Metis/Momus/Librarian/Explorer reviews returned ITERATE on fixture lifecycle, SSRF depth, Remotion still rendering, dependency wording, local fixture exceptions, worker locking/storage, scope-fidelity grep, and docs boundary. The plan was patched to address those issues; final local structural checks passed.
<!-- When exploration is exhausted and unknowns are answered, set status: awaiting-approval. -->
<!-- That durable record is the loop guard: on a later turn read it and resume at the gate instead of re-running exploration. -->
