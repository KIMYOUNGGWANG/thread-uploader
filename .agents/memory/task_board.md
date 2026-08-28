# Task Board

> Updated: 2026-06-04

---

## Mission

**Portfolio Growth OS.**

`threads-uploader` is being repositioned from a CosmicPath-only Threads/TikTok tool into an internal workspace for promoting owned products. CosmicPath remains one product profile; future products should be added as separate product cards with their own positioning, active experiment, metrics, and channel loop.

Operating loop:

`Product Profile -> Active Experiment -> Generate channel content -> Review/publish -> Manual metrics -> Growth learning -> Next action`

**Revenue OS mode:** `viral-content` + `landing-test`

**Active experiment:** `portfolio_growth_os`

**Default cadence:** 7-day evidence sprint

---

## Scope

### Now

1. Add product profile and active experiment fields to the existing Brand config.
2. Preserve legacy `Brand` API and DB naming while changing the user-facing surface to products.
3. Add `product_growth` quality profile for non-CosmicPath products.
4. Inject product and experiment context into AI generation.
5. Add a Portfolio Overview to the dashboard with primary metric, conversion metric, evidence state, and next action.
6. Seed fixed QA products for stable manual/browser validation.
7. Update README, API spec, screen flow, and task board to match the internal product portfolio direction.

### Later

- Split large dashboard/settings components into smaller feature modules.
- Add a product preset library for each owned product.
- Add cross-channel comparison across Threads, TikTok, email, and manual launches.
- Add richer experiment decision records after each 7-day sprint.
- Add automatic conversion attribution only after landing/product analytics are ready.

### Out of Scope

- External team onboarding.
- Payment, pricing, tenant management, or customer workspaces.
- Automatic comments, DMs, follows, likes, or engagement automation.
- TikTok cookie/session automation.
- Cosmetic redesign unrelated to the product growth workflow.

---

## Implementation Steps

| # | Work | Status | Contract Surface |
|---|------|--------|------------------|
| 1 | Add Vitest and baseline tests | Done | Test Infrastructure |
| 2 | Add product profile and active experiment contracts | Done | Brand Config |
| 3 | Add fixed QA seed harness | Done | QA Data |
| 4 | Add `product_growth` quality profile | Done | Quality Gate |
| 5 | Add Product Settings tab | Done | Settings UI |
| 6 | Rebrand app shell from brand-only to product portfolio | Done | UI Copy |
| 7 | Make generation product-aware | Done | Generate API |
| 8 | Add Portfolio Overview | Done | Dashboard |
| 9 | Add summary metrics and next action | Done | Campaign Summary API |
| 10 | Create product defaults on new product creation | Done | Product Create Flow |
| 11 | Refresh operator docs and final QA | Done | Docs + Validation |

---

## Validation

```bash
npm run test
npm run typecheck
npm run lint
npm run build
```

Manual validation:

- `/brands` shows product language for empty, create, and list states.
- `/brands/[slug]/settings` exposes Product Profile and Active Experiment fields.
- New product creation writes default `productProfile` and `activeExperiment`.
- `/api/campaigns/summary` returns product profile, active experiment, metric tiles, evidence state, and next action.
- Generation prompt includes product name, target customer, offer promise, landing URL, and experiment hypothesis.
- Generic content fails `product_growth`.
- Existing `saju_viral` and `career_decision` checks still pass/fail as expected.

---

## Risks & Open Questions

| Risk | Response |
|------|----------|
| Legacy `Brand` API naming can confuse operators | Keep route compatibility, but use product wording in UI/docs |
| Product prompts can become generic without enough profile detail | Product Settings requires concrete target, offer, and positioning notes |
| Large existing settings/dashboard files are harder to maintain | Split new functionality into smaller modules first; schedule deeper refactor later |
| Manual metrics may be skipped | Dashboard next action should keep the 7-day evidence loop visible |
| CosmicPath-specific defaults may leak into other products | `product_growth` tests cover non-CosmicPath pass/fail behavior |

---

## Artifacts

- `README.md` — operator overview and commands
- `docs/api-spec.md` — Portfolio Growth OS API contracts
- `docs/screen-flow.md` — product portfolio screen/state flow
- `.omo/plans/portfolio-growth-os.md` — Momus-reviewed implementation plan


---

## CosmicPath Rebranding — 5-Engine VIP Decision Dossier (2026-08-27)

**Mission:**
- Complete pivot from casual fortune/tarot to 5-Engine Executive Decision Dossier (사주·점성술·자미두수·태국왕실점성술·수비학 + 진태양시 30분 보정).
- Stunt-driven launch on Threads:
  1. Scandal Flip: 결제율 1위 타로 전면 폐기
  2. Industry Secret: 진태양시 30분 왜곡 폭로
  3. Common Enemy: 이직할 때 좋은 기운 온다는 가짜 위로 거르기

**Implementation Steps:**

| # | Work | Status | Surface |
|---|------|--------|---------|
| 1 | OMA 1차(베이스라인), 2차(엔지니어링/안전), 3차(프로덕트/Roy Scale) 검증 | Done | Verification |
| 2 | Brand Memory (.agent/memory/brand-voice.md) 5대 엔진 전면 갱신 | Done | Memory |
| 3 | Revenue OS experiment (five_engine_vip_dossier.json) 생성 | Done | Revenue OS |
| 4 | DB Brand (slug: cosmicpath) productProfile, systemPrompt, topics, campaign 업데이트 | Done | PostgreSQL |
| 5 | generate-batch.mjs 및 quality-gate.ts 5대 엔진 키워드 연동 및 타로 레거시 제거 | Done | Scripts / Quality |
| 6 | 런칭 3대 스턴트 포스트 작성 및 DB 큐 등록 (Ready to Publish) | Done | Content Output |
| 7 | 회귀 검증 및 최종 리포트 작성 | Done | Test / Ship |
