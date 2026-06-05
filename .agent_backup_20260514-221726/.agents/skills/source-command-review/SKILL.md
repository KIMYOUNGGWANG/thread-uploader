---
name: "source-command-review"
description: "Severity-based review for contract, security, regression, and maintainability (Orchestrator v7)"
---

# source-command-review

Use this skill when the user asks to run the migrated source command `review`.

## Command Template

# 🔍 Review

보안, 계약 준수, 성능, 회귀 위험을 severity 기반으로 검토하는 코드 리뷰 워크플로우. 결과는 항상 finding-first 로 정리한다.

## 0. Required Inputs
- [ ] Read `.agent/memory/learnings.md` if present.
- [ ] Run `bash .agent/scripts/audit-status.sh`.
- [ ] Read `docs/api-spec.md` when the project is contract-driven.
- [ ] Read `.agent/memory/task_board.md`.
- [ ] Read the latest QA artifact if present:
  - `.agent/runtime/reports/latest-qa-report.md`
  - `.agent/runtime/reports/latest-qa-report.json`

## 1. Review Rubric
- [ ] Contract & regression: 구현이 `docs/api-spec.md` 와 어긋나지 않는가?
- [ ] Security: auth, authorization, input validation, secret exposure, injection, unsafe mutations.
- [ ] Data & performance: expensive queries, repeated renders, missing boundaries, resource leaks.
- [ ] Maintainability: hidden coupling, duplicated logic, brittle branching, unclear ownership.
- [ ] Test gaps: 현재 변경을 막아줄 검증이 있는가?

## 2. PASS / FAIL Gate

### PASS
- [ ] `Critical` / `High` 미해결 이슈가 없다.
- [ ] Contract drift 가 없다.
- [ ] 남은 위험과 검증 공백이 명시되었다.
- [ ] 리뷰 결과를 `latest-review-report` 로 남겼다.

### FAIL
- [ ] Critical security or data-loss risk exists.
- [ ] High regression risk or contract mismatch exists.
- [ ] 검증 공백이 커서 ship 판단이 불가능하다.

## 3. Red Flags
- 스타일/취향 코멘트만 있고 행동 가능한 finding 이 없다.
- spec를 안 읽고 구현 추측으로 리뷰한다.
- severity 없이 한 줄 감상만 남긴다.
- 테스트 부재를 `나중에` 로 넘긴다.

## 4. Artifact
- [ ] Use machine-readable finding lines:
  - `- Critical: ...`
  - `- High: ...`
  - `- Medium: ...`
  - `- Low: ...`
- [ ] Save detailed notes to `.agent/memory/security_audit.md` only when needed.
- [ ] Generate the reusable handoff artifact:
  - `bash .agent/scripts/workflow-report.sh review .`
  - Result: `.agent/runtime/reports/latest-review-report.{md,json}`

## 5. Handoff
- [ ] `FAIL` -> `/fix`
- [ ] `PASS` with residual risk -> `/guard`
- [ ] `PASS` with clean QA + no blockers -> `/ship`
- [ ] Log the session:
  - `bash .agent/scripts/logger.sh ".agent/memory/daily/$(date +%Y-%m-%d).md" "REVIEW" "[severity summary, residual risk, next step]"`
