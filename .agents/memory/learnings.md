# 🧠 Orchestrator 5.4 — Meta-Learning Memory (learnings.md)

> This file is automatically updated after each development cycle.
> It is preloaded in every workflow's Step 0 to prevent repeating past mistakes.
> **Do not delete this file.** It is the system's accumulated intelligence.

---

## Format
- `## [YYYY-MM-DD] Cycle Learnings`
- `- Recurring error: <type> — <description> — Prevention: <action>`
- `- What worked well: <description>`
- `- Next cycle: <specific action>`

---
<!-- New learnings are appended below -->

## [2026-04-08] Cycle Learnings
- Recurring error: contract drift — `docs/api-spec.md`의 HTTP method와 payload가 실제 route 구현과 어긋나 ship 점검에서 혼선이 생김 — Prevention: API route를 바꾼 같은 사이클에 계약 문서도 함께 갱신하기
- Recurring bug: stale publish state — 게시 성공 경로가 여러 군데로 갈라져 있을 때 한 경로만 `errorLog`를 초기화하면 `PUBLISHED` 글에도 과거 실패 로그가 남아 UI에 재노출됨 — Prevention: 상태 전이(`FAILED -> PUBLISHED`)를 쓰는 모든 publisher 경로에서 성공 시 `errorLog`를 동일하게 비우고, 읽기 경계에서도 legacy 데이터를 정상화하기
- What worked well: `qa-runner`가 실제 실행 가능한 검증 스크립트를 `lint`, `build`로 정확히 좁혀줘서 ship 확인이 빨랐음
- Next cycle: ship 전 `audit-status`에서 dirty worktree를 먼저 정리하거나 범위를 고정한 뒤 검증 시작하기

## [2026-05-15] Cycle Learnings
- Recurring bug: missing publish boundary guard — quality gate fail 글이 생성 큐에 남아도 발행 경계에서 막지 않으면 수동/cron 업로드로 실제 발행될 수 있음 — Prevention: `qualityPass === false`는 모든 publisher 경로와 UI 업로드 버튼에서 차단하기
- Recurring bug: campaign prompt conflict — 브랜드 기본 프롬프트의 reply-dependent CTA 금지가 예전 `career_decision` 댓글 진단 조건과 충돌해 usable posts를 fail 처리함 — Prevention: 커리어 캠페인은 댓글 접수 대신 셀프체크/저장/공유 mechanics를 기본값으로 두고, retry에는 gate 실패 이유를 주입하기

## [2026-05-16] Cycle Learnings
- Recurring bug: opaque external-source failure — Meta permission errors were collapsed into “일부 소스 실패” so the operator could not tell whether discovery failed because of no data or blocked API permission — Prevention: surface source error classes directly and provide a manual seed-handle fallback for permission-limited discovery.

## [2026-05-21] Cycle Learnings
- Recurring bug: cron implementation without deployment registration — 토큰 갱신 route가 있어도 `vercel.json` cron에 없으면 production에서는 자동 갱신이 돌지 않음 — Prevention: 새 cron endpoint를 만들 때 같은 변경에서 배포 스케줄과 README를 함께 갱신하기
- Recurring bug: fallback setup blocks primary workflow — legacy env-token 초기화 실패가 multi-brand refresh 전체를 막을 수 있음 — Prevention: fallback refresh는 non-blocking으로 처리하고 브랜드별 작업은 독립적으로 계속 실행하기

## [2026-06-01] Cycle Learnings
- Recurring bug: missing token refresh at publish boundary — refresh cron이 실패하거나 배포되지 않으면 앱 발행 경로가 만료 임박 토큰을 그대로 사용함 — Prevention: 모든 publisher 경로는 저장 토큰을 직접 쓰지 말고 발행 직전 fresh credentials 헬퍼를 통과하기

## [2026-09-03] Account-Wide Viral Analysis & Breakout Synthesis (1,537 Posts Audited)
- **Top Breakout Case #1 (299,073 Views / 2,764 Likes / 1,544 Replies)**:
  - `상상/양자택일 딜레마 훅`: "자, 상상해봐. 오늘 퇴근길에 산 로또가 1등 당첨됐어. 세금 떼고 15억 입금됨. 제일 먼저 뭐 할 거야? 1. 냅다 퇴사 2. 내 집 마련 3. 조용히 회사 다님"
  - **학습 포인트**: 1초 만에 뇌내 시뮬레이션을 돌려 댓글 1,544개가 폭발하며 알고리즘 강제 부스팅 유발.
- **Top Breakout Case #2 (121,042 Views / 685 Likes / 232 Replies)**:
  - `개념 서열 비교 훅`: "혹시 '도화'보다 센 '홍염'보다 센 게 뭔지 알아? 바로 '화개'야. 화려함을 덮는다는 뜻인데, 이게 터지면 스님도 파계시킴. 은은한데 사람 미치게 하는 매력..."
  - **학습 포인트**: 대중 상식(도화살) 위에 더 상위 개념을 얹어 지적 호기심과 자아도취 폭발.
- **Top Breakout Case #3 (42,254 Views / 95 Likes / 54 Replies)**:
  - `진태양시 30분 왜곡 폭로`: "한국인 10명 중 7명은 자기가 태어난 시간 잘못 알고 있다"
  - **반성 및 가드레일**: 이 1개 케이스에만 매몰되어 모든 글에 30분 오차를 복붙하는 단일 소재 과적합(Overfitting) 발생. 30분 오차는 8대 토픽 중 1개로만 다루고, 절대 단독 복제하지 말 것.


## [2026-10-08] Learning Loop Audit
- Recurring bug: open learning loop — learn cron updated priors daily, but CosmicPath (`isLeanSprint`) picked formulas from a hard-coded allocation, so learning never reached output — Prevention: every generation path must read learned state (priors/weights); covered by `lean-mode-selector.test.ts`.
- Recurring bug: multiple writers to one learned field — `/api/cron/learn` and `/api/cron/feedback` both wrote `formulaWeights` with different key spaces and scales — Prevention: one owner per learned field (learn owns formulaWeights/thompsonPriors).
- Recurring bug: cumulative bandit update over a sliding window — re-adding the same 300 posts daily inflated Beta confidence ~20x — Prevention: rebuild priors from defaults each run when input is a window.

## [2026-10-13] Viral Engine v2 Audit
- Recurring bug: gate contradicts formula — `imagination_dilemma` mandated the opener "자, 상상해봐" while the expert-panel evaluator and the prompt's slop list penalized the same string, so the best-proven formula was silently rewritten or failed — Prevention: when a formula instruction names a literal phrase, grep every gate (`expert-panel-evaluator`, `meta-policy-guard`, `marketing-skills`, prompt rules) for that phrase before shipping; `expert-panel-evaluator.test.ts` pins the opener.
- Recurring bug: per-request index for cross-request rhythm — `shouldLink = (index+1) % cadence` restarted at 0 every request, and the client sends chunks of 2, so cadence 3 produced zero links — Prevention: anything that must hold "1 in N" across requests takes a DB-derived offset (`link-cadence.ts`), never a request-local counter.
- Recurring bug: cumulative update over a sliding window (second instance) — `formulaWeights` stacked ±1 on the stored value daily from the same 300-post window, walking winners to the 10 ceiling — Prevention: same rule as priors (2026-10-08): rebuild from defaults when the input is a window; `growth-service.test.ts` covers it.
- Recurring bug: prose-only guardrail — the "30분 오차" overfit cap lived only in prompt text while one formula instruction still mandated it — Prevention: guardrails that matter live in code (`topic-saturation-guard.ts`) and the instruction that contradicts them is edited in the same change.
- Recurring bug: timing limit treated as content defect — trust-tier quota (3/day) below the slot plan (5/day) demoted approved posts to NEEDS_REVIEW every afternoon — Prevention: quota/cooldown style limits skip the run; only content reasons change post status.
- What worked well: four parallel read-only explorations (learning / generation / conversion / ops) before any design made every fix root-cause rather than symptomatic.

## [2026-10-22] Overfit Loop Audit (193 posts, median 117 views)
- Recurring bug: learned signal fed back as prompt text — a 5-post `topic` at ~2x the brand median became a growthMemory "winner", the prompt told the model to reuse it, and 26 of the last 30 posts shared two scenarios — Prevention: prompt-facing winners need `MIN_WINNER_POSTS` (8) and `WINNER_MARGIN` (1.5x median); `growth-learning.test.ts` pins it.
- Recurring bug: weighted picker without a cap — learned `frictionWeights` made `pickWeighted` return the same friction most ticks — Prevention: `isSituationSaturated` (2 of recent 10) steps the experiment through the unweighted permutation; any learned weight that drives selection needs a recent-window cap in code.
- Recurring bug: openers gated on the reader's chart ("경금 일주에 화개살이 있으면") — half of recent first lines, none of the breakouts — Prevention: `findFirstLineChartGate` fails the saju_viral gate; the prompt rule alone was not enough.
- Recurring bug: a funnel script rewrote `config.topics` to one axis (relationship) and the lean sprint pinned every post to that axis's matrix — the generator had no way to produce career/money posts, which were 14 of the 23 breakouts — Prevention: `planTopicQuota` keeps both axes per batch and the matrix follows each topic (`isRelationshipTopic`); any script that replaces `topics` must keep at least two axes.
- Recurring bug: canned fallback on an auto-publish path — `generateDraftReplyContent` returned a fixed sentence when Claude failed, and the test mock (no `type: "text"`) had been passing *because* of that fallback; the first live run would have posted the same line under every comment — Prevention: anything auto-posted returns null on failure and the caller skips the row (`draftsSkipped`); a mock that never exercises the success path is a red flag.
- Recurring bug: claim-after-call — `publishApprovedReply` updated the row only after the Threads call, so a route timeout between the two would double-post next run — Prevention: claim the row (`PUBLISHING`) before any external side effect; interrupted rows are reported (`stuck`), never auto-retried.
- Recurring bug: comment says "caller skips", code does not — `fetchOwnUsername` null was documented as "skip drafting" but `scanAndDraftRepliesForBrand` still scanned, so a `/me` failure would have the brand reply to its own first comments — Prevention: a safety precondition lives in the function that acts on it, with a test for the failure branch.
- Recurring bug: `findFirst({ orderBy: { publishedAt: "desc" } })` without `publishedAt: { not: null }` — Postgres puts NULLs first on DESC, so one legacy PUBLISHED row with no date became "last published" and silently disabled the slot gate and cooldown; it only surfaced when the scheduler ran every 15 min (3 KR posts in one slot, 2026-10-23) — Prevention: any "latest by date" lookup filters the date to not-null; `route.test.ts` pins the where clause.

## [2026-10-30] Lean Arm Coverage
- Recurring bug: hard-coded arm list narrower than the formula pool — `LEAN_ARM_IDS` held 5 modes, so saju_viral drafts could never take the registry's breakout shapes (복채 roast, 돈 창고, 재능 판정, 통념 팩트) even though those formulas sat in `sourceFormulas`; the queue converged on situation-advice posts and the late-October median fell to 60 views — Prevention: a breakout shape gets a lean arm (`SAJU_HIT_MODES`) and Thompson priors decide its share; a test pins that each arm is reachable and pairs with its registry instruction.
