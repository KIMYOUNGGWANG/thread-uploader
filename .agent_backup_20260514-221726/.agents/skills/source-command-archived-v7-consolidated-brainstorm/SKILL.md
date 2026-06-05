---
name: "source-command-archived-v7-consolidated-brainstorm"
description: "Expand option space before locking one direction (Orchestrator v7)"
---

# source-command-archived-v7-consolidated-brainstorm

Use this skill when the user asks to run the migrated source command `archived-v7-consolidated-brainstorm`.

## Command Template

# 💡 Brainstorm

막연한 요청을 여러 방향으로 펼쳐보고, 가장 유망한 후보를 다음 discovery 단계로 넘기는 워크플로우.

## 0. Required Inputs
- [ ] Read `conductor/product.md` if it exists.
- [ ] Read `.agent/memory/task_board.md` for current context.
- [ ] Load discovery skills when useful:
  - `bash .agent/scripts/smart-skill-loader.sh "brainstorming product discovery strategy" --concat --strict`

## 1. Brainstorm Rubric
- [ ] Generate 3 to 5 realistic options.
- [ ] For each option, record user value, hidden cost, and key risk.
- [ ] Keep one obvious option, one differentiated option, and one low-effort option when possible.

## 2. PASS / FAIL Gate

### PASS
- [ ] Multiple options exist.
- [ ] One primary recommendation and one backup are chosen.
- [ ] Deferred ideas are separated.

### FAIL
- [ ] 사실상 한 가지 아이디어를 길게 포장했을 뿐이다.
- [ ] 비용과 리스크가 빠져 있다.

## 3. Red Flags
- 기능 목록만 늘어나고 방향 비교가 없다.
- `좋아 보이는 것` 위주로만 설명한다.

## 4. Artifact
- [ ] Create or update `.agent/memory/brainstorm.md` with options, scores, and recommendation.

## 5. Handoff
- [ ] promising but fuzzy -> `/office-hours`
- [ ] already concrete -> `/plan`
