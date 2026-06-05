---
name: "source-command-guard"
description: "Final decision gate between verification and ship (Orchestrator v7)"
---

# source-command-guard

Use this skill when the user asks to run the migrated source command `guard`.

## Command Template

# 🛡️ Guard

배포 직전 마지막 판단 워크플로우. QA와 review 근거를 다시 묶어서 `ship` 으로 갈지, 더 검증할지, 수정할지 결정한다.

## 0. Required Inputs
- [ ] Read `.agent/memory/task_board.md`, `.agent/memory/learnings.md`.
- [ ] Read `docs/api-spec.md` if present.
- [ ] Run `bash .agent/scripts/audit-status.sh`.
- [ ] Check release freeze status:
  - `bash .agent/scripts/freeze-state.sh status`
- [ ] Read latest QA and review reports when present.

## 1. Guard Rubric
- [ ] Contract drift 없음
- [ ] placeholder / mock / temporary bypass 없음
- [ ] QA evidence exists
- [ ] review hard blockers 없음
- [ ] residual risk is written in plain Korean
- [ ] next command is explicit

## 2. PASS / FAIL Gate

### PASS
- [ ] Ready for `/ship`

### SOFT FAIL
- [ ] More targeted validation needed -> `/qa-only`

### HARD FAIL
- [ ] Blocking defect or risk exists -> `/fix`

## 3. Red Flags
- 검증 근거 없이 감으로 `ship 가능` 판단한다.
- residual risk를 숨긴다.
- freeze 상태를 확인하지 않는다.

## 4. Artifact
- [ ] Use the latest QA / review artifacts as evidence.
- [ ] If needed, record the guard summary in the daily log.

## 5. Handoff
- [ ] PASS -> `/ship`
- [ ] SOFT FAIL -> `/qa-only`
- [ ] HARD FAIL -> `/fix`
