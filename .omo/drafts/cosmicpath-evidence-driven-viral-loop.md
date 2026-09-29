---
slug: cosmicpath-evidence-driven-viral-loop
status: approved
intent: clear
review_required: false
plan_path: .omo/plans/cosmicpath-evidence-driven-viral-loop.md
approach: 1,600 live posts backed 4 verified reach families (Scenario Dilemma 4 : Concept Hierarchy 4 : Identity Profile 4 : Relationship Tension 3) with 100% first-comment product bridges and zero schema overhead.
---

# Draft: cosmicpath-evidence-driven-viral-loop

## Components (topology ledger)
<!-- Lock the SHAPE before depth. One row per top-level component that can succeed or fail independently. -->
<!-- id | outcome (one line) | status: active|deferred | evidence path -->

| id | outcome | status | evidence path |
| --- | --- | --- | --- |
| C1 | Every generated post belongs to one immutable, expiring experiment run with a frozen strategy snapshot. | active | `src/types/product-profile.ts:19-29`, `prisma/schema.prisma:20-101` |
| C2 | Threads and conversion metrics are collected at comparable post ages with an explicit completeness state before learning. | active | `src/app/api/cron/fetch-metrics/route.ts:40-74`, `scripts/fetch-metrics-standalone.js:68-112` |
| C3 | CosmicPath generation uses first-party validated reach families, a separate product-bridge variable, stable audience keys, and enforceable novelty/brand-voice constraints. | active | user-provided live Top 30 snapshot (2026-09-20), `src/app/api/generate/route.ts:354-540`, `src/lib/context-matrix-engine.ts:241-266`, `src/lib/domain-registry.ts:35-126` |
| C4 | One versioned reward and one reversible decision service control routing; competing direct weight writers are removed or routed through it. | active | `src/lib/growth-learning.ts:30-50`, `src/lib/growth-service.ts:29-132`, `src/app/api/generate/optimize/route.ts:29-114` |
| C5 | The existing dashboard shows experiment window, metric coverage, mature results, decisions, rollback, and the next operator action. | active | `src/app/api/campaigns/summary/route.ts:51-157`, `src/components/Dashboard.tsx:951-1225` |
| C6 | Nullable migration, legacy compatibility, agent-run tests, HTTP/browser QA, and current-strategy documentation protect rollout. | active | `docs/cosmicpath-viral-playbook.md:31-71`, `docs/screen-flow.md:47-64`, `.omo/evidence/final-manual-qa.md:1-47` |

## Open assumptions (announced defaults)
<!-- Record any default you adopt instead of asking, so the user can veto it at the gate. -->
<!-- assumption | adopted default | rationale | reversible? -->

| assumption | adopted default | rationale | reversible? |
| --- | --- | --- | --- |
| Optimization objective | Product-qualified virality: conversions/link visits are the outcome; reach, replies, reposts, and qualified profile interest are leading signals. | The user said this tool exists to promote their own products, so raw views alone are not the business goal. | yes, per run |
| Initial rollout | Shared experiment primitives remain reusable, but the first active run is CosmicPath only; other brands keep current behavior until explicitly enrolled. | Current performance evidence and strategy drift are CosmicPath-specific. | yes |
| Audience | Reach targets Korean adults already interested in astrology-based self-identification and relationship dynamics. Career/decision framing enters only as a product bridge instead of being injected into every reach post. Dynamic tech-founder/investor persona mixing is disabled inside the run. | The first-party Top 30 is dominated by concrete astrology identity and relationship hooks; generic career posts are absent from the strongest cohort. | yes, by starting a new run |
| Test cadence | A 21-day run publishes 15 original Threads posts at a fixed five posts/week cadence. The initial balanced allocation is 4 vivid scenario dilemmas, 4 concept hierarchies, 4 concrete identity profiles, and 3 relationship-tension posts. This allocation is an experiment seed, not a permanent quota; later runs use the bounded self-learning policy. | Five posts/week matches Meta's recommended range and gives each reach family at least three observations while preserving the strongest two first-party hypotheses. | yes, new run |
| Bridge exposure | All 15 posts stay product-relevant, but only 5 of 15 receive a direct first-comment link using the existing one-in-three cadence. The remaining 10 use conversation-first comments without a URL. Direct-link assignment rotates across creative families and every link carries post-level attribution (`postId`/`utm_content` or the existing tracked redirect) to the same CosmicPath destination. | A 15/15 identical bridge leaves no reach/conversation control group, prevents the learner from estimating link impact, and weakens per-post attribution. | yes, future runs may increase or decrease cadence |
| Observation windows | Persist 24-hour, 72-hour, and 7-day snapshots; no routing update until required snapshots are complete or explicitly marked unavailable. | Comparable post age prevents immature posts from contaminating learning. | yes |
| Scoring | Treat the existing algorithmic score as a deterministic content lint only; remove the unsupported escape-velocity probability claim. Use one versioned run reward normalized by views and aligned to the run's declared objective. | Current regex score and three competing learners are not calibrated to account outcomes. | yes, score versioned |
| Adaptive routing | Start the corrected run with fixed allocation and learning decisions in dry-run; enable Thompson-based allocation only after the run meets maturity and sample thresholds. The Top 30 supplies hypotheses, not hard-coded priors. | Existing priors are hand-set and can dominate sparse evidence; historical winners have unequal ages and are not randomized trials. | yes |
| Self-learning activation | Run 1 produces a recommendation-only `LearningDecision`. Automatic bounded application begins only after two completed runs, at least 30 mature posts total, at least 5 mature posts per active creative family, and complete required metric windows. | This preserves real self-learning while preventing one lucky viral outlier from rewriting the account strategy. | yes, operator can keep dry-run mode |
| Self-learning authority | The learner may adjust structured routing weights for `creativeFamilyKey`, `topicKey`, `funnelStageKey`, and publishing slot. It may not rewrite brand voice, safety rules, product positioning, or raw prompts autonomously. | Performance optimization is reversible; brand and safety ownership remains explicit. | yes |
| Learning guardrails | Each decision changes a family weight by at most one step, preserves at least 20% exploration, caps one family at 30% of allocation, never drops an active family to zero from one run, and stores before/after state for rollback. | Prevents premature monoculture and makes every automated change auditable. | yes, versioned policy |
| Reuse policy | Reuse a validated pattern family after a cooldown, but block exact or near-exact body copies. Same-family hooks are warnings unless the normalized content fingerprint matches. | Concept hierarchy reproduced at 122,288, 40,423, and 22,593 views; an overly broad semantic duplicate gate would suppress a proven reusable family. | yes |
| Scheduling | Use one authenticated daily server-side learning cycle as canonical; keep manual invocation as recovery and demote GitHub Actions/standalone scripts to wrappers over the same service. | The GitHub metrics workflow is disabled for inactivity and current duplicate collectors drift. | yes |
| Topic tags | Record intended topic-tag metadata and expose a manual publishing checklist when the API cannot set the tag; do not claim API support without a verified contract. | Meta reports tagged topics generally receive more views, but automation support is not established in this repo. | yes |
| Engagement automation | No auto-like, auto-follow, auto-DM, synthetic engagement, or mandatory auto-reply. Conversation support remains human-reviewed. | Preserves product scope and platform safety. | yes |
| Verification | Tests-after for existing modules plus route/component regression tests for new boundaries; agent-run HTTP and browser QA; no production build command unless the user separately authorizes a build. | Repository governance forbids an unrequested build and existing behavior already has test fixtures. | yes |

## Findings (cited - path:lines)

- The user supplied a first-party live Top 30 snapshot on 2026-09-20. The top post is a vivid lottery scenario dilemma at 299,183 views with 1,533 replies. Concept hierarchy reproduced at 122,288, 40,423, and 22,593 views, demonstrating a reusable family rather than a one-off.
- The same cohort is dominated by concrete astrology entities and identity/relationship tension: 도화, 홍염, 화개, specific 살/일주/지지, 궁합, 전 연인, and vivid forced-choice situations. Generic career-warning content is absent from the strongest 30.
- The latest concept-hierarchy post matured from the previously inspected 13,988 views to the user's current 22,593 views. This confirms that one mutable `Post.views` value is insufficient for fair comparisons and strengthens the need for age-normalized snapshots.
- The previous completed plan, `.omo/plans/cosmicpath-viral-upgrade.md`, made generic self-classification the primary direction. Evidence now distinguishes two behaviors: repeated thin A/B/C template bodies were weak, while a vivid, concrete scenario with choices reached 299,183 views. The new plan preserves `scenario_dilemma` and removes generic checkbox-style self-classification as a default.
- Several high-view rows use absolute relationship decisions, future rewards, or contact-timing claims. Reach evidence does not override CosmicPath's safety and brand constraints; the plan keeps the pattern mechanics while rejecting deterministic promises and unsupported factual statistics.
- `ActiveExperiment` contains `startedAt`, `durationDays`, and `status`, but no expiry resolver or durable historical run (`src/types/product-profile.ts:19-29`). Posts store campaign/formula/audience labels but no immutable experiment/config snapshot (`prisma/schema.prisma:44-101`).
- Generation randomly samples configured targets/situations and enriches them with matrix personas (`src/app/api/generate/route.ts:371-378`; `src/lib/context-matrix-engine.ts:241-266`), while learning later infers personas with substring matching (`src/lib/growth-feedback-loop.ts:161-181`).
- The production generation route duplicates helpers also present in `src/lib/generation-engine.ts`, creating drift (`src/app/api/generate/route.ts:354-540`; `src/lib/generation-engine.ts:68-249`).
- The current algorithm score rewards regex-visible questions/choices and invents a logistic escape probability (`src/lib/threads-algorithm-scorer.ts:90-156`, `247-257`); it is not fitted to account performance.
- Formula weights, context weights, and Thompson priors can be overwritten by learning (`src/lib/growth-service.ts:57-132`), while `/api/generate/optimize` separately overwrites formula weights (`src/app/api/generate/optimize/route.ts:80-114`). Generation switches authority based on whether priors exist (`src/app/api/generate/route.ts:878-895`).
- Metrics collectors update only the latest counters, cap each pass, and do not expose coverage/cursor state (`src/app/api/cron/fetch-metrics/route.ts:40-74`; `scripts/fetch-metrics-standalone.js:68-130`). The standalone path recomputes score without preserved conversion counters (`scripts/fetch-metrics-standalone.js:19-27`, `96-111`).
- Campaign reporting covers today's activity, not the experiment window (`src/app/api/campaigns/summary/route.ts:20-29`, `66-73`), and analytics averages raw values without post-age normalization (`src/app/api/analytics/route.ts:20-78`).
- Brand settings and adaptive learning both rewrite mutable `brandConfig` JSON without an optimistic version check (`src/app/api/brands/[id]/route.ts:68-87`; `src/lib/growth-service.ts:115-132`).
- The checkout is heavily dirty across schema, generation, learning, routes, tests, and content. Execution must preserve all unrelated changes, pin the starting state, and never reset or bulk-format the worktree.
- Official Meta guidance says replies account for almost half of Threads views, conversation-driving posts are more likely to be recommended, original Threads-native content performs well, and at least 2-5 posts/week is recommended for audience growth: `https://about.fb.com/news/2024/10/find-your-community-with-new-threads-educational-insights/`.
- Meta's current Insights guidance supports views/interactions over 7-90 days, discovery surfaces, link visits, weekly recaps, and reports that tagged-topic posts generally receive more views: `https://about.fb.com/news/2025/03/new-threads-features-more-personalized-experience-you-control/`.

## Decisions (with rationale)

- Use a minimal relational experiment ledger around the existing Next.js/Prisma architecture, not a new analytics service.
- Add immutable `ExperimentRun` and `LearningDecision` records plus nullable post attribution/snapshot fields; legacy posts remain `unattributed` instead of being assigned fabricated runs.
- Freeze a normalized strategy snapshot and hash per run. A strategy hash change completes/supersedes the active run rather than blending cohorts.
- Separate editable strategy from learner-owned routing state. Apply routing decisions transactionally with optimistic concurrency and retain before/after state for rollback.
- Centralize generation experiment construction and prompt context in one module; the route becomes orchestration rather than a second implementation.
- Persist stable `audienceKey`, `creativeFamilyKey`, `funnelStageKey`, `variantKey`, and `contentFingerprint`; display prose remains readable but is not used as the experimental key.
- Enforce exact-content protection across concurrent batch siblings through fingerprint reservation/uniqueness. Use semantic similarity plus cooldown as a warning/review rule so validated pattern families can be reproduced without copy-pasting bodies.
- Centralize metric collection and score recomputation so API, cron, and standalone entry points call the same service.
- Make run decisions in dry-run until all maturity, completeness, and sample gates pass; do not silently rewrite live routing state from incomplete evidence.
- After the activation gate passes, run a bounded self-learning cycle: mature snapshots and conversions -> age-normalized observations -> run report -> immutable `LearningDecision` -> guarded routing-state update for the next run. Persist the exact evidence cutoff, score version, before/after weights, application status, and rollback link.
- Attribute learning to structured dimensions (`creativeFamilyKey`, `topicKey`, `funnelStageKey`, publishing slot) instead of mutable audience prose. Keep cross-dimension interaction learning disabled until each combination has sufficient mature observations.
- Score reach relative to the account's same-age baseline, measure conversation with reply/repost rates, and treat link visits/conversions as the qualified-attention objective. A single raw-view outlier cannot independently trigger an automatic weight change.
- Generate a next-run allocation proposal after the first completed run even though it remains recommendation-only; surface the reasons and predicted tradeoffs in the dashboard so the operator can apply it manually before full auto-apply becomes eligible.
- Replace the previous 28-post generic A/B/C-heavy sprint documentation with the first-party-evidence-driven 21-day qualified-virality protocol.

## Scope IN

- Prisma migration and backward-compatible nullable attribution for experiment runs, metric snapshots, learning decisions, stable variant/audience keys, and content fingerprints.
- Experiment lifecycle, expiry, supersede behavior, config hashing, optimistic concurrency, dry-run/apply/rollback decision flow.
- One canonical metric/learning service and one canonical scheduler path with coverage reporting and recovery invocation.
- CosmicPath generation strategy correction around four validated reach families, separate funnel-stage allocation, stable audience/variant keys, brand-voice enforcement, and concurrency-safe novelty checks.
- Versioned reward/scoring authority and retirement/rerouting of competing autonomous writers.
- Experiment-window analytics and dashboard states for learning, incomplete, mature, applied, rolled back, completed, and superseded runs.
- Regression tests, migration tests, HTTP scenarios, browser QA, and updated operator/API/screen-flow documentation.

## Scope OUT (Must NOT have)

- No separate event-streaming/analytics platform, warehouse, or third-party experimentation SaaS.
- No invented historical experiment backfill and no learning from unattributed legacy posts by default.
- No changes to TikTok generation/upload workflows except preserving existing behavior.
- No automatic public engagement, synthetic replies, DMs, follows, or account-growth hacks.
- No claim that a heuristic score predicts virality; no fabricated probability labels.
- No forced rollout to non-CosmicPath brands.
- No destructive cleanup, reset, reformat, or overwrite of the current dirty worktree.
- No production build during plan execution unless separately authorized by the user.

## Open questions

None. All discoverable facts were resolved from the repository, current account evidence, and official Meta guidance; reversible implementation choices use the defaults above.

## Approval gate
status: awaiting-approval
approach: Add a minimal immutable experiment ledger and metric snapshot layer around the existing system; run a fixed 21-day, 15-post protocol across vivid dilemmas, concept hierarchies, concrete identity profiles, and relationship tensions while treating product bridging as a separate variable; consolidate scoring and learning into one reversible authority; and expose completeness/decisions in the existing dashboard.
next-action: On explicit approval of this revised brief, structurally reset the stale pre-change plan skeleton at `.omo/plans/cosmicpath-evidence-driven-viral-loop.md`, run mandatory Metis gap analysis, append decision-complete todos, then offer execution or optional dual high-accuracy review.
<!-- When exploration is exhausted and unknowns are answered, set status: awaiting-approval. -->
<!-- That durable record is the loop guard: on a later turn read it and resume at the gate instead of re-running exploration. -->
