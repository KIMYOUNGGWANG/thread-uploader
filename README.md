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
npm run refresh:tokens
npm run growth:metrics
```

## Cron Endpoints

- `GET /api/cron/publish` publishes one pending post per product profile.
- `GET /api/cron/refresh-token` refreshes Threads tokens when they are within 14 days of expiry.
- `GET /api/cron/learn` refreshes product growth memory from collected metrics.
- `GET /api/cron/viral` discovers viral references and refreshes product viral memory.
- `GET /api/cron/account-intelligence` refreshes 48-hour account insight snapshots, intended for a 2-hour cadence.

Token refresh and account intelligence cadences are registered through `vercel.json` as daily Vercel Cron Jobs.
The standalone publisher calls `scripts/refresh-token-standalone.js` before posting, so GitHub Actions publishing uses refreshed DB tokens without a separate workflow permission.
Set `CRON_SECRET` to require `Authorization: Bearer <CRON_SECRET>` or `?secret=` for cron calls.

## Environment

Copy `.env.example` to `.env` and configure:

- `DATABASE_URL`
- `ANTHROPIC_API_KEY`
- `CRON_SECRET`
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
