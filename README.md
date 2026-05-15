# Threads Uploader

Multi-brand Threads publishing, viral discovery, and growth-learning dashboard.

## What It Does

- Manage multiple brands, each with its own Threads credentials and AI content settings.
- Generate batches of Threads posts from brand topics, target audiences, situations, formulas, hooks, and CTA types.
- Publish pending posts manually or via cron.
- Collect Threads metrics and calculate a weighted performance score.
- Discover viral reference posts from brand topics, public Threads profiles, manual imports, and owned post history.
- Manage viral sources per brand: keyword searches, competitor handles, excluded terms, source adapters, and run limits.
- Extract viral hook, emotion, structure, topic, and CTA patterns.
- Learn winning and weak growth patterns, then feed that memory into future AI generation.

## Growth Loop

```
Discover viral references → Learn viral patterns → Generate experiments → Publish → Collect metrics → Learn growth patterns
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

Brand-level `growthMemory` stores the latest winners, weak signals, and next-batch recommendations.
Brand-level `viralMemory` stores viral reference patterns that are injected into future AI generation.

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
- `GET /api/cron/refresh-token` refreshes Threads tokens.
- `GET /api/cron/learn` refreshes brand growth memory from collected metrics.
- `GET /api/cron/viral` discovers viral references and refreshes brand viral memory.

Set `CRON_SECRET` to require `Authorization: Bearer <CRON_SECRET>` or `?secret=` for cron calls.

## Environment

Copy `.env.example` to `.env` and configure:

- `DATABASE_URL`
- `ANTHROPIC_API_KEY`
- `CRON_SECRET`
- Legacy fallback Threads settings if needed

## Database

Prisma schema lives in `prisma/schema.prisma`.

After schema changes:

```bash
npx prisma generate
npx prisma migrate deploy
```
