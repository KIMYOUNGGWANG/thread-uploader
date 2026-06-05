---
name: "source-command-ship"
description: "Final ship gate with contract, canary, residual risk, and handoff reporting (Orchestrator v7)"
---

# source-command-ship

Use this skill when the user asks to run the migrated source command `ship`.

## Command Template

# 🚢 Ship

출하 직전 최종 게이트. 배포 명령을 대신 실행하는 것이 아니라, `지금 내보내도 되는가` 를 판단하고 근거를 남긴다.

## 0. Required Inputs
- [ ] Read `.agent/memory/learnings.md` if present.
- [ ] Run `bash .agent/scripts/audit-status.sh`.
- [ ] Check release freeze state:
  - `bash .agent/scripts/freeze-state.sh status`
- [ ] Read latest QA and review artifacts when present:
  - `.agent/runtime/reports/latest-qa-report.{md,json}`
  - `.agent/runtime/reports/latest-review-report.{md,json}`
- [ ] Read `docs/api-spec.md` when contract-driven.
- [ ] If Revenue OS state exists, read `bash .agent/scripts/revenue-status.sh .`.

## 1. Ship Rubric
- [ ] Contract: spec drift, placeholder data, unfinished wiring 없음
- [ ] Verification: runnable QA path, review findings, known risks 확인됨
- [ ] Operations: freeze state, release note, rollback/canary 생각이 있음
- [ ] UX: core responsive/accessibility issues가 남아 있지 않음
- [ ] Revenue: ship action is explicit: deploy, publish, send to customer, start campaign, or deliver report.

## 2. Canary Checklist
- [ ] What is the smallest safe rollout surface?
- [ ] What metric or signal says the release is healthy?
- [ ] What is the rollback trigger?

## 3. PASS / FAIL Gate

### PASS
- [ ] No hard blocker from QA or review.
- [ ] Residual risk is documented.
- [ ] Canary or rollback thinking exists for risky changes.
- [ ] Ship report is written.

### FAIL
- [ ] Freeze state is unknown or candidate is unstable.
- [ ] Review/QA hard blockers are unresolved.
- [ ] There is no clear next action if deployment is not run now.
- [ ] Revenue score is `blocked` without a manual override and risk note.

## 4. Red Flags
- `테스트는 안 돌렸지만 아마 될 것` 식으로 ship을 밀어붙인다.
- ship을 deployment와 혼동해 보고서 없이 끝낸다.
- rollback 기준 없이 위험한 변경을 한 번에 내보내려 한다.

## 5. Artifact
- [ ] Save the release snapshot:
  - `bash .agent/scripts/workflow-report.sh ship .`
  - Result: `.agent/runtime/reports/latest-ship-report.{md,json}`
- [ ] Update `learnings.md` with one release-quality lesson when meaningful.
- [ ] Sync to hub global learnings (자동 실행):
  - `bash .agent/scripts/sync-learnings.sh . --auto`

## 6. Handoff
- [ ] Deployment desired and ship gate clean -> user may run deploy path
- [ ] More confidence needed -> `/guard`
- [ ] Blocker exists -> `/fix`
