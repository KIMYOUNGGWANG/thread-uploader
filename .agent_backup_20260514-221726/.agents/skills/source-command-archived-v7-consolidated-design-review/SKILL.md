---
name: "source-command-archived-v7-consolidated-design-review"
description: "Post-implementation visual and interaction review with anti-slop, goodwill, and system reuse gates (Orchestrator v7)"
---

# source-command-archived-v7-consolidated-design-review

Use this skill when the user asks to run the migrated source command `archived-v7-consolidated-design-review`.

## Command Template

# 🖼️ Design Review

구현된 화면을 시각 품질, 상호작용 명확성, 상태 표현, 디자인 시스템 재사용 기준으로 검토하는 구현 후 디자인 리뷰 워크플로우.
목표는 "보기 좋다" 수준의 감상에서 멈추지 않고, 실제 사용자 신뢰와 제품 일관성을 높이는 수정 포인트를 남기는 것이다.

## 0. Required Inputs
- [ ] Read `.agent/memory/task_board.md`.
- [ ] Read `docs/screen-flow.md` if present.
- [ ] Read `DESIGN.md` if present.
- [ ] Read `docs/api-spec.md` if the UI is contract-driven.
- [ ] Read `.agent/memory/uiux-review.md` if present.
- [ ] Run `bash .agent/scripts/audit-status.sh`.
- [ ] Inspect the implemented surface, not just the intended design description.
- [ ] If no meaningful UI surface was changed, record `Design review not required` and return to `/review` or `/qa`.

## 1. Review Goal
- [ ] Verify that the shipped surface matches the intended flow and visual direction.
- [ ] Catch AI-slop, weak hierarchy, and low-trust interaction details before `/ship`.
- [ ] Prefer actionable fixes over abstract taste commentary.
- [ ] Protect system reuse: improve the surface without turning it into a different product.

## 2. Preflight
- [ ] Name the primary surface or route under review.
- [ ] Name the primary user promise this screen must deliver.
- [ ] Name the most important success moment and the most fragile moment.
- [ ] If `DESIGN.md` exists, restate the key design controls being enforced.
- [ ] If `docs/screen-flow.md` exists, verify the implemented state behavior against it.

## 3. Review Rubric

6-pass 디자인 리뷰로 구현된 표면의 완성도와 신뢰도를 점검한다.

### Pass 1. Hierarchy and First Impression
- [ ] Score 0 to 10: Is the primary action and information hierarchy obvious within a few seconds?
- [ ] Check heading contrast, CTA priority, spacing rhythm, and scan path.
- [ ] Fix to 10 by removing equal-weight sections and clarifying the dominant action.

### Pass 2. State Visibility and Recovery
- [ ] Score 0 to 10: Are loading, empty, error, success, permission, and partial states visible where they matter?
- [ ] Reject invisible or implicit state handling.
- [ ] Fix to 10 by showing user-facing feedback, next action, and recovery path.

### Pass 3. Goodwill and Trust
- [ ] Score 0 to 10: Does the interface reduce hesitation and increase confidence?
- [ ] Record `Goodwill Drains`:
  - confusing copy
  - ambiguous outcomes
  - weak confirmation
  - dead-end empty states
- [ ] Record `Goodwill Fills`:
  - reassurance
  - progress visibility
  - clear ownership of action
  - informative success feedback
- [ ] Fix the top drains before adding new decoration.

### Pass 4. Anti-Slop and Intentionality
- [ ] Score 0 to 10: Does the surface feel product-specific instead of template-like?
- [ ] Flag patterns like:
  - centered hero + three equal cards
  - decorative gradient blob with no structural role
  - one safe sans across every layer
  - repeated radius and shadow with no hierarchy shift
  - premium adjectives with no visible design move
- [ ] Fix to 10 by naming specific layout, type, motion, or material decisions.

### Pass 5. Design System and Korean UI Quality
- [ ] Score 0 to 10: Does the surface reuse the existing visual language and read naturally in Korean when applicable?
- [ ] If `DESIGN.md` exists, cite which rules were honored or violated.
- [ ] Check typography pairing, color ownership, line-height, copy tone, and `word-break: keep-all` suitability for Korean text blocks.
- [ ] Fix to 10 by aligning with the design contract before inventing new patterns.

### Pass 6. Responsive and Interaction Quality
- [ ] Score 0 to 10: Does the primary flow still feel clear on mobile and keyboard paths?
- [ ] Check touch targets, overflow, focus visibility, sticky actions, and breakpoint behavior.
- [ ] Fix to 10 by naming the broken breakpoint or interaction mode and the required correction.

## 4. Scoring Rule
- [ ] Record a before and after score for each pass.
- [ ] A pass below 8 means the surface still carries visible UX debt.
- [ ] If the fix is obvious and local, update the surface directly instead of hand-waving.
- [ ] Escalate only when there is a real product tradeoff or scope issue.

## 5. PASS / FAIL Gate

### PASS
- [ ] `.agent/memory/design-review.md` contains pass scores, key findings, and recommendation.
- [ ] No major AI-slop or hierarchy confusion remains on the reviewed surface.
- [ ] User-visible states are represented where relevant.
- [ ] The primary mobile path is usable.
- [ ] Remaining design debt is named and bounded.

### FAIL
- [ ] The screen still looks generic or interchangeable.
- [ ] The happy path is polished but fallback states are weak or missing.
- [ ] Mobile or keyboard behavior breaks the primary flow.
- [ ] The implementation drifted away from `DESIGN.md` or `docs/screen-flow.md` with no explicit justification.

## 6. Red Flags
- visual opinions are listed without concrete fixes.
- surface polish hides unclear action hierarchy.
- empty states end at `No items found`.
- Korean copy reads like literal SaaS translation.
- the page feels like a different product than the existing system.

## 7. Artifact
- [ ] Create or update `.agent/memory/design-review.md`.
- [ ] Use this structure:

```md
# Design Review

> Recommendation: Revise | Validate | Ready
> Overall Score: [before]/10 -> [after]/10

## Pass Scores
- Hierarchy and First Impression: [before] -> [after]
- State Visibility and Recovery: [before] -> [after]
- Goodwill and Trust: [before] -> [after]
- Anti-Slop and Intentionality: [before] -> [after]
- Design System and Korean UI Quality: [before] -> [after]
- Responsive and Interaction Quality: [before] -> [after]

## Top Findings
- ...

## Goodwill Drains
- ...

## Goodwill Fills
- ...

## Anti-Slop Flags
- ...

## Fixes Applied
- ...

## Remaining Tradeoffs
- ...

## Handoff
- `/uiux` for more polish
- `/qa` for validation
- `/ship` if the visual bar is met
```

## 8. Handoff
- [ ] Significant visual or interaction issues remain -> `/uiux`
- [ ] Surface is visually sound but needs broader validation -> `/qa`
- [ ] Surface is visually ready and broader checks are green -> `/ship`
