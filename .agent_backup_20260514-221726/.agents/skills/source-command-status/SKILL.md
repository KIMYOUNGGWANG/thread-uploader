---
name: "source-command-status"
description: "Read-only health check using audit, task progress, learnings, and latest reports (Orchestrator v7)"
---

# source-command-status

Use this skill when the user asks to run the migrated source command `status`.

## Command Template

# 📊 Status

읽기 전용 상태 보고 워크플로우. 현재 작업이 어디에 있는지, 무엇이 막고 있는지, 다음 액션이 무엇인지 짧게 보여준다.

## 0. Required Inputs
- [ ] Run `bash .agent/scripts/audit-status.sh`.
- [ ] Read `.agent/memory/task_board.md` if present.
- [ ] Read `.agent/memory/learnings.md` if present.
- [ ] Read latest daily log if present.
- [ ] Read latest QA / review / ship reports if present.
- [ ] If `.agent/memory/revenue` exists, run `bash .agent/scripts/revenue-status.sh .`.

## 1. Health Rubric
- [ ] `Green`: recent reports pass, no hard blockers, task board moving
- [ ] `Yellow`: warnings/manual blockers exist, more validation needed
- [ ] `Red`: hard blocker, missing contract, dirty freeze state, or broken validation path
- [ ] Revenue OS: show the latest Evidence Score and whether the next action is `scale/build`, `validate_next`, `revise_offer`, `kill_or_pivot`, or `blocked`.

## 2. PASS / FAIL Gate

### PASS
- [ ] A clear health score is produced.
- [ ] One primary next action is named.
- [ ] The summary is shorter than the raw audit output.

### FAIL
- [ ] The workflow only dumps raw logs without synthesis.
- [ ] No next action is recommended.
- [ ] Latest reports are ignored even though they exist.
- [ ] Revenue evidence is ignored when a revenue experiment exists.

## 3. Red Flags
- audit output를 그대로 붙여넣고 해석이 없다.
- latest reports를 읽지 않고 추측으로 다음 액션을 추천한다.

## 4. Artifact
- [ ] Primary artifact is the Korean status card in the response.
- [ ] Read-only rule: do not modify repo-tracked files by default.

## 5. Handoff
- [ ] Recommend one primary next action:
  - `/plan`
  - `/develop`
  - `/qa`
  - `/review`
  - `/ship`
  - `/fix`
