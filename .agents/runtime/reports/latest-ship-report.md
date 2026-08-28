# SHIP Report

- Generated: 2026-06-05 20:38:07
- Target: /Users/kim-young-gwang/Desktop/projects/threads-uploader
- Target type: hub
- Package manager: npm
- Task progress: 0/0 (0%)
- API spec: present
- Audit status: 0
- Audit issues: 1
- Audit policy: pass (failures=0 warnings=0)
- Gate status: fail
- Blockers: hard=1 manual=2 soft=1
- Primary blocker: hard git_dirty Git working tree is not clean.
- Review findings: critical=0 high=0 medium=0 low=0
- Summary: Blocking issues detected: Git working tree is not clean.
- Recommended next step: /fix before ship

## Blockers

### Hard
- git_dirty: Git working tree is not clean.

### Manual
- qa_report_missing: No QA JSON report exists yet. Run qa-gate first.
- review_report_missing: No review JSON report exists yet. Run review-gate first.

### Soft
- external_changes: audit-status detected changed project files outside local state.

## Task Snapshot

```text
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
```

## Audit Snapshot

```text

🔍 Audit Status — One-Shot Environment Scan
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ No recent error logs
⚠️  53 uncommitted file(s) in Git
   💡 Consider committing before starting new work
✅ docs/api-spec.md exists (Contract ready)
🧠 learnings.md: 14 accumulated entries
Revenue OS: tiktok_video_experiment_engine — 56/100 (revise_offer)
Action: Return to /plan and sharpen the offer, customer, price, or channel.
Metrics: views=0, clicks=0, replies=0, calls=0, waitlist=0, preorders=0, paid=0
ℹ️  No release freeze state recorded
🧭 Policy check: PASS (0 failure(s), 0 warning(s))
🕵️  Changed project files outside local state:
   • .omo/boulder.json
   • .omo/evidence/build-cosmicpath-viral-upgrade.txt
   • .omo/evidence/cron-quality-blocked-contract.txt
   • .omo/evidence/docs-api-formula-contract-cosmicpath.txt
   • .omo/evidence/docs-no-reply-burden-cosmicpath.txt
   • .omo/evidence/f1-plan-compliance.txt
   • .omo/evidence/f2-code-quality.txt
   • .omo/evidence/f3-manual-qa.md
   • .omo/evidence/f4-scope-fidelity.txt
   • .omo/evidence/final-targeted-tests-cosmicpath-viral-upgrade.txt
   • .omo/evidence/green-wave-code-cosmicpath-viral-upgrade.txt
   • .omo/evidence/manual-http-admin-auth-cosmicpath.txt
   • .omo/evidence/manual-http-admin-brands-cosmicpath.txt
   • .omo/evidence/manual-http-auth-cosmicpath.txt
   • .omo/evidence/manual-http-brand-cosmicpath.txt
   • .omo/evidence/manual-http-brands-list-cosmicpath.txt
   • .omo/evidence/manual-http-campaign-summary-cosmicpath.txt
   • .omo/evidence/manual-http-clean-brand-cosmicpath.txt
   • .omo/evidence/manual-http-create-stale-publish-guard-post.txt
   • .omo/evidence/manual-http-generate-cosmicpath.txt
   • .omo/evidence/manual-http-posts-audit-cosmicpath.txt
   • .omo/evidence/manual-http-sprint-brand-cosmicpath.txt
   • .omo/evidence/plan-checklist-complete.txt
   • .omo/evidence/publish-safety-route-tests.txt
   • .omo/evidence/red-cosmicpath-viral-upgrade.txt
   • .omo/evidence/reviewer-9-dashboard-memory-contract.txt
   • .omo/evidence/reviewer-9-doc-prompt-contract.txt
   • .omo/evidence/reviewer-9-fix-generate-route-tests.txt
   • .omo/evidence/reviewer-9-tiktok-contract.txt
   • .omo/evidence/reviewer-9-tiktok-fix-tests.txt
   • .omo/evidence/task-1-campaign-formulas.txt
   • .omo/evidence/task-1-no-reply-promise.txt
   • .omo/evidence/task-2-brand-memory.txt
   • .omo/evidence/task-2-no-reply-burden.txt
   • .omo/evidence/task-3-generate-prompt.txt
   • .omo/evidence/task-3-reply-ban.txt
   • .omo/evidence/task-4-reply-burden-gate.txt
   • .omo/evidence/task-4-self-classification-gate.txt
   • .omo/evidence/task-5-saveable-analysis.txt
   • .omo/evidence/task-5-self-classification-analysis.txt
   • .omo/evidence/task-6-manual-viral-tests.txt
   • .omo/evidence/task-6-swipe-file-docs.txt
   • .omo/evidence/task-7-generate-sprint.http
   • .omo/evidence/task-7-sprint-audit.txt
   • .omo/evidence/task-7-summary.http
   • .omo/evidence/task-7-viral-mode-matrix.txt
   • .omo/evidence/task-8-no-reply-requirement.txt
   • .omo/evidence/task-8-playbook-rules.txt
   • .omo/evidence/task-suite-cosmicpath-viral-upgrade.txt
   • .omo/evidence/tiktok-no-reply-burden-contract.txt
   • .omo/evidence/typecheck-cosmicpath-viral-upgrade.txt
   • .omo/plans/cosmicpath-viral-upgrade.md
   • .omo/start-work/ledger.jsonl
   • .omo/start-work/notepad-cosmicpath-viral-upgrade.md
   💡 Action: Verify these files before proceeding.
📋 task_board.md: 0 / 0 tasks completed

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🟡 1 issue(s) detected. Review above before proceeding.
```

## Git Snapshot

```text
?? .omo/boulder.json
?? .omo/evidence/build-cosmicpath-viral-upgrade.txt
?? .omo/evidence/cron-quality-blocked-contract.txt
?? .omo/evidence/docs-api-formula-contract-cosmicpath.txt
?? .omo/evidence/docs-no-reply-burden-cosmicpath.txt
?? .omo/evidence/f1-plan-compliance.txt
?? .omo/evidence/f2-code-quality.txt
?? .omo/evidence/f3-manual-qa.md
?? .omo/evidence/f4-scope-fidelity.txt
?? .omo/evidence/final-targeted-tests-cosmicpath-viral-upgrade.txt
?? .omo/evidence/green-wave-code-cosmicpath-viral-upgrade.txt
?? .omo/evidence/manual-http-admin-auth-cosmicpath.txt
?? .omo/evidence/manual-http-admin-brands-cosmicpath.txt
?? .omo/evidence/manual-http-auth-cosmicpath.txt
?? .omo/evidence/manual-http-brand-cosmicpath.txt
?? .omo/evidence/manual-http-brands-list-cosmicpath.txt
?? .omo/evidence/manual-http-campaign-summary-cosmicpath.txt
?? .omo/evidence/manual-http-clean-brand-cosmicpath.txt
?? .omo/evidence/manual-http-create-stale-publish-guard-post.txt
?? .omo/evidence/manual-http-generate-cosmicpath.txt
?? .omo/evidence/manual-http-posts-audit-cosmicpath.txt
?? .omo/evidence/manual-http-sprint-brand-cosmicpath.txt
?? .omo/evidence/plan-checklist-complete.txt
?? .omo/evidence/publish-safety-route-tests.txt
?? .omo/evidence/red-cosmicpath-viral-upgrade.txt
?? .omo/evidence/reviewer-9-dashboard-memory-contract.txt
?? .omo/evidence/reviewer-9-doc-prompt-contract.txt
?? .omo/evidence/reviewer-9-fix-generate-route-tests.txt
?? .omo/evidence/reviewer-9-tiktok-contract.txt
?? .omo/evidence/reviewer-9-tiktok-fix-tests.txt
?? .omo/evidence/task-1-campaign-formulas.txt
?? .omo/evidence/task-1-no-reply-promise.txt
?? .omo/evidence/task-2-brand-memory.txt
?? .omo/evidence/task-2-no-reply-burden.txt
?? .omo/evidence/task-3-generate-prompt.txt
?? .omo/evidence/task-3-reply-ban.txt
?? .omo/evidence/task-4-reply-burden-gate.txt
?? .omo/evidence/task-4-self-classification-gate.txt
?? .omo/evidence/task-5-saveable-analysis.txt
?? .omo/evidence/task-5-self-classification-analysis.txt
?? .omo/evidence/task-6-manual-viral-tests.txt
?? .omo/evidence/task-6-swipe-file-docs.txt
?? .omo/evidence/task-7-generate-sprint.http
?? .omo/evidence/task-7-sprint-audit.txt
?? .omo/evidence/task-7-summary.http
?? .omo/evidence/task-7-viral-mode-matrix.txt
?? .omo/evidence/task-8-no-reply-requirement.txt
?? .omo/evidence/task-8-playbook-rules.txt
?? .omo/evidence/task-suite-cosmicpath-viral-upgrade.txt
?? .omo/evidence/tiktok-no-reply-burden-contract.txt
?? .omo/evidence/typecheck-cosmicpath-viral-upgrade.txt
?? .omo/plans/cosmicpath-viral-upgrade.md
?? .omo/start-work/
```

## Learnings Snapshot

```text
- Recurring bug: opaque external-source failure — Meta permission errors were collapsed into “일부 소스 실패” so the operator could not tell whether discovery failed because of no data or blocked API permission — Prevention: surface source error classes directly and provide a manual seed-handle fallback for permission-limited discovery.

## [2026-05-21] Cycle Learnings
- Recurring bug: cron implementation without deployment registration — 토큰 갱신 route가 있어도 `vercel.json` cron에 없으면 production에서는 자동 갱신이 돌지 않음 — Prevention: 새 cron endpoint를 만들 때 같은 변경에서 배포 스케줄과 README를 함께 갱신하기
- Recurring bug: fallback setup blocks primary workflow — legacy env-token 초기화 실패가 multi-brand refresh 전체를 막을 수 있음 — Prevention: fallback refresh는 non-blocking으로 처리하고 브랜드별 작업은 독립적으로 계속 실행하기

## [2026-06-01] Cycle Learnings
- Recurring bug: missing token refresh at publish boundary — refresh cron이 실패하거나 배포되지 않으면 앱 발행 경로가 만료 임박 토큰을 그대로 사용함 — Prevention: 모든 publisher 경로는 저장 토큰을 직접 쓰지 말고 발행 직전 fresh credentials 헬퍼를 통과하기
```

## Freeze Status

- Exit status: 0
- State: unfrozen

```text
unfrozen
```

## QA Plan

- Exit status: 0

```text
QA runner target: /Users/kim-young-gwang/Desktop/projects/threads-uploader
Mode: plan
Profile: qa
Package manager: npm

Selected scripts:
  - test
  - typecheck
  - lint
  - build
```
