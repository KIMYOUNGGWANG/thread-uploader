---
name: "source-command-pm"
description: "Product strategy, prioritization, and PM framing before execution lock (Orchestrator v7)"
---

# source-command-pm

Use this skill when the user asks to run the migrated source command `pm`.

## Command Template

# 🚀 PM

제품 전략, 우선순위, 시장성, metric framing 을 다루는 고급 워크플로우. `/plan` 이전에 방향을 점검하거나 `/plan` 이후 우선순위를 다시 자를 때 사용한다.

## 0. Required Inputs
- [ ] Read `conductor/product.md` if present.
- [ ] Read `.agent/memory/task_board.md` if present.
- [ ] Load PM skills when needed:
  - `bash .agent/scripts/smart-skill-loader.sh "business product discovery strategy research analytics execution deep-research startup market" --concat --strict`

## 1. PM Rubric
- [ ] Identify whether the question is discovery, prioritization, research, pricing, or metrics.
- [ ] Choose the lightest frame that answers it:
  - Opportunity / JTBD
  - Assumption mapping
  - Impact vs effort / RICE
  - Metric tree / North Star
- [ ] Name the riskiest assumptions: value, usability, feasibility, viability.

## 2. PASS / FAIL Gate

### PASS
- [ ] Decision or prioritization is explicit.
- [ ] Metric or success signal is named when relevant.
- [ ] Output can be reflected into `/plan` or `task_board.md`.

### FAIL
- [ ] 분석은 길지만 실제 우선순위 판단이 없다.
- [ ] framework 이름만 있고 결론이 없다.

## 3. Red Flags
- PM 분석이 engineering scope를 더 흐리게 만든다.
- metric이 vanity 수준에 머문다.

## 4. Artifact
- [ ] Create or update `.agent/memory/pm-notes.md`.

## 5. Handoff
- [ ] execution lock needed -> `/plan`
- [ ] idea still fuzzy -> `/office-hours`
- [ ] plan scope needs cutting -> `/plan-ceo-review`
