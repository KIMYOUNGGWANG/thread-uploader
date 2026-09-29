# Brainstorm — Threads 5D Safety Cockpit Completion & TikTok Decoupled Worker

Updated: 2026-09-18
Design Document: `docs/plans/designs/threads-cockpit-tiktok-decoupling-design.md`

## Goal
Complete and stabilize the Threads 5D algorithmic scoring, self-healing remediation, and shadowban safety cockpit on the dashboard and cron, while decoupling the TikTok Remotion rendering pipeline into an asynchronous CLI/background worker to prevent serverless execution timeouts.

## Selected Direction: Approach A (Threads Cockpit Completion + TikTok Async Decoupling)
- Threads 5D Cockpit: Wire `AccountHealthBanner.tsx` and `ScoreRadarPopover.tsx` with atomic remediation API, 1-min debounced evaluate endpoint, and shadowban link suppression.
- TikTok Decoupled Worker: Next.js API returns 202 QUEUED immediately; standalone CLI worker (`scripts/render-tiktok-worker.mjs`) renders videos with 10-minute timeout auto-recovery.
- 3-Tier Verification: Zero-defect typecheck, 63 vitest test files regression net, and E2E scenario checks.

---

# Brainstorm — Dashboard Health Cockpit & 5D Post Radar System

Updated: 2026-09-16
Design Document: `docs/plans/designs/dashboard-cockpit-safety-design.md`

## Goal
Build a dedicated Account Health Banner Cockpit and interactive 5D Post Score Radar Popover with 1-click auto-remediation and manual override controls directly on the Dashboard.

## Selected Direction: Approach 1 (Modular Micro-Widgets & Atomic API)
- `AccountHealthBanner.tsx`: Real-time health status (HEALTHY, WARNING, SHADOWBAN_SUSPECTED, RECOVERY), Trust Ramp tier, daily quota, manual override switches.
- `ScoreRadarPopover.tsx`: 0-dependency pure SVG 5-axis radar chart showing hook, conversation, human voice, penalty risk, format readability scores, and actionable fixes.
- `PostCard.tsx`: Score badge with color threshold, [✨ 1-Click 5D Auto-Remediate] button (atomic `POST /api/posts/[id]/remediate`), and [⚡ Force Approve] button.
- Backend APIs: `POST /api/posts/[id]/remediate`, `PATCH /api/brands/[id]/health`, `POST /api/brands/[id]/health/evaluate`.

---

# Brainstorm — Threads Viral Engine & Account Safety System

Updated: 2026-09-15
Design Document: `docs/plans/designs/threads-viral-engine-safety-design.md`

## Goal
Integrate pre-publish 5D algorithmic scoring with 2-stage hybrid remediation into the post generation loop, and integrate silent shadowban health probing with self-healing warmup routing into the cron publishing pipeline.

## Selected Direction: Approach 1 (State-Machine Pipeline & 2-Stage Remediation)
- 0-token heuristic regex patching (body links to first comment, paragraph formatting) + 1-token targeted LLM rewrite on weakest dimension. Quarantine as `NEEDS_REVIEW` if < 80.
- T+6h filtered metrics in `evaluateShadowbanHealth` to avoid Meta API lag false positives.
- Cold-start guard (< 5 posts skips shadowban status).
- Atomic DB status update (`status='PROCESSING'`) for cron concurrency idempotency.
- Self-healing fallback: on-demand warmup generator / hardcoded template pool with external links completely suppressed.

---

# Brainstorm — Threads Uploader Development Priorities

Updated: 2026-05-15

## Goal

Choose the next development slice for `threads-uploader` as a CosmicPath growth engine.

The product should not become a generic scheduler. The useful loop is:

`discover/reference -> generate campaign posts -> publish -> reply manually -> track UTM/conversions -> learn what creates revenue`

## 2026-05-15 Options

| Option | User Value | Hidden Cost | Key Risk | Evidence Path |
| --- | --- | --- | --- | --- |
| A. Campaign Conversion Loop | Connect each Threads post to one campaign URL, UTM, manual clicks/paid counts, and campaign summary. | Needs post-level metrics UI and manual input discipline until app analytics are wired. | Without this, viral views still do not tell us what makes money. | Generate 21 posts, publish 7 linked posts, manually log visits/paid, rank formulas by replies + paid. |
| B. Reply Ops Cockpit | Show posts needing replies, copy-ready diagnosis templates, and comment classification: 버팀형/이동형/준비형/CTA. | Requires human workflow design and probably manual copy/paste instead of auto-reply. | If too automated, account can feel spammy and violate the point of Threads conversation. | Within 48 hours, owner can answer comments faster and reply rate improves. |
| C. AI Account Discovery Engine | Find related accounts from seed keywords, score relevance, human watch/ignore, analyze watched account patterns. | API/search noise, schema/UI/service work. | Builds a better inspiration machine, but may not immediately improve conversion. | Discover 20 candidates, watch 5, inject account patterns into next generation. |
| D. Quality Gate v2 | Make `career_decision` gate stricter: career pain hook, comment CTA, no generic self-help, no forced saju terms. | Over-strict gate may reject decent posts and slow generation. | If done alone, better posts still may not get tracked to revenue. | 30 generated posts: generic motivational posts fail, comment-diagnosis posts pass. |
| E. Auto Scheduler Optimization | Best time slots, link cadence, queue balancing, cron reliability, failed publish recovery. | Optimizes distribution before proving content/offer. | Feels productive but does not solve weak positioning. | Fewer missed posts and stable 3/day cadence for 14 days. |

## Recommendation

Primary direction: **A. Campaign Conversion Loop**.

Reason: CosmicPath already had first-month revenue and then stalled. The biggest missing link is not more automation; it is knowing which Threads posts create visits, free readings, and paid conversions. Until this exists, every viral feature is guessing.

Backup direction: **B. Reply Ops Cockpit**.

Reason: Threads growth comes from conversation velocity. The app should help the owner reply quickly and consistently, but it should not auto-reply or DM.

## Deferred

- Fully automatic account learning without approval.
- Auto-reply / auto-DM.
- Cross-platform ingestion.
- Scheduler-only optimization.
- More AI generation styles before campaign metrics exist.

## Handoff

Concrete enough for `/plan`:

1. Plan `Campaign Conversion Loop` first.
2. Add `Reply Ops Cockpit` as the next slice if the first loop lands cleanly.
3. Keep `AI Account Discovery Engine` as a research/pattern layer, not the immediate revenue-critical path.

---

# Brainstorm — AI Account Discovery Engine

Updated: 2026-05-15

## Goal

Extend CosmicPath from post-level viral reference learning into account-level discovery:

`seed keywords -> related account candidates -> relevance scoring -> human watch/ignore -> recurring account post analysis -> prompt memory`

## Options

| Option | User Value | Hidden Cost | Key Risk | Evidence Path |
| --- | --- | --- | --- | --- |
| Manual Watchlist First | Fastest useful competitor/reference tracking. Owner adds known handles and system analyzes them. | Still depends on owner knowing good accounts. | Misses adjacent creators that are not obvious. | Add 10 handles, run profile analysis, confirm useful hook/CTA recommendations. |
| AI Candidate Discovery With Human Approval | AI finds related accounts from keyword search, scores them, and owner approves useful accounts. | Needs account tables, scoring rules, watch/ignore UI. | API limits and noisy public search can produce weak candidates. | Run career/saju seed keywords, save 20 candidates, approve 5, confirm watched patterns improve generated posts. |
| Fully Automatic Account Learning | No manual work; system continuously discovers and learns from accounts. | Brand drift risk is high because low-quality accounts enter memory. | Noisy accounts pollute generation prompts. | Only safe after watchlist scoring proves stable. |
| Manual Research Import | Easiest fallback. Paste handles/posts and learn from them. | Not truly autonomous. | Remains assisted workflow. | Use when API discovery fails or rate limits bite. |

## Recommendation

Primary direction: **AI Candidate Discovery With Human Approval**.

Backup direction: **Manual Watchlist First** if Threads discovery access, rate limits, or search quality blocks automatic discovery.

## Deferred

- Fully automatic learning without approval.
- Cross-platform account discovery.
- Follower growth scraping or non-public data collection.
- Automatic comments/DMs to discovered accounts.

## Handoff

Concrete enough for `/plan` as an MVP build + viral-content planning slice.

---

# Brainstorm — TikTok Video Automation Engine

Updated: 2026-05-17

## Goal

Evaluate whether `threads-uploader` should expand into TikTok automation for CosmicPath, and choose the safest next product direction.

The useful loop should be:

`viral pattern scan -> short-form idea -> script -> render-ready video spec -> MP4 draft -> human approval -> publish/draft upload -> metrics learning`

## Source Pattern Scan

- Local repo: no TikTok product implementation yet. Existing docs mention TikTok only as a future/non-goal platform and as a high-volume empathetic short-form channel.
- Local skill: `tiktok-automation` assumes Rube/Composio TikTok tools for upload, publish, listing videos, and authenticated profile stats, but only for the connected user's own account.
- Official TikTok path: Content Posting API supports inbox draft upload via `video.upload` and Direct Post via `video.publish`, but Direct Post needs app review/audit for public publishing.
- GitHub pattern: most open-source TikTok uploaders use browser automation with cookies/session cloning. This is fast to demo but fragile and higher-risk.
- GitHub video generation pattern: stronger repos focus on text prompt -> TTS -> captions -> background footage/music -> Remotion/FFmpeg render, then leave publishing as a separate step.

## Options

| Option | User Value | Hidden Cost | Key Risk | Evidence Path |
| --- | --- | --- | --- | --- |
| A. TikTok Video Experiment Engine | Creates CosmicPath TikTok drafts from campaign memory without depending on publishing permissions first. | Needs video schema, script formulas, render specs, caption rules, quality gate. | If formulas are generic, output feels like low-trust AI astrology content. | Generate 21 TikTok scripts/specs, approve 7, render 3, manually upload, compare retention/comments. |
| B. Official TikTok Draft Upload | Safer automation path: upload approved MP4s into TikTok inbox for manual final post. | OAuth, `video.upload` scope, verified URL/storage, rate limits, user consent UI. | Still not full auto-publish; user must complete in TikTok. | Connect one TikTok account, send one MP4 to inbox draft, confirm status tracking. |
| C. Direct Auto-Publish | Closest to true scheduler once approved. | TikTok app audit, `video.publish`, creator info UI requirements, moderation handling. | Unaudited clients may be restricted to private visibility. | Only after draft upload proves the flow and app review passes. |
| D. Faceless Template Factory | Lowest-effort content volume: background video, TTS, big captions, loopable format. | Asset licensing, sameness, template fatigue, brand trust work. | CosmicPath can look spammy if it imitates generic faceless accounts. | Build 3 templates: career decision, saju timing myth, comment diagnosis. |
| E. Browser/Cookie Uploader | Fastest hack to auto-upload without official API approval. | Cookie handling, browser breakage, anti-bot failures, account security. | Account/platform compliance risk. | Keep as local-only research fallback, not production. |

## Recommendation

Primary direction: **A. TikTok Video Experiment Engine**.

Reason: CosmicPath needs a repeatable short-form creative testing machine more than it needs a risky uploader. If the videos are weak, auto-publishing only makes weak content faster.

Backup direction: **B. Official TikTok Draft Upload**.

Reason: once the engine can produce useful MP4 drafts, draft upload gives practical automation while keeping the final post human-approved and safer.

## Deferred

- Browser/cookie auto-upload as a production path.
- Auto-comment/auto-DM engagement.
- Scraping private or non-authorized analytics.
- Direct auto-publish before app approval.
- Multi-platform scheduling before TikTok creative quality is proven.

## Handoff

Concrete enough for `/plan`:

1. Plan `TikTok Video Experiment Engine MVP`.
2. Keep official draft upload as phase 2.
3. Treat browser upload repos as reference only, not the product architecture.
