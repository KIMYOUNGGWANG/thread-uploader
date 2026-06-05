---
name: "source-command-plan"
description: "Scope lock and contract lock before `/develop` (Orchestrator v7)"
---

# source-command-plan

Use this skill when the user asks to run the migrated source command `plan`.

## Command Template

# 📐 Plan

문제 정의를 실행 가능한 작업판과 계약 문서로 잠그는 계획 워크플로우. 산출물은 `.agent/memory/task_board.md` 와 `docs/api-spec.md` 두 개가 핵심이다.

> [!TIP]
> `docs/office-hours.md` 가 없다면 `/office-hours` 로 먼저 문제를 압축하는 것이 기본 경로다.

## 0. Required Inputs
- [ ] Read `README.md`, the user request, and `.agent/memory/task_board.md` if present.
- [ ] Read `conductor/product.md` if present.
- [ ] Read `docs/office-hours.md` first when it exists.
- [ ] Detect runtime mode:
  - `bash .agent/scripts/runtime-mode.sh .`
- [ ] If `PRIMARY_MODE=codex`, Codex owns planning and may run:
  - `bash .agent/scripts/codex-plan.sh --dry-run "<mission>" .`
- [ ] Load planning context when needed:
  - `bash .agent/scripts/smart-skill-loader.sh "architecture api design business strategy" --concat --strict`

## 1. Scope Lock Questions
- [ ] Who is the primary user and what exact outcome are we promising?
- [ ] What is in scope now, later, and explicitly out of scope?
- [ ] What is the narrowest useful flow that proves the value?
- [ ] Which assumptions could change schema, storage, auth, or UI states?
- [ ] What validation commands or manual checks will prove this plan works?
- [ ] If this is Revenue OS work, choose one mode: `idea-validation`, `offer-design`, `landing-test`, `mvp-build`, `viral-content`, `agency-delivery`, or `weekly-review`.

## 2. Planning Rubric
- [ ] Product: problem, wedge, and success criteria are concrete.
- [ ] Revenue: target customer, offer, price, channel, and manual metrics plan are explicit before large build work.
- [ ] Design: primary flow, screen entry/exit, and loading, empty, error, success, permission states are covered.
- [ ] Engineering: boundaries, contracts, data ownership, and validation paths are implementable with the current stack.
- [ ] Runtime: Codex is optional; Codex Primary may produce plan artifacts when Codex is missing.
- [ ] Escalate to optional lenses only when needed:
  - `plan-ceo-review` for value, wedge, viability
  - `plan-eng-review` for architecture and risk
  - `plan-design-review` for states and UX

## 3. PASS / FAIL Gate

### PASS
- [ ] `.agent/memory/task_board.md` contains:
  - Mission
  - Scope now / later / out
  - 3 to 7 implementation steps
  - Validation commands or manual checks
  - Risks and open questions
- [ ] `docs/api-spec.md` contains:
  - Primary flow and actors
  - Endpoints, actions, or data contracts
  - Request/response shapes
  - Auth, error, and empty-state behavior
  - Non-goals or deferred cases
- [ ] Every board item maps to at least one contract surface.

### FAIL
- [ ] Scope is still a wishlist.
- [ ] Board and spec disagree on names, flows, or boundaries.
- [ ] Validation path is missing.
- [ ] Key data/auth assumptions are still implicit.

## 4. Red Flags
- `MVP` 라고 쓰지만 실제로는 다기능 플랫폼이다.
- API spec 없이 구현 우선으로 넘어가려 한다.
- 성공 기준이 `잘 되면 좋다` 수준이다.
- 상태 설계 없이 happy path만 정의한다.
- 현재 스택에서 불가능한 통합이 당연한 것처럼 들어가 있다.

## 5. Artifact
- [ ] Update `.agent/memory/task_board.md`.
- [ ] Create or update `docs/api-spec.md`.
- [ ] Create or update `docs/screen-flow.md` when the work includes multi-screen UX, auth paths, or non-trivial state behavior.
- [ ] For Revenue OS work, create or update `.agent/memory/revenue/experiments/<slug>.json` from `.agent/templates/revenue-os/`.
- [ ] Score the experiment when evidence exists:
  - `bash .agent/scripts/revenue-score.sh .agent/memory/revenue/experiments/<slug>.json`
- [ ] If major tradeoffs remain, capture them in the relevant review lens artifact:
  - `.agent/memory/plan-ceo-review.md`
  - `.agent/memory/plan-eng-review.md`
  - `.agent/memory/plan-design-review.md`

## 6. Handoff
- [ ] `/develop` must not start until both `task_board.md` and `docs/api-spec.md` exist and agree.
- [ ] If value is weak, go to `/plan-ceo-review`.
- [ ] If architecture is shaky, go to `/plan-eng-review`.
- [ ] If UX states are under-specified, go to `/plan-design-review` and complete `docs/screen-flow.md`.
- [ ] Log the planning session:
  - `bash .agent/scripts/logger.sh ".agent/memory/daily/$(date +%Y-%m-%d).md" "PLAN" "[scope lock, contract lock, next step 요약]"`
