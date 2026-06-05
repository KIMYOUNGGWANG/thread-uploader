---
name: "source-command-archived-v7-consolidated-careful"
description: "Pre-flight safety gate for destructive commands and risky operations (Orchestrator v7)"
---

# source-command-archived-v7-consolidated-careful

Use this skill when the user asks to run the migrated source command `archived-v7-consolidated-careful`.

## Command Template

# 🧯 Careful

파괴적 명령, 대규모 삭제, 데이터 손실 가능 작업을 실행하기 전에 위험도를 분류하고 더 안전한 대안을 제시하는 워크플로우.

## 0. Required Inputs
- [ ] Read the requested command, target files, and current task scope.
- [ ] Read `.agent/memory/task_board.md` if present.
- [ ] Read `.agent/memory/investigation.md` if this is bug recovery work.
- [ ] Reference `.agents/skills/engineering/safety-guardrails.md` for risk patterns.

## 1. Safety Rubric
- [ ] Classify the action:
  - `Critical`: `rm -rf`, `git reset --hard`, destructive DB operations, force push
  - `High`: scope-wide deletes, permission rewrites, dependency churn, env rewrites
  - `Medium`: interactive history edits, config changes, manual recovery steps
- [ ] State impact, rollback difficulty, and whether explicit user approval is required.
- [ ] Propose the safest alternative first.

## 2. PASS / FAIL Gate

### PASS
- [ ] Risk level is explicit.
- [ ] A safer alternative or recovery path is documented.
- [ ] If approval is needed, the workflow stops before the action.

### FAIL
- [ ] The action is risky but no warning is surfaced.
- [ ] Scope, impact, or rollback path is unknown.

## 3. Red Flags
- 위험 명령을 편의상 평범한 작업처럼 취급한다.
- 백업 없이 삭제/리셋부터 제안한다.
- 현재 task scope 밖 파일을 한 번에 만지려 한다.

## 4. Artifact
- [ ] Create or update `.agent/memory/careful-check.md` when the check is material.
- [ ] Include:
  - command or action
  - risk level
  - impact
  - safer alternative
  - approval requirement

## 5. Handoff
- [ ] Critical or unknown risk -> stop and require explicit approval.
- [ ] Scope-sensitive bug work -> `/investigate` or `/freeze`
- [ ] Release-sensitive work -> `/guard`
