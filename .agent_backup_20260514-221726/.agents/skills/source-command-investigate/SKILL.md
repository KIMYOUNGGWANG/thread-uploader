---
name: "source-command-investigate"
description: "Investigation-first workflow for RCA, hypothesis building, and scope locking (Orchestrator v7)"
---

# source-command-investigate

Use this skill when the user asks to run the migrated source command `investigate`.

## Command Template

# 🕵️ Investigate

원인 미상의 버그나 이상 동작을 수정 전에 조사하는 RCA 워크플로우. 목표는 `무엇을 고칠지`가 아니라 `왜 이런 현상이 생겼는지`를 한 문장으로 확정하는 것이다.

## 0. Required Inputs
- [ ] Read `.agent/memory/task_board.md`.
- [ ] Read `.agent/memory/learnings.md` if present.
- [ ] Read `docs/api-spec.md` if the issue touches contract behavior.
- [ ] Load debugging skills:
  - `bash .agent/scripts/smart-skill-loader.sh "debugging root-cause hypothesis binary search 5-why" --concat --strict`

## 1. Investigation Protocol
- [ ] Reproduce the issue or define the smallest failing path.
- [ ] List at least 3 hypotheses before any code fix.
- [ ] Gather evidence:
  - error message / stack trace
  - logs or network response
  - recent relevant change
  - affected scope
- [ ] Narrow the edit area and freeze it if known:
  - `bash .agent/scripts/check-freeze.sh --set <directory>`
- [ ] Use 5-Why, binary search debugging, compare-good-vs-bad, or boundary tracing from `debugging-strategies.md`.

## 2. PASS / FAIL Gate

### PASS
- [ ] Reproduction path is documented.
- [ ] 3 hypotheses are listed.
- [ ] One hypothesis is supported enough to name a root cause.
- [ ] Next fix scope and validation plan are explicit.

### FAIL
- [ ] Reproduction is unknown.
- [ ] Investigation is just log dumping with no hypothesis table.
- [ ] Root cause is still a guess with no evidence.

## 3. Red Flags
- 코드를 먼저 고치고 나중에 이유를 붙인다.
- 증거 없이 외부 서비스 탓으로 돌린다.
- 문제 범위를 모르는데 파일 여러 개를 동시에 수정한다.

## 4. Artifact
- [ ] Create or replace `.agent/memory/investigation.md`.
- [ ] Reference template: `docs/templates/investigation-template.md`
- [ ] Use this structure:

```md
# Investigation

> Status: investigating | root cause identified | needs more evidence

## Symptom
- ...

## Reproduction
- ...

## Hypotheses
1. ...
2. ...
3. ...

## Evidence
- ...

## Root Cause
- ...

## Fix Scope
- Files or directories:
- Validation path:
```

## 5. Handoff
- [ ] Root cause identified -> `/fix`
- [ ] Scope too wide or destructive recovery likely -> `/careful`
- [ ] No reproduction yet -> stay in `/investigate`
