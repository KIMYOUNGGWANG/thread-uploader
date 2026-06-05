---
name: "source-command-archived-v7-consolidated-plan-eng-review"
description: "Feasibility and risk review for architecture, contracts, and validation paths (Orchestrator v7)"
---

# source-command-archived-v7-consolidated-plan-eng-review

Use this skill when the user asks to run the migrated source command `archived-v7-consolidated-plan-eng-review`.

## Command Template

# 🛠️ Plan Engineering Review

계획안을 구현 가능성, 경계, 테스트 전략 기준으로 검토하는 엔지니어링 렌즈.

## 0. Required Inputs
- [ ] Read `.agent/memory/task_board.md`.
- [ ] Read `docs/api-spec.md`.
- [ ] Read constitutions or architecture notes when relevant.

## 1. Engineering Rubric
- [ ] Is the scope implementable with the current stack and time budget?
- [ ] Are contracts explicit enough for strict typing and integration?
- [ ] What are the top technical risks and failure modes?
- [ ] What validation path is required before ship?

## 2. PASS / FAIL Gate

### PASS
- [ ] Feasibility judgement is explicit.
- [ ] Risks and required validations are named.
- [ ] Architecture unknowns are bounded.

### FAIL
- [ ] `될 것 같다` 수준의 추정뿐이다.
- [ ] contract ambiguity가 큰데도 develop로 넘긴다.

## 3. Red Flags
- hidden dependency, migration, auth boundary를 무시한다.
- 테스트 비용을 계획에서 빼버린다.

## 4. Artifact
- [ ] Create or update `.agent/memory/plan-eng-review.md`.

## 5. Handoff
- [ ] revise plan -> `/plan`
- [ ] plan feasible -> `/develop`
