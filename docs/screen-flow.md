# Screen Flow — Portfolio Growth OS

Updated: 2026-06-04

## Actors

- Portfolio Operator: authenticated owner promoting their own products.
- Cron Runner: server-side caller using `CRON_SECRET`.

## Primary Product Growth Flow

1. Portfolio Operator opens `/brands`.
2. User creates or selects a product card. The route still uses `/brands/[slug]`.
3. User opens `/brands/[slug]/settings`.
4. User fills Product Profile: product name, one-line description, target customer, offer promise, landing URL, positioning notes, primary channel, primary metric, and conversion metric.
5. User fills Active Experiment: name, hypothesis, stage, duration, primary metric, guardrail metric, and status.
6. User selects `product_growth` or a product-specific quality profile.
7. User saves settings through `PATCH /api/brands/[id]`.
8. User returns to `/brands/[slug]`.
9. Dashboard shows Portfolio Overview with experiment status, primary/conversion metrics, quality state, and next action.
10. User generates channel posts.
11. System injects Product Profile, Active Experiment, growth memory, viral memory, and account patterns into the generation prompt.
12. System applies the selected quality gate and link cadence.
13. User reviews PENDING posts and publishes manually or through cron.
14. User enters clicks, conversions, or manual paid conversions when available.
15. Campaign summary updates metric tiles, evidence state, and next action.
16. User repeats the loop for the same product or switches to another product in the portfolio.

## Product List States

- Empty: show "첫 제품 만들기".
- Loading: show spinner while `/api/brands` loads.
- Ready: show product cards with formula/topic counts and quick navigation.
- Create modal: product name/slug/Threads credential fields plus default product profile and active experiment payload.
- Create failure: show API error and keep modal state.

## Product Settings States

- Empty product profile: show safe defaults and editable fields.
- Editing: local state is preserved until Save.
- Product tab: profile and experiment fields are edited together.
- Quality profile selection: `product_growth` is available for non-CosmicPath products.
- Save success: toast confirms product settings saved.
- Save failure: show API error and keep unsaved local state visible.
- Permission error: non-owner receives 403/404 and exits to login or product list.

## Generation States

- Ready: product profile exists, an active experiment exists, and at least one formula can be used.
- Generating: button disabled and shows progress/spinner.
- Product-aware prompt: generated content must include product and experiment context.
- Quality fail: post is still inspectable with fail reasons; generation may retry according to existing quality retry policy.
- Link cadence: for every 3 generated campaign posts, exactly 1 receives a `firstComment` UTM link.
- Empty landing URL: generation can proceed, but linked count is 0 and a warning is shown.

## Portfolio Dashboard States

- Empty summary: show dashboard without the overview rather than blocking the product page.
- Loading: summary request can run independently of posts.
- Ready: show product name, active experiment, target customer, next action, primary metric, conversion metric, and quality counts.
- Learning: no linked posts yet, so next action asks the operator to generate or publish evidence.
- Measuring: linked or scored posts exist, so next action asks the operator to review evidence and decide the next experiment move.
- Partial metrics: missing clicks/conversions are treated as 0.
- Error: keep posts visible and show toast.

## Account Intelligence States

- Empty: no saved `AccountInsight`; user can run analysis manually.
- Loading: spinner while latest insight loads.
- Running: button disabled while metrics refresh and insight generation run.
- Ready: show latest summary, metrics refresh count, priority actions, and recent window metrics.
- Cron: `/api/cron/account-intelligence` runs with `CRON_SECRET` every 2 hours.
- Degraded metrics: if Threads insights fetch fails, use stored metrics and include failed refresh count.

## Related Accounts States

- Empty: no discovered accounts; show keyword discovery action and seed handle input.
- Discovering: button disabled while keyword search, seed handle upsert, and profile expansion run.
- Candidate list: show username, category, relevance score, source keyword, reason, and recent pattern summary.
- Permission fallback: if Meta `keyword_search` returns permission errors, show the source error and let the operator paste `@handle` or `threads.net/@handle` values to create manual candidates.
- Watch action: moves the account to watched and makes it eligible for recurring analysis.
- Ignore action: moves the account to ignored and prevents future learning from that account.
- Watched list: show last scanned time, saved post count, dominant hook/emotion/structure/CTA patterns.
- Analyzing: collect recent public posts only from watched accounts and refresh account patterns.
- Error: show source-specific failures without deleting previous candidates.

## TikTok Video Lab States

- Empty: no TikTok drafts exist; show generate action and the active parent campaign.
- Generating: button disabled while AI creates video scripts/specs and quality gate runs.
- Ready: show draft cards with format, hook, duration, quality score, and status.
- Quality fail: show fail reasons and keep the draft editable, but hide/disable approve action.
- Approved: show copy-ready script, caption overlays, hashtags, CTA, and landing URL.
- Browser render: user clicks video render and the app records a 9:16 WebM from the draft spec.
- Manual upload: user marks a draft as manually uploaded after posting in TikTok.
- Metrics pending: uploaded draft waits for 48-hour manual metrics.
- Metrics editing: user enters views, likes, comments, shares, saves, profile clicks, landing clicks, and conversions.
- Summary ready: show top formats, quality pass rate, manual upload count, and next-batch recommendations.
- Error: keep existing drafts visible and show the failed operation message.
- No upload automation: the UI must not ask for TikTok cookies, passwords, or browser sessions.

## Manual Metric Flow

1. Portfolio Operator opens the product dashboard.
2. User selects a campaign post.
3. User enters clicks, conversions, or paid conversion count manually.
4. App calls `PATCH /api/posts/[id]/campaign-metrics`.
5. Campaign summary refreshes and Portfolio Overview updates.

## Validation

- `npm run test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- Confirm `/brands` uses product wording for empty, create, and list states.
- Confirm `/brands/[slug]/settings` exposes Product Profile and Active Experiment fields.
- Confirm creating a product writes default `productProfile` and `activeExperiment`.
- Confirm `/api/campaigns/summary` returns `productProfile`, `activeExperiment`, `primaryMetric`, `conversionMetric`, `evidenceState`, and `nextAction`.
- Confirm generated prompt includes product and experiment context.
- Confirm generic content fails `product_growth`.
- Confirm CosmicPath `career_decision` quality behavior still passes/fails as before.
- Confirm TikTok manual-upload guardrails remain unchanged.
