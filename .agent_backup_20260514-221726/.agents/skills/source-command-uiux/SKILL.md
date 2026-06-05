---
name: "source-command-uiux"
description: "UI/UX implementation and polish with anti-slop, goodwill, and state coverage gates (Orchestrator v7)"
---

# source-command-uiux

Use this skill when the user asks to run the migrated source command `uiux`.

## Command Template

# ✨ UI/UX

현재 제품 구조를 유지한 채 미감, 상태 설계, 완성도를 끌어올리는 UI/UX 구현 및 폴리싱 워크플로우.
`/plan-design-review` 가 화면 계약을 잠그는 단계라면, `/uiux` 는 그 계약과 `DESIGN.md` 를 실제 화면에 반영하는 단계다.

## 0. Required Inputs
- [ ] Read current screens, constraints, and `docs/api-spec.md` if UI is contract-driven.
- [ ] Read `docs/screen-flow.md` if present.
- [ ] Read `DESIGN.md` if present.
- [ ] Reference starter template: `docs/templates/design-template.md`.
- [ ] Run `bash .agent/scripts/audit-status.sh`.
- [ ] Load design skills:
  - `bash .agent/scripts/smart-skill-loader.sh "design css ui tailwind animation premium redesign typography motion ui-ux-pro-max" --concat --strict`
- [ ] Lock direction with:
  - `python3 .agents/skills/design/ui-ux-pro-max/scripts/search.py "<product or page>" --design-system -p "Project Name" -f markdown`
- [ ] If the work has meaningful UI scope and `DESIGN.md` does not exist, create it from the template before polishing.

## 1. Direction Lock
- [ ] Name the primary surface being improved.
- [ ] Name the primary user promise for that surface.
- [ ] Lock or confirm these design controls:
  - `VISUAL_DIRECTION`
  - `VISUAL_DENSITY`
  - `MOTION_INTENSITY`
  - `EDITORIALNESS`
  - `LANDING_PURPOSE`
- [ ] If `DESIGN.md` already exists, reuse it instead of inventing a new visual language.

## 2. Aesthetic Rubric
- [ ] hierarchy, typography, color ownership, composition rhythm are specific.
- [ ] loading, empty, error, success, and permission states are visible where relevant.
- [ ] mobile and desktop coherence exists for the primary flow.
- [ ] one memorable signature move exists without breaking the design system.
- [ ] Korean UI copy, spacing, and line breaks feel natural if the interface is in Korean.

## 3. Goodwill Check
- [ ] Identify `Goodwill Drains`:
  - moments that make the user hesitate, distrust, or work too hard
- [ ] Identify `Goodwill Fills`:
  - moments that reassure, orient, or reward the user
- [ ] Fix the top drains before adding more decoration.

## 4. Anti-Slop Gate
- [ ] Reject vague adjectives unless they become layout, type, motion, or component decisions.
- [ ] Flag patterns like:
  - centered hero + three equal cards
  - decorative gradient blob with no structural role
  - one default-safe sans for every layer
  - first section polish with the rest left generic
  - repeated radius, shadow, and spacing with no hierarchy change
- [ ] If the result still feels interchangeable with a generic AI landing page, keep iterating.

## 5. PASS / FAIL Gate

### PASS
- [ ] UI feels specific, not generic.
- [ ] requested surface is complete, not partial or hero-only.
- [ ] state coverage exists and is visible.
- [ ] `DESIGN.md` exists or the visual direction is explicitly locked in the review artifact.
- [ ] the primary mobile flow is usable, not implied.
- [ ] at least one signature move gives the surface a memorable identity.

### FAIL
- [ ] hero or first card row만 바꾸고 멈춘다.
- [ ] polish는 생겼지만 흐름과 상태는 그대로 빈약하다.
- [ ] visual taste changed but trust and clarity did not improve.
- [ ] existing design system was ignored and the page now feels like a different product.

## 6. Red Flags
- default-safe typography and generic gradients로 끝난다.
- 기존 디자인 시스템을 무시하고 새 앱처럼 갈아엎는다.
- empty state가 `No items found` 수준에서 멈춘다.
- 한국어 카피가 영어 SaaS 문구 직역처럼 들린다.
- interaction state가 문서에는 있는데 UI에는 보이지 않는다.

## 7. Artifact
- [ ] Create or update `.agent/memory/uiux-review.md` with:
  - top 3 problems
  - design controls used
  - goodwill drains
  - goodwill fills
  - anti-slop flags resolved or remaining
  - applied design moves
  - remaining tradeoffs
  - recommendation: `Continue`, `Validate`, or `Ready`
- [ ] Log important changes:
  - `bash .agent/scripts/logger.sh ".agent/memory/daily/$(date +%Y-%m-%d).md" "UIUX" "[핵심 개선, 남은 tradeoff]"`

## 8. Handoff
- [ ] further implementation needed -> `/develop`
- [ ] candidate needs visual validation -> `/design-review`
- [ ] candidate needs broader validation -> `/qa`
- [ ] release-ready polish complete -> `/ship`
