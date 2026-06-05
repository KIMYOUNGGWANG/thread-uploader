---
name: "source-command-archived-v7-consolidated-qa-only"
description: "Minimal release-candidate QA for 1 to 3 critical flows (Orchestrator v7)"
---

# source-command-archived-v7-consolidated-qa-only

Use this skill when the user asks to run the migrated source command `archived-v7-consolidated-qa-only`.

## Command Template

# ✅ QA Only

전체 회귀 대신 배포 후보의 가장 중요한 1~3개 경로만 빠르게 검증하는 워크플로우.

## 0. Required Inputs
- [ ] Read `.agent/memory/task_board.md`.
- [ ] Read `.agent/memory/learnings.md` if present.
- [ ] Read `docs/api-spec.md` if present.
- [ ] Run `bash .agent/scripts/audit-status.sh`.
- [ ] Inspect runnable commands:
  - `bash .agent/scripts/qa-runner.sh plan . qa-only`

## 1. Quick Rubric
- [ ] Select only 1 to 3 flows tied to auth, money, destructive actions, or the main happy path.
- [ ] Include at least one non-happy-path check: error, permission, or rollback.
- [ ] Record residual risk for everything not checked.

## 2. PASS / FAIL Gate

### PASS
- [ ] Selected critical flows were actually checked.
- [ ] No `P0` blocker exists in those flows.
- [ ] Residual risk is explicitly stated.

### FAIL
- [ ] No real command or manual checklist was run.
- [ ] A critical flow failed.
- [ ] Recommendation ignores unresolved blocker severity.

## 3. Red Flags
- `시간 없으니 패스` 식으로 QA-only를 면제권처럼 쓴다.
- 배포 핵심 흐름이 아닌 쉬운 화면만 확인한다.
- 실패를 찾고도 full QA나 fix 없이 ship으로 넘긴다.

## 4. Artifact
- [ ] Run:
  - `bash .agent/scripts/qa-runner.sh run . qa-only`
- [ ] If a durable handoff is needed, keep the same QA surface:
  - `bash .agent/scripts/workflow-report.sh qa . plan`

## 5. Handoff
- [ ] blocker 있음 -> `/fix`
- [ ] candidate 안정화 필요 -> `/guard`
- [ ] 빠른 확인만으로 충분하고 최근 review가 green -> `/ship`
