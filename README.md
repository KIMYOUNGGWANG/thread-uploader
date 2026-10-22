# Portfolio Growth OS

Internal growth workspace for promoting my owned products. The database/API still uses the legacy `Brand` name, but the product surface is now organized around product profiles, active experiments, channel content, and weekly evidence loops.

## What It Does

- Manage multiple owned products, each with its own Threads credentials, product positioning, and AI content settings.
- Store a product profile: product name, one-line description, target customer, offer promise, landing URL, positioning notes, primary channel, primary metric, and conversion metric.
- Track the active experiment for each product: hypothesis, stage, 7-day window, primary metric, guardrail metric, and current status.
- Generate batches of Threads posts from product topics, target audiences, situations, formulas, hooks, and CTA types.
- Publish pending posts manually or via cron.
- Collect Threads metrics and calculate a weighted performance score.
- Run 2-hour account intelligence snapshots for reply, format, link-ratio, and quality actions.
- Discover viral reference posts from product topics, public Threads profiles, manual imports, and owned post history.
- Discover related public Threads accounts, approve watch/ignore status, and learn patterns from watched accounts.
- Manage viral sources per product: keyword searches, competitor handles, excluded terms, source adapters, and run limits.
- Extract viral hook, emotion, structure, topic, and CTA patterns.
- Learn winning and weak growth patterns, then feed that memory into future AI generation.
- Show a weekly scorecard on the dashboard: 7-day buckets of published/measured posts, median views, 10k-view breakout rate, click→conversion→paid funnel, linked vs unlinked views, per-formula rows, and one diagnosed bottleneck (sample → ops → reach → conversion) with a next action.
- Show a portfolio overview with experiment status, primary/conversion metrics, quality state, and next action.

## Growth Loop

```
Choose product → Set active experiment → Generate channel content → Review/publish → Enter metrics → Learn → Pick next action
```

The default operating cadence is a 7-day evidence sprint. CosmicPath is one product profile in the portfolio, not the whole product.

Each generated post can store:

- `formulaId`
- `topic`
- `targetAudience`
- `situation`
- `hookType`
- `ctaType`
- `qualityScore`
- `performanceScore`
- `performanceTier`
- `campaignId`
- `campaignFormulaId`
- `qualityProfile`
- `qualityPass`
- `linkUrl`
- `utmContent`

Product-level `brandConfig.productProfile` stores the product context injected into future AI generation.
Product-level `brandConfig.activeExperiment` stores the current test and decision criteria.
Brand-level `growthMemory` stores the latest winners, weak signals, and next-batch recommendations.
Brand-level `viralMemory` stores viral reference patterns that are injected into future AI generation.
`AccountInsight` snapshots store recent account metrics and action recommendations.

## Commands

```bash
npm run dev
npm run test
npm run lint
npm run typecheck
npm run build
```

## Cron Endpoints

- `GET /api/cron/publish` publishes one pending post per product profile. Optional `?brands=slug1,slug2` limits the run. It is the only publisher: GitHub Actions (`.github/workflows/cron.yml`) calls it hourly with `?slots=` (UTC hours), and the route publishes at most once per slot while the slot's 3-hour window is open, so late GitHub runs still post. Daily trust-tier quotas (newbie 1 / warming 2 / established 5 / authority 8, reset at KST midnight) skip the run with `daily_quota_reached` instead of demoting the post.
- `GET /api/cron/refresh-token` refreshes Threads tokens when they are within 14 days of expiry.
- `GET /api/cron/fetch-metrics` collects Threads insights (6h–14d posts, uncollected and 72h-mature first) and rescoring keeps click/conversion weight. A post Threads reports as deleted (400 "does not exist") is set to `ARCHIVED` with an `errorLog` instead of failing every run.
- `GET /api/cron/learn` refreshes product growth memory from collected metrics. Ranking follows `brandConfig.optimizationGoal` (settings → 캠페인 탭 → 학습 목표): `reach` (default) promotes, auto-queues and samples formulas by views; `conversion` uses the revenue-weighted score. Formula weights and Thompson priors are rebuilt from the recent window each run (never stacked on stored values). `growthMemory.formulaWinners` (formula-level, 2+ posts at or above the brand average) is what lets generated drafts skip review. GitHub Actions (`fetch-metrics.yml`) runs both daily at UTC 12:00.
- `GET /api/cron/viral` discovers viral references, has Claude analyze the top 10 not-yet-analyzed references, and refreshes product viral memory (keeping the feedback-owned top performers). External posts carry no engagement counts, so TOP-search rank, keyword overlap, and repeat sightings feed their score. GitHub Actions (`viral.yml`) runs it hourly.
- `GET /api/cron/trends?brands=slug` (brands required) harvests the last 72h of Korean community tension from two sources — Threads keyword search with the brand's own token (per-domain keywords, 72h window, ranked by TOP-search placement and keyword overlap since the public API exposes no engagement counts, usernames stripped) and Claude (Sonnet) web search — transposes it into brand hooks, and stores `brandConfig.trendRadar`, which generation injects as timely material. GitHub Actions (`trends.yml`) runs it daily at KST 06:29 for `vars.TREND_BRAND_SLUGS` (default `cosmicpath`).
- `GET /api/cron/refill?brand=slug&target=N` tops a product's backlog (PENDING + NEEDS_REVIEW) up to `target`, at most 6 drafts per run, through the same generation pipeline as the dashboard. Drafts from unproven formulas still land in NEEDS_REVIEW, and campaign starts are never auto-approved. GitHub Actions (`refill.yml`) runs it daily at KST 07:13, right after the trend radar.
- `GET /api/cron/account-intelligence` refreshes 48-hour account insight snapshots, intended for a 2-hour cadence.
- `GET /api/cron/shorts/discover?brands=slug1,slug2` harvests YouTube Shorts published in the last 48h for each product's `viralDiscovery.youtube` keywords (falls back to the first 3 product topics) and channel handles, keeping videos ≤ `maxDurationSec` (default 180s), and stores them as `ViralExample` rows with `source = youtube_shorts`. Without `?brands=` it runs every product whose `youtube_shorts` adapter is enabled. Costs ~620 quota units per product per run (search.list is 100 units; capped at 8 searches). GitHub Actions (`shorts.yml`) runs it every 6 hours at `:07` for `vars.SHORTS_BRAND_SLUGS` (default `cosmicpath`). Shorts never feed Threads learning: `learn`, `viral` analysis and the viral report exclude `source = youtube_shorts`.
- `GET /api/cron/shorts/snapshot` re-reads statistics for shorts published in the last 72h (one `videos.list` per 50 ids), records an hourly `ViralExampleSnapshot`, recomputes `velocityScore` as views-per-hour over the last 6h window, and deletes shorts older than 7 days (YouTube API caching terms). GitHub Actions (`shorts.yml`) runs it hourly at `:37`. The feed is at `/brands/[slug]/shorts`, sorted by `velocityScore` with 24h/48h and 국내/해외 filters.

Token refresh and account intelligence cadences are registered through `vercel.json` as daily Vercel Cron Jobs.
The cron publish route refreshes tokens at the publish boundary via `getFreshBrandCredentials`. Vercel Cron only runs the daily feedback job (Hobby allows daily schedules only).
Set `CRON_SECRET` to require `Authorization: Bearer <CRON_SECRET>` for cron calls (query-string secrets are rejected).

## Environment

Copy `.env.example` to `.env` and configure:

- `DATABASE_URL`
- `ANTHROPIC_API_KEY`
- `CRON_SECRET`
- `ENCRYPTION_KEY` (required: session signing + token encryption, never reuse `CRON_SECRET`)
- `CONVERSION_WEBHOOK_SECRET` (server-only; required for paid events sent to `/api/webhooks/conversion` via `x-webhook-secret` header. Browser tracker sends click/conversion only)
- `YOUTUBE_API_KEY` — YouTube Data API v3 key for the shorts radar; optional, adapter is off by default.
- Optional `APP_URL` GitHub repository variable for the manual account intelligence workflow fallback. Defaults to `https://thread-uploader.vercel.app`.
- Use the manual GitHub workflow or another external scheduler for sub-daily account intelligence on Vercel Hobby.
- Legacy fallback Threads settings if needed

## Non-Goals

- No external team onboarding or customer workspace is part of this cycle.
- No payment, plan, or seat-management surface is part of this cycle.
- TikTok and other channels remain manual-upload workflows unless a separate approved integration is implemented.

## Database

Prisma schema lives in `prisma/schema.prisma`.

After schema changes:

```bash
npx prisma generate
npx prisma migrate deploy
```
