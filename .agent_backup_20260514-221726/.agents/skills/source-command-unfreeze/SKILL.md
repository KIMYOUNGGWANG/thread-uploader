---
name: "source-command-unfreeze"
description: "Safely lift release freeze and route back to the right workflow (Orchestrator v7)"
---

# source-command-unfreeze

Use this skill when the user asks to run the migrated source command `unfreeze`.

## Command Template

# 🌤️ Unfreeze

릴리스 프리즈를 해제하고 일반 작업 루프로 복귀시키는 워크플로우.

## 0. Required Inputs
- [ ] Check current freeze state:
  - `bash .agent/scripts/freeze-state.sh status`
- [ ] Clarify why the freeze is being lifted.

## 1. Unfreeze Rules
- [ ] Unfreeze only after naming the reason and next workflow.
- [ ] If scope changed during freeze, route back to `/plan`.
- [ ] If a blocker still exists, route to `/fix` instead of pretending normal flow resumed.

## 2. PASS / FAIL Gate

### PASS
- [ ] Unfreeze reason is explicit.
- [ ] State file shows `frozen: false`.
- [ ] Next workflow is named.

### FAIL
- [ ] Freeze가 실제로 걸려 있지 않았는데 unfreeze를 시도한다.
- [ ] 이유 없이 그냥 흐름만 되돌린다.

## 3. Red Flags
- unresolved blocker가 남았는데 바로 develop로 복귀한다.
- scope가 바뀌었는데 plan을 거치지 않는다.

## 4. Artifact
- [ ] Run:
  - `bash .agent/scripts/freeze-state.sh unfreeze "reason"`
- [ ] Primary artifact: `.agent/runtime/release_freeze.json`

## 5. Handoff
- [ ] scope changed -> `/plan`
- [ ] blocker remains -> `/fix`
- [ ] normal implementation resumes -> `/develop`
