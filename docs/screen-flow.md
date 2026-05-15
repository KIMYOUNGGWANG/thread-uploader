# Screen Flow — CosmicPath Career Wedge Engine

Updated: 2026-05-15

## Actors

- Brand Owner: authenticated owner of the CosmicPath brand.
- Cron Runner: server-side caller using `CRON_SECRET`.

## Primary Campaign Flow

1. Brand Owner opens `/brands/[slug]/settings`.
2. User selects campaign settings and activates `career_timing_wedge_399`.
3. User sets `qualityProfile` to `career_decision`.
4. User saves campaign config through `PATCH /api/brands/[id]`.
5. User returns to `/brands/[slug]`.
6. User runs AI Account Discovery from seed keywords.
7. System shows related public account candidates with relevance scores.
8. User marks useful accounts as watched and noisy accounts as ignored.
9. System analyzes watched account public posts and updates viral/account patterns.
10. User generates campaign posts.
11. System applies career quality gate and 3:1 link cadence.
12. Dashboard shows today scheduled campaign posts, quality status, and link ratio.
13. Brand Owner publishes through existing cron/manual publish flow.
14. Brand Owner uses Reply Playbook templates manually when comments arrive.
15. Brand Owner inputs manual paid conversions until automatic conversion tracking exists.
16. Account Intelligence runs every 2 hours and surfaces reply/format/link/quality actions.
17. Growth learning uses replies/reposts/views/clicks/conversions with campaign weights.

## Settings States

- Empty campaign: show default `career_timing_wedge_399` preset.
- Editing campaign: campaign fields are local until Save.
- Quality profile selection: `career_decision` is default for the career wedge.
- Save success: toast confirms settings saved.
- Save failure: show API error and keep unsaved local state visible.
- Permission error: non-owner receives 403/404 and exits to login or brand list.

## Generation States

- Ready: active campaign exists and has at least one campaign formula.
- Generating: button disabled and shows progress/spinner.
- Quality fail: post is still inspectable with fail reasons; generation may retry according to existing quality retry policy.
- Link cadence: for every 3 generated campaign posts, exactly 1 receives a `firstComment` UTM link.
- Empty landing URL: generation can proceed, but linked count is 0 and campaign warning is shown.

## Campaign Dashboard States

- Empty: no scheduled campaign posts today; show generate action.
- Loading: spinner while campaign summary loads.
- Ready: show today scheduled 3 posts, linked count, quality pass/fail, views/replies/reposts, manual paid conversions.
- Partial metrics: missing clicks/conversions are treated as 0 but visually marked manual/missing.
- Error: keep last known summary visible and show toast.

## Account Intelligence States

- Empty: no saved `AccountInsight`; user can run analysis manually.
- Loading: spinner while latest insight loads.
- Running: button disabled while metrics refresh and insight generation run.
- Ready: show latest summary, metrics refresh count, priority actions, and recent window metrics.
- Cron: `/api/cron/account-intelligence` runs with `CRON_SECRET` every 2 hours.
- Degraded metrics: if Threads insights fetch fails, use stored metrics and include failed refresh count.

## Related Accounts States

- Empty: no discovered accounts; show seed keyword discovery action.
- Discovering: button disabled while keyword search and profile expansion run.
- Candidate list: show username, category, relevance score, source keyword, reason, and recent pattern summary.
- Watch action: moves the account to watched and makes it eligible for recurring analysis.
- Ignore action: moves the account to ignored and prevents future learning from that account.
- Watched list: show last scanned time, saved post count, dominant hook/emotion/structure/CTA patterns.
- Analyzing: collect recent public posts only from watched accounts and refresh account patterns.
- Error: show source-specific failures without deleting previous candidates.

## Reply Playbook States

- Default: show four groups: 버팀형, 이동형, 준비형, CTA.
- Comment diagnosis: user reads a real comment and copies the matching template manually.
- No auto-reply: the app must not send replies or DMs.

## Manual Conversion Flow

1. Brand Owner opens Campaign Dashboard.
2. User selects a campaign post.
3. User enters clicks, conversions, or paid conversion count manually.
4. App calls `PATCH /api/posts/[id]/campaign-metrics`.
5. Campaign summary refreshes and score recalculates.

## Validation

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- Generate 21 posts and confirm exactly 7 linked `firstComment` values.
- Confirm all generated links include `utm_content`.
- Confirm career comment-diagnosis posts pass without forced saju terms.
- Confirm generic self-help posts fail `career_decision`.
- Confirm Reply Playbook templates are visible and copy-ready without auto-send.
- Confirm Account Intelligence panel can render empty and latest insight states.
- Confirm account discovery saves candidates from seed keywords.
- Confirm ignored accounts do not feed account pattern learning.
- Confirm watched account patterns appear in the viral generation guidance.
