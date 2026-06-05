---
name: vercel-deployment
description: CI/CD 파이프라인, Docker 컨테이너화, 배포 전략 (블루-그린, 카나리, 롤링), 헬스체크, 롤백, 프로덕션 준비 체크리스트. 배포 설정, 파이프라인 구축, 프로덕션 릴리즈 준비 시 사용.
source: vibeship-spawner-skills / ECC
risk: safe
---

# Deployment Patterns

Production deployment workflows and CI/CD best practices.

## When to Activate

- Setting up CI/CD pipelines
- Dockerizing an application
- Planning deployment strategy (blue-green, canary, rolling)
- Implementing health checks and readiness probes
- Preparing for a production release
- Configuring environment-specific settings

## Deployment Strategies

### Rolling Deployment (Default)

Replace instances gradually — old and new versions run simultaneously during rollout.

**Pros:** Zero downtime, gradual rollout
**Cons:** Two versions run simultaneously — requires backward-compatible changes
**Use when:** Standard deployments, backward-compatible changes

### Blue-Green Deployment

Run two identical environments. Switch traffic atomically.

```
Blue  (v1) ← traffic
Green (v2)   idle, running new version

# After verification:
Blue  (v1)   idle (becomes standby)
Green (v2) ← traffic
```

**Pros:** Instant rollback (switch back to blue), clean cutover
**Cons:** Requires 2x infrastructure during deployment
**Use when:** Critical services, zero-tolerance for issues

### Canary Deployment

Route a small percentage of traffic to the new version first.

```
v1: 95% of traffic
v2:  5% of traffic  (canary)

# If metrics look good:
v2: 100% of traffic
```

**Pros:** Catches issues with real traffic before full rollout
**Cons:** Requires traffic splitting infrastructure, monitoring
**Use when:** High-traffic services, risky changes, feature flags

## Docker

### Multi-Stage Dockerfile (Node.js / Next.js)

```dockerfile
# Stage 1: Install dependencies
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Stage 2: Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# Stage 3: Production image
FROM node:22-alpine AS runner
WORKDIR /app

RUN addgroup -g 1001 -S appgroup && adduser -S appuser -u 1001
USER appuser

COPY --from=builder --chown=appuser:appgroup /app/.next ./.next
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/package.json ./

ENV NODE_ENV=production
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
```

### Docker Best Practices

```
GOOD practices:
- Use specific version tags (node:22-alpine, not node:latest)
- Multi-stage builds to minimize image size
- Run as non-root user
- Copy dependency files first (layer caching)
- Use .dockerignore to exclude node_modules, .git, tests
- Add HEALTHCHECK instruction

BAD practices:
- Running as root
- Using :latest tags
- Copying entire repo in one COPY layer
- Installing dev dependencies in production image
- Storing secrets in image (use env vars or secrets manager)
```

## CI/CD Pipeline

### GitHub Actions (Standard Pipeline)

```yaml
name: CI/CD

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test -- --coverage
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage
          path: coverage/

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: production
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Vercel
        run: vercel --prod --token=${{ secrets.VERCEL_TOKEN }}
```

### Pipeline Stages

```
PR opened:
  lint → typecheck → unit tests → integration tests → preview deploy

Merged to main:
  lint → typecheck → unit tests → build → deploy staging → smoke tests → deploy production
```

## Health Checks

### Health Check Endpoint

```typescript
// src/app/api/health/route.ts
export async function GET() {
  return Response.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || 'unknown',
  })
}

// Detailed health check (internal monitoring)
export async function GET(request: Request) {
  const url = new URL(request.url)
  if (url.searchParams.get('detailed') !== 'true') {
    return Response.json({ status: 'ok' })
  }

  const dbCheck = await checkSupabase()

  return Response.json({
    status: dbCheck.ok ? 'ok' : 'degraded',
    checks: { database: dbCheck },
    uptime: process.uptime(),
  }, { status: dbCheck.ok ? 200 : 503 })
}
```

## Environment Configuration

### Vercel Env Vars Pattern

```bash
# .env.local (never commit)
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key  # Never NEXT_PUBLIC_

# Vercel Dashboard: Settings → Environment Variables
# Set different values for Production / Preview / Development
```

### Vercel Sharp Edges

| Issue | Severity | Solution |
|-------|----------|----------|
| `NEXT_PUBLIC_` exposes secrets to browser | CRITICAL | Only use for truly public values |
| Preview deployments using production database | HIGH | Set up separate test database |
| Serverless function too large, slow cold starts | HIGH | Reduce bundle, use Edge runtime |
| Function timeout causes incomplete operations | MEDIUM | Handle long ops with background jobs |
| Environment variable missing at runtime | MEDIUM | Check build vs runtime env var access |

### Configuration Validation

```typescript
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
})

// Validate at startup — fail fast if config is wrong
export const env = envSchema.parse(process.env)
```

## Rollback Strategy

### Instant Rollback

```bash
# Vercel: promote previous deployment
vercel rollback

# Or via dashboard: Deployments → Select previous → Promote to Production

# Database: rollback migration (if reversible)
# WARNING: Only if migration is backwards-compatible
```

### Rollback Checklist

- [ ] Previous deployment is available in Vercel dashboard
- [ ] Database migrations are backward-compatible (no destructive changes)
- [ ] Feature flags can disable new features without deploy
- [ ] Monitoring alerts configured for error rate spikes
- [ ] Rollback tested in staging before production release

## Production Readiness Checklist

Before any production deployment:

### Application
- [ ] All tests pass (unit, integration, E2E)
- [ ] No hardcoded secrets in code or config files
- [ ] Error handling covers all edge cases
- [ ] Health check endpoint returns meaningful status
- [ ] `pnpm typecheck` — no errors
- [ ] `pnpm lint` — no warnings/errors

### Infrastructure
- [ ] Environment variables documented and set in Vercel
- [ ] Separate databases for production/preview/development
- [ ] SSL/TLS enabled (automatic on Vercel)

### Monitoring
- [ ] Vercel Analytics enabled
- [ ] Error tracking set up (Sentry or similar)
- [ ] Uptime monitoring on health endpoint

### Security
- [ ] Dependencies scanned for CVEs (`pnpm audit`)
- [ ] RLS enabled on all Supabase tables
- [ ] Rate limiting enabled on public endpoints
- [ ] Authentication and authorization verified
- [ ] No service role key exposed to client

### Operations
- [ ] Rollback plan documented and tested
- [ ] Database migration tested against production-sized data
