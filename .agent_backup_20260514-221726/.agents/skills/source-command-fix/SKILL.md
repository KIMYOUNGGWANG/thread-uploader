---
name: "source-command-fix"
description: "Root-cause-first bug fixing with investigation handoff and anti-band-aid rules (Orchestrator v7)"
---

# source-command-fix

Use this skill when the user asks to run the migrated source command `fix`.

## Command Template

# 🚑 Fix

수정 자체보다 원인 규명과 재발 방지를 우선하는 버그 수정 워크플로우. 가설 없이 바로 패치하지 않는다.

## 0. Required Inputs
- [ ] Read `docs/api-spec.md` if present.
- [ ] Read `.agent/memory/task_board.md`.
- [ ] Read `.agent/memory/learnings.md` if present.
- [ ] Read `.agent/memory/investigation.md` if it exists.
- [ ] Run `bash .agent/scripts/audit-status.sh`.
- [ ] If Revenue OS state exists, read `bash .agent/scripts/revenue-status.sh .` and treat weak metrics as evidence, not opinion.
- [ ] Load debugging and domain skills when needed:
  - `bash .agent/scripts/smart-skill-loader.sh "debugging root-cause hypothesis <bug-type>" --concat --strict`

## 1. Root Cause Protocol
- [ ] Reproduce the issue or identify the smallest failing path.
- [ ] Write at least 3 hypotheses before changing code.
- [ ] For each hypothesis, capture evidence or a falsification check.
- [ ] If the likely edit area is known, freeze scope first:
  - `bash .agent/scripts/check-freeze.sh --set <directory>`
- [ ] If root cause is still unclear, route to `/investigate` first.
- [ ] For Revenue OS fixes, identify whether the failure is target, offer, price, channel, asset quality, or measurement.

## 2. Implementation Rules
- [ ] Only patch after one hypothesis is supported by evidence.
- [ ] Keep the fix surgical and aligned with `docs/api-spec.md`.
- [ ] Re-run the smallest real validation path before broadening scope:
  - project command, targeted test, or `bash .agent/scripts/qa-runner.sh run . test`
- [ ] Update `.agent/memory/investigation.md` with the confirmed root cause and chosen repair.

## 3. PASS / FAIL Gate

### PASS
- [ ] Root cause is stated in one sentence.
- [ ] The fix addresses the confirmed cause, not just the symptom.
- [ ] Relevant test or validation path is green.
- [ ] Recurrence prevention is added to `learnings.md`.

### FAIL
- [ ] Same file is being edited repeatedly without a new hypothesis.
- [ ] Validation is still failing or unrun.
- [ ] The patch creates contract drift or unrelated scope expansion.
- [ ] A weak revenue signal is hidden by building more features instead of revising, validating, or killing the experiment.

## 4. Red Flags
- 추측만으로 `일단 바꿔보고` 패치한다.
- 원인 문장 없이 로그만 늘린다.
- 동일 파일을 3회 이상 다시 만지면서 가설이 바뀌지 않는다.
- 재현 경로 없이 `고쳐진 것 같다`고 말한다.

## 5. Artifact
- [ ] Primary artifact: `.agent/memory/investigation.md`
- [ ] Update learnings:
  - `- Recurring bug: [type] - [root cause] - Prevention: [action]`
- [ ] If the bug is fixed, log the result:
  - `bash .agent/scripts/logger.sh ".agent/memory/daily/$(date +%Y-%m-%d).md" "FIX" "[원인, 수정, 검증 명령 요약]"`

## 6. Handoff
- [ ] Root cause unknown -> `/investigate`
- [ ] Fix verified, broader feature still ongoing -> `/develop`
- [ ] Fix verified, release candidate blocked -> `/qa` or `/qa-only`
- [ ] Band-aid suspicion remains -> load `critic-gate.md` and stop if needed
