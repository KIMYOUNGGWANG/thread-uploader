# Investigation — Quality Fail Posts Publishing

Date: 2026-05-15

## Confirmed Root Cause

`qualityPass === false` posts were stored as `PENDING` after generation retries and neither the manual publish route nor the cron publisher checked the quality gate before publishing.

## Evidence

- `src/app/api/generate/route.ts` logs quality fail after retries but still creates the post as `PENDING`.
- `src/app/api/posts/[id]/publish/route.ts` only rejected already-published posts.
- `src/app/api/cron/publish/route.ts` selected the oldest `PENDING` post regardless of `qualityPass`.
- `src/components/PostCard.tsx` disabled upload for parser validation errors, but not for quality gate failures.

## Repair

- Immediate publish now returns 400 for `qualityPass === false`.
- Cron publish now selects only `qualityPass === true` or unknown quality posts.
- UI upload button is disabled for quality-failed posts.
- API contract now states quality-failed posts are review-only.

---

# Investigation — Career Wedge Quality Fail Rate

Date: 2026-05-15

## Confirmed Root Cause

The career campaign quality gate was failing too many usable posts because the brand system prompt discouraged comment CTAs while the career gate required them, and the gate only recognized a narrow set of first-line career anxiety phrases.

## Evidence

- Latest campaign batch showed 6/21 quality pass before repair.
- Most earlier failures were caused by reply-dependent CTA assumptions or `첫 줄에 커리어 불안 없음`.
- Several failed first lines used valid career anxiety language such as `월급`, `통장`, `동기`, `제자리`, and `때려치우고 싶다`.
- The stored brand system prompt forbids reply-dependent structures, so `career_decision` now uses 셀프체크/저장/공유 mechanics instead of comment intake.

## Repair

- Expanded `career_decision` first-line patterns to cover salary, comparison, stagnation, and work-exit anxiety.
- Expanded engagement patterns to include comment, share, tag, and A/B style prompts.
- Added career decision frame detection for posts that present 버팀/이동/준비 as a classification frame without a single explicit type.
- Added quality feedback into generation retries so the model sees the exact gate failure on retry.
- Added campaign prompt overrides that make comment diagnosis CTA mandatory for the career wedge.

## Validation

- Existing campaign batch re-score improved from 6/21 pass to 14/21 pass.
- Remaining 7 failures still lacked real CTA/classification structure and were intentionally kept failed.
- `npm run typecheck`, `npm run lint`, and `npm run build` passed.

---

# Investigation — Account Discovery Returns Zero Candidates

Date: 2026-05-16

## Confirmed Root Cause

Account discovery returned zero candidates because the only available automatic source was Threads `keyword_search`, the Meta app token returned permission errors for all five keyword sources, and the brand had no configured `competitorHandles` fallback.

## Evidence

- User-facing toast showed `후보 0개 저장, 일부 소스 실패 (5건)`.
- CosmicPath `viralDiscovery.keywords` and `competitorHandles` were both empty.
- Previous dry run showed each keyword source failed with `Application does not have permission for this action`.
- UI summarized source failures without showing the permission message or a next action.

## Repair

- Added `handles` to `POST /api/accounts/discover`.
- Seed handles from the UI or `viralDiscovery.competitorHandles` are saved as manual candidates even when keyword discovery is blocked.
- Added Related Accounts seed handle input for `@handle` and `threads.net/@handle`.
- Changed discovery toast to surface Meta permission errors instead of a vague failure count.
- Updated API/screen-flow docs with the permission fallback behavior.

## Validation

- `npm run typecheck`, `npm run lint`, and `npm run build` passed.

---

# Investigation — Threads Token Auto Refresh Did Not Run

Date: 2026-05-21

## Confirmed Root Cause

The refresh endpoint existed, but `/api/cron/refresh-token` was not registered in `vercel.json`, so the production deployment had no scheduled job extending Threads tokens before expiry.

## Evidence

- User-facing Threads API error reported the access token expired on 2026-05-20 06:31:36 PDT.
- `README.md` documented `GET /api/cron/refresh-token`.
- `src/app/api/cron/refresh-token/route.ts` implemented token refresh.
- `vercel.json` only registered `/api/cron/account-intelligence`, not `/api/cron/refresh-token`.
- The refresh route attempted legacy env-token initialization before brand refresh, so missing legacy env vars could block multi-brand refresh work.

## Repair

- Registered `/api/cron/refresh-token` as a daily Vercel Cron Job.
- Increased the refresh window from 7 days to 14 days for more buffer.
- Centralized the token refresh due check in `src/lib/threads-api.ts`.
- Made legacy settings refresh non-blocking so brand tokens still refresh when legacy env vars are absent.
- Added `scripts/refresh-token-standalone.js` and wired the GitHub Actions publisher to refresh DB tokens before posting.

---

# Investigation — Threads Token Expired Despite Auto Refresh

Date: 2026-06-01

## Confirmed Root Cause

Brand publishing paths used the stored `brand.accessToken` directly, so automatic refresh depended only on the separate refresh cron or standalone publisher and had no on-demand fallback at the manual/API publish boundary.

## Evidence

- `src/app/api/cron/refresh-token/route.ts` refreshes due tokens, but only when that endpoint is successfully invoked.
- `scripts/publish-standalone.js` calls `refresh-token-standalone` before posting.
- `src/app/api/posts/[id]/publish/route.ts` and `src/app/api/cron/publish/route.ts` built credentials from `brand.accessToken` and `brand.threadsUserId` without checking `tokenExpiry`.
- Once a Threads long-lived token is already expired, refresh may fail and the brand needs a freshly issued long-lived token.

## Repair

- Added `getFreshBrandCredentials()` to refresh a brand token when it is within the configured refresh window before returning publish credentials.
- Updated immediate post publishing and cron publishing to use fresh brand credentials.
- Updated legacy settings token lookup to refresh before returning a token when the stored expiry is inside the refresh window.
