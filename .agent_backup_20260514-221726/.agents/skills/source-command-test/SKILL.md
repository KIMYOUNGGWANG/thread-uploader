---
name: "source-command-test"
description: "TDD-oriented testing workflow with test type selection and quality gates (Orchestrator v7)"
---

# source-command-test

Use this skill when the user asks to run the migrated source command `test`.

## Command Template

# 🧪 Test

기능 요구를 테스트로 잠그고 Red -> Green -> Refactor 로 진행하는 테스트 중심 워크플로우.

## 0. Required Inputs
- [ ] Read `docs/api-spec.md` if present.
- [ ] Read `.agent/memory/learnings.md` if present.
- [ ] Run `bash .agent/scripts/audit-status.sh`.
- [ ] Inspect runnable commands:
  - `bash .agent/scripts/qa-runner.sh plan . test`

## 1. Test Selection Rubric
- [ ] `Unit`: 순수 로직, parser, transformation, utility
- [ ] `Integration`: route, DB, auth, data boundary
- [ ] `E2E`: 핵심 사용자 플로우와 cross-layer behavior
- [ ] Choose the lightest test that proves the risk.

## 2. PASS / FAIL Gate

### PASS
- [ ] There is a failing test or failing verification first.
- [ ] Minimal code makes it pass.
- [ ] Refactor keeps the suite green.
- [ ] Coverage is meaningful for the changed risk.

### FAIL
- [ ] 테스트 없이 구현부터 시작한다.
- [ ] brittle snapshot or superficial assertion only.
- [ ] changed risk와 테스트 유형이 맞지 않는다.

## 3. Red Flags
- E2E로만 모든 걸 덮으려 한다.
- 느린 통합 테스트를 단위 테스트처럼 남발한다.
- 회귀를 막아야 할 경계를 assertion 없이 지나간다.

## 4. Artifact
- [ ] Create or update `.agent/memory/test-plan.md` when the test strategy matters.
- [ ] Execute the selected path:
  - `bash .agent/scripts/qa-runner.sh run . test`

## 5. Handoff
- [ ] implementation next -> `/develop`
- [ ] broader product validation next -> `/qa`
