# Threads Uploader

Multi-brand Threads publishing, campaign experimentation, viral discovery, and growth-learning dashboard.

## What It Does

- Manage multiple brands, each with its own Threads credentials and AI content settings.
- Generate batches of Threads posts from brand topics, target audiences, situations, formulas, hooks, and CTA types.
- Publish pending posts manually or via cron.
- Collect Threads metrics and calculate a weighted performance score.
- Run 2-hour account intelligence snapshots for reply, format, link-ratio, and quality actions.
- Discover viral reference posts from brand topics, public Threads profiles, manual imports, and owned post history.
- Discover related public Threads accounts, approve watch/ignore status, and learn patterns from watched accounts.
- Manage viral sources per brand: keyword searches, competitor handles, excluded terms, source adapters, and run limits.
- Extract viral hook, emotion, structure, topic, and CTA patterns.
- Learn winning and weak growth patterns, then feed that memory into future AI generation.

## Growth Loop

```
Discover viral references → Learn viral patterns → Generate campaign experiments → Publish → Account intelligence → Learn growth patterns
```

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

Brand-level `growthMemory` stores the latest winners, weak signals, and next-batch recommendations.
Brand-level `viralMemory` stores viral reference patterns that are injected into future AI generation.
`AccountInsight` snapshots store recent account metrics and action recommendations.

## Commands

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
npm run growth:metrics
```

## Cron Endpoints

- `GET /api/cron/publish` publishes one pending post per brand.
- `GET /api/cron/refresh-token` refreshes Threads tokens when they are within 14 days of expiry.
- `GET /api/cron/learn` refreshes brand growth memory from collected metrics.
- `GET /api/cron/viral` discovers viral references and refreshes brand viral memory.
- `GET /api/cron/account-intelligence` refreshes 48-hour account insight snapshots, intended for a 2-hour cadence.

Token refresh and account intelligence cadences are registered through `vercel.json` as daily Vercel Cron Jobs.
Set `CRON_SECRET` to require `Authorization: Bearer <CRON_SECRET>` or `?secret=` for cron calls.

## Environment

Copy `.env.example` to `.env` and configure:

- `DATABASE_URL`
- `ANTHROPIC_API_KEY`
- `CRON_SECRET`
- Optional `APP_URL` GitHub repository variable for the manual account intelligence workflow fallback. Defaults to `https://thread-uploader.vercel.app`.
- Use the manual GitHub workflow or another external scheduler for sub-daily account intelligence on Vercel Hobby.
- Legacy fallback Threads settings if needed

## Database

Prisma schema lives in `prisma/schema.prisma`.

After schema changes:

```bash
npx prisma generate
npx prisma migrate deploy
```
