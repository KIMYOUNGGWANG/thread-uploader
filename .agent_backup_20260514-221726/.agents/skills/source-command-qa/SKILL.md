---
name: "source-command-qa"
description: "Release-quality QA with blocker classification, accessibility checks, and report handoff (Orchestrator v7)"
---

# source-command-qa

Use this skill when the user asks to run the migrated source command `qa`.

## Command Template

# 🕵️ QA

핵심 사용자 경로를 검증하고 blocker를 분류하는 QA 워크플로우. 자동화가 있으면 활용하고, 없으면 명확한 수동 체크리스트를 남긴다.

> [!TIP]
> 릴리스 직전 최소 경로만 빠르게 확인하고 싶으면 `/qa-only` 를 먼저 사용한다.

## 0. Required Inputs
- [ ] Read `.agent/memory/learnings.md` if present.
- [ ] Read `.agent/memory/task_board.md`.
- [ ] Read `docs/api-spec.md` if present.
- [ ] Run `bash .agent/scripts/audit-status.sh`.
- [ ] If Revenue OS state exists, inspect `bash .agent/scripts/revenue-status.sh .`.
- [ ] Inspect runnable commands:
  - `bash .agent/scripts/qa-runner.sh plan . qa`
- [ ] Reference `.agents/skills/quality/uat-checklist.md` for WCAG, i18n, responsive checks.

## 1. QA Rubric
- [ ] Happy path: 돈, 인증, 생성/수정, 삭제, 핵심 조회 흐름
- [ ] State coverage: loading, empty, error, success, permission denied
- [ ] Cross-surface checks: keyboard access, focus order, responsive layout, locale/text overflow
- [ ] Failure triage: classify issues as `P0`, `P1`, `P2`, `P3`
- [ ] Revenue QA: offer clarity, target specificity, CTA, price anchor, channel fit, and manual metric capture are checked.

## 2. PASS / FAIL Gate

### PASS
- [ ] 최소 한 개 이상의 실제 검증 경로가 실행됐다.
- [ ] 핵심 사용자 경로와 상태 체크가 문서화됐다.
- [ ] `P0` / `P1` blocker 가 없다.
- [ ] QA 결과가 `latest-qa-report` 로 남았다.

### FAIL
- [ ] 실행 가능한 검증 경로가 없다.
- [ ] 핵심 경로에 `P0` / `P1` blocker 가 있다.
- [ ] 접근성, 반응형, 에러 상태가 전혀 확인되지 않았다.
- [ ] Revenue experiment has no measurable next signal.

## 3. Red Flags
- 자동화가 없다는 이유로 QA를 건너뛴다.
- happy path만 보고 에러/권한/빈 상태를 무시한다.
- blocker severity 없이 `조금 불편함` 수준으로 뭉뚱그린다.

## 4. Artifact
- [ ] Execute the smallest real validation path:
  - `bash .agent/scripts/qa-runner.sh run . qa`
- [ ] Save the QA handoff artifact:
  - `bash .agent/scripts/workflow-report.sh qa . run`
  - Result: `.agent/runtime/reports/latest-qa-report.{md,json}`

## 5. Handoff
- [ ] `P0` / `P1` 발견 -> `/fix`
- [ ] QA green but release-sensitive -> `/guard`
- [ ] QA green and recent review also green -> `/ship`
- [ ] Log important findings:
  - `bash .agent/scripts/logger.sh ".agent/memory/daily/$(date +%Y-%m-%d).md" "QA" "[핵심 경로, blocker, 다음 단계]"`
