---
name: "source-command-freeze"
description: "Lock a release candidate and narrow allowed work until verification completes (Orchestrator v7)"
---

# source-command-freeze

Use this skill when the user asks to run the migrated source command `freeze`.

## Command Template

# 🧊 Freeze

배포 후보를 안정화 모드로 전환하는 워크플로우. 기능 확장을 멈추고 검증, 수정, handoff 중심으로 흐름을 바꾼다.

## 0. Required Inputs
- [ ] Read `.agent/memory/task_board.md`.
- [ ] Run `bash .agent/scripts/audit-status.sh`.
- [ ] Confirm why the candidate is worth stabilizing now.

## 1. Freeze Rules
- [ ] Record the freeze:
  - `bash .agent/scripts/freeze-state.sh freeze "reason"`
- [ ] Confirm `.agent/runtime/release_freeze.json` shows `frozen: true`.
- [ ] While frozen, only allow `/qa-only`, `/qa`, `/review`, `/guard`, `/ship`, `/fix`.

## 2. PASS / FAIL Gate

### PASS
- [ ] Freeze reason is explicit.
- [ ] State file is updated.
- [ ] Next verification step is named.

### FAIL
- [ ] Freeze was declared without a reason.
- [ ] Candidate is still taking unrelated feature work.

## 3. Red Flags
- freeze 중에 scope 확장이 계속 발생한다.
- state file 확인 없이 말로만 freeze를 선언한다.

## 4. Artifact
- [ ] Primary artifact: `.agent/runtime/release_freeze.json`

## 5. Handoff
- [ ] Verification next -> `/qa-only` or `/qa`
- [ ] Release decision next -> `/guard`
- [ ] Blocking issue next -> `/fix`
