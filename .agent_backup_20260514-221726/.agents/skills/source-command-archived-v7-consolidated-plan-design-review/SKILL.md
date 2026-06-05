---
name: "source-command-archived-v7-consolidated-plan-design-review"
description: "7-pass UX, state, and interaction review for a draft plan (Orchestrator v7)"
---

# source-command-archived-v7-consolidated-plan-design-review

Use this skill when the user asks to run the migrated source command `archived-v7-consolidated-plan-design-review`.

## Command Template

# 🎨 Plan Design Review

계획안을 사용자 흐름, 상태 설계, 반응형, 접근성, 디자인 리스크 기준으로 재작성하는 디자인 검토 렌즈.
목표는 vague한 UI 설명을 `docs/screen-flow.md` 수준의 화면 계약으로 끌어올려 `/develop` 가 그대로 구현할 수 있게 만드는 것이다.

## 0. Required Inputs
- [ ] Read `.agent/memory/task_board.md`.
- [ ] Read `docs/api-spec.md` if present.
- [ ] Read `docs/office-hours.md` if present.
- [ ] Read `docs/screen-flow.md` if present.
- [ ] Reference starter template: `docs/templates/screen-flow-template.md`.
- [ ] Read `DESIGN.md` if present.
- [ ] Read product context and design constraints.
- [ ] Read `.agents/skills/engineering/screen-flow-template.md`.
- [ ] If the plan has meaningful UI scope and `docs/screen-flow.md` does not exist, create it from the template before scoring.

## 1. Review Goal
- [ ] Convert feature talk into screen, route, action, and state decisions.
- [ ] Keep the MVP interaction model simple enough to ship without hidden state explosion.
- [ ] Catch user confusion before implementation, not during QA.
- [ ] Reuse existing design vocabulary instead of inventing ad-hoc UI.

## 2. Preflight
- [ ] Is there a real user-facing flow here? If not, record `Design review not required` and return to `/plan` or `/develop`.
- [ ] Name the primary user, primary promise, and primary screen or route.
- [ ] List 1 to 3 core scenarios that must work on the first release.
- [ ] Identify which part of the flow is most likely to confuse, block, or overload the user.
- [ ] Freeze the review around user behavior, not component naming.

## 3. Review Rubric

7-pass 디자인 리뷰로 UX 계약의 완성도를 점검한다.

### Pass 1. Information Architecture
- [ ] Score 0 to 10: Is the first-time path obvious?
- [ ] Check screen inventory, route purpose, entry condition, exit path, primary CTA, and navigation hierarchy.
- [ ] Fix to 10 by defining primary vs secondary information, auth redirects, and what the user sees first.
- [ ] Write the result into `docs/screen-flow.md`:
  - Core scenarios
  - Screen inventory
  - Navigation rules

### Pass 2. Interaction State Coverage
- [ ] Score 0 to 10: Does every core feature define user-visible states?
- [ ] Cover at least loading, empty, error, success, permission, and partial states.
- [ ] Treat empty states as product behavior, not placeholder copy.
- [ ] Fix to 10 by completing the Interaction State Matrix in `docs/screen-flow.md`.

### Pass 3. User Journey and Emotional Arc
- [ ] Score 0 to 10: Does the plan explain how the user feels and recovers?
- [ ] Check onboarding friction, waiting moments, reassurance, confirmation, and retry paths.
- [ ] Fix to 10 by documenting the emotional arc and the UI support for each step.

### Pass 4. AI Slop and Intentionality
- [ ] Score 0 to 10: Is the UI described with taste or with generic template words?
- [ ] Flag vague phrases like `clean modern`, `cards with icons`, `hero with gradient`, `simple dashboard`.
- [ ] Fix to 10 by rewriting those phrases into specific layout, hierarchy, motion, copy, or component decisions.
- [ ] Prefer intentional references to existing product patterns over generic styling adjectives.

### Pass 5. Design System and Reuse
- [ ] Score 0 to 10: Does the plan reuse the existing visual and interaction vocabulary?
- [ ] If `DESIGN.md` exists, cite relevant tokens, component patterns, or layout rules.
- [ ] If no design source of truth exists, explicitly name the gap instead of inventing a fake system.
- [ ] Mark which components should be reused, which need extension, and which are genuinely new.

### Pass 6. Responsive and Accessibility
- [ ] Score 0 to 10: Will the primary flow work on mobile, tablet, desktop, keyboard, and screen reader paths?
- [ ] Specify layout changes by breakpoint, minimum touch target size, focus behavior, and recovery from errors.
- [ ] Fix to 10 by filling responsive rules and a11y expectations in `docs/screen-flow.md`.
- [ ] Primary flow UX is incomplete until mobile behavior is named.

### Pass 7. Unresolved Decisions and Scope Cuts
- [ ] Score 0 to 10: Are the remaining decisions explicit and bounded?
- [ ] Surface genuine tradeoffs only:
  - build now
  - defer with consequence
  - cut from MVP
- [ ] Create a `Not In Scope` list so deferred design work does not quietly leak into `/develop`.
- [ ] If the interaction model is too complex for MVP, cut scope here instead of hoping implementation simplifies it later.

## 4. Scoring Rule
- [ ] Record a before and after score for each pass.
- [ ] If the fix is obvious, update the artifact directly instead of asking for permission.
- [ ] Only escalate to the user when there is a real design tradeoff with product impact.
- [ ] A score below 8 means the pass still has unresolved UX debt that should block `/develop`.

## 5. PASS / FAIL Gate

### PASS
- [ ] `docs/screen-flow.md` exists for UI work and includes:
  - Core scenarios
  - Screen inventory
  - Interaction State Matrix
  - Navigation rules
  - Responsive notes
  - Emotional arc
- [ ] `.agent/memory/plan-design-review.md` contains:
  - Overall score before and after
  - Pass-by-pass findings
  - Key fixes applied
  - Unresolved decisions
  - `Not In Scope`
  - Recommendation: `Proceed` or `Revise`
- [ ] The primary flow is obvious and user-blocking states are no longer implicit.
- [ ] Deferred design debt is named with consequence.

### FAIL
- [ ] happy path 외 상태가 비어 있다.
- [ ] 화면 목록은 있는데 상태와 전환 규칙이 없다.
- [ ] mobile or accessibility behavior is missing for the primary flow.
- [ ] visual adjectives replace actual UX decisions.
- [ ] interaction model이 MVP 치고 너무 복잡하다.

## 6. Red Flags
- visual polish 얘기만 하고 실제 흐름/상태는 안 본다.
- 사용자 행동보다 컴포넌트 나열에 머문다.
- `No items found` 같은 빈 상태를 디자인 완료로 착각한다.
- 인증/권한/리다이렉트 규칙을 화면 설계 밖으로 밀어낸다.
- modal, wizard, tabs를 추가하면서 상태 증가 비용을 계산하지 않는다.
- `clean`, `modern`, `simple` 같은 말로 판단을 끝낸다.

## 7. Artifact
- [ ] Create or update `docs/screen-flow.md`.
- [ ] Create or update `.agent/memory/plan-design-review.md`.
- [ ] If design fixes change plan assumptions, sync the affected sections in:
  - `.agent/memory/task_board.md`
  - `docs/api-spec.md`
- [ ] Use this structure for `.agent/memory/plan-design-review.md`:

```md
# Plan Design Review

> Recommendation: Proceed | Revise
> Overall Score: [before]/10 -> [after]/10

## Pass Scores
- Information Architecture: [before] -> [after]
- Interaction State Coverage: [before] -> [after]
- User Journey and Emotional Arc: [before] -> [after]
- AI Slop and Intentionality: [before] -> [after]
- Design System and Reuse: [before] -> [after]
- Responsive and Accessibility: [before] -> [after]
- Unresolved Decisions and Scope Cuts: [before] -> [after]

## Key Fixes Applied
- ...

## What Already Exists
- ...

## Unresolved Decisions
- ...

## Not In Scope
- ...

## Handoff
- Return to `/plan` to lock board and spec
- or proceed to `/develop` if no blocking UX gaps remain
```

## 8. Handoff
- [ ] If any pass remains below 8, return to `/plan` with explicit revisions.
- [ ] If all critical passes are 8+ and unresolved items are bounded, proceed to `/develop`.
- [ ] If the main issue is product direction, escalate to `/plan-ceo-review`.
- [ ] If the main issue is implementation risk, escalate to `/plan-eng-review`.
