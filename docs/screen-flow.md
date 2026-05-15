# Screen Flow — CosmicPath Career Wedge Engine

Updated: 2026-05-14

## Actors

- Brand Owner: authenticated owner of the CosmicPath brand.
- Cron Runner: server-side caller using `CRON_SECRET`.

## Primary Campaign Flow

1. Brand Owner opens `/brands/[slug]/settings`.
2. User selects campaign settings and activates `career_timing_wedge_399`.
3. User sets `qualityProfile` to `career_decision`.
4. User saves campaign config through `PATCH /api/brands/[id]`.
5. User returns to `/brands/[slug]`.
6. User generates campaign posts.
7. System applies career quality gate and 3:1 link cadence.
8. Dashboard shows today scheduled campaign posts, quality status, and link ratio.
9. Brand Owner publishes through existing cron/manual publish flow.
10. Brand Owner uses Reply Playbook templates manually when comments arrive.
11. Brand Owner inputs manual paid conversions until automatic conversion tracking exists.
12. Growth learning uses replies/reposts/views/clicks/conversions with campaign weights.

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
