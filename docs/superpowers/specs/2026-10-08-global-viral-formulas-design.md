# CosmicPath Global — English-market viral formulas

Date: 2026-10-08
Scope: `cosmicpath-global` brand (`ecommerce_d2c` domain preset) only.

## Problem

- `cosmicpath-global`: 103 published posts, median 17 views, 81% under 50 views.
- `cosmicpath` (Korean): 165 posts, median 90 views, top posts 42K / 22K.
- The global generator has no English-market references: 2 viral examples, both its own posts. `viralDiscovery` sources are empty.
- Every `ecommerce_d2c` formula forbids `"Saju"`, `"Korean bazi"`, `"10-year luck pillar"`, so the hybrid product is written as a pure Western-astrology account. Pure Western theory posts (Saturn return, Moon sign) are the account's worst performers.

## Evidence (research 2026-10-08: Threads direct snapshots, TikTok second-hand via articles, Reddit titles via archive)

1. "saju" as the lead word does not pull on English Threads (best English saju account post: 127 likes). "Chinese zodiac / Fire Horse 2026" does (460–2,000 follower accounts reaching 800–1,600 likes).
2. Correction hooks on a trending keyword win: "Every Fire Horse headline you'll see probably says…" (811 likes, 583 followers). Our own top 2 English posts are this type.
3. "Your real sign/chart may be different" appears on all three platforms plus our own top KR and EN posts (birth time, time zone, Jan–early Feb births vs Lunar year / Ipchun).
4. Identity call-outs beat theory ("To ALL CAPRICORNS…", "at every job there's a Pisces woman"). TikTok top-saved: "the toxic partner you subconsciously crave based on your sign".
5. All-12 series (find your animal) and two-birthday compatibility drive saves/shares.
6. Top reach posts carry no CTA.

## Change 1 — rewrite `ecommerce_d2c` formulas (`src/lib/domain-registry.ts`)

Shared rule appended to every reach/authority formula instruction: open with a familiar Western/Chinese-zodiac frame, then reveal how Korean saju reads it differently. Romanize any Korean term and gloss it in one line. No Hangul (existing quality gate enforces this).

| Track | id | Instruction intent |
|---|---|---|
| track_a | `trend_correction` | Take a trending zodiac headline (e.g. Fire Horse 2026, Fire Goat 2027) and correct it with what saju actually says. Line 1 names the headline, line 2 contradicts it. No CTA. |
| track_a | `real_sign_boundary` | "Your real animal/chart may be different": Jan–early Feb births vs Ipchun (Feb 4) and Lunar New Year, birth-time and time-zone shifts. End with a concrete self-check the reader can do now. No CTA. |
| track_a | `identity_callout` | Call out one zodiac animal or Day Master type with a sharp, relatable behavior (work, dating, money). Second line: what saju says is underneath it. No CTA. |
| track_b | `all_twelve_series` | One theme (love, money, career in the coming year) across all 12 animals, one line each, so readers search for their own and save. |
| track_b | `two_birthday_compatibility` | What happens when two specific elements/animals date or work together; ask the reader to send it to the person. Optional profile link mention only. |
| track_c | `synastry_blueprint_offer`, `d2c_etsy_offer` | Unchanged except the forbidden-keyword fix below. |

Removed: `synastry_avoidant_trap`, `big3_internal_sabotage`, `saturn_return_burnout`, `anti_ai_craft_expose`.

All formulas: `forbiddenKeywords` keeps `["대운", "사주", "도화살"]` (Hangul guard) and drops `"Saju"`, `"Korean bazi"`, `"10-year luck pillar"`.

Map the new ids to existing intent modes in `src/lib/viral-intent-modes.ts`: `trend_correction` → `quiet_contrarian`, `real_sign_boundary` → `saveable_tool`, `identity_callout` → `identity_profile`, `all_twelve_series` → `saveable_tool`, `two_birthday_compatibility` → `friend_share`. Keep the old `synastry_avoidant_trap` mapping (existing posts reference it).

`defaultTopics` replaced with: Fire Goat 2027 headline corrections, January/February birthday animal boundary, birth time and time zone correction, Day Master types at work, zodiac-animal pairs in love, 2027 money by animal.

## Change 2 — English viral sources (production brand config, separate confirmation)

Set `brandConfig.viralDiscovery` for `cosmicpath-global` so the existing `/api/cron/viral` collects English references:
- `competitorHandles`: `lindalignment`, `xuelsun`, `masterjasonchan`, `ama_foryou`, `shawtyastrology`
- `keywords`: `fire horse`, `chinese zodiac`, `bazi`, `saju`
- Enable adapters `threads_keyword`, `threads_profile`.

Done through the dashboard or a one-off read-modify-write of only the `viralDiscovery` key. Requires explicit user approval at execution time.

## Out of scope

Korean-post porting, new DB columns, new services, quality-gate changes, CTA/link destination changes (start page is being merged with couple flow separately).

## Tests

- `domain-registry.test.ts`: `ecommerce_d2c` formulas contain the five new ids; no formula forbids `"Saju"`; Hangul guard terms still present.
- Existing `npm run test` / `typecheck` / `lint` pass.

## Success criteria (2 weeks, ~28 posts)

- Global median views 17 → 50+.
- Share of posts at 300+ views: ~5% → 20%+.
- Measured with existing `fetch-metrics` cron data.
