---
name: "source-command-archived-v7-consolidated-plan-ceo-review"
description: "Go / revise / halt review for product value, wedge, and scope (Orchestrator v7)"
---

# source-command-archived-v7-consolidated-plan-ceo-review

Use this skill when the user asks to run the migrated source command `archived-v7-consolidated-plan-ceo-review`.

## Command Template

# 👔 Plan CEO Review

계획안을 제품 가치, wedge, timing, evidence 관점에서 검토하는 의사결정 워크플로우. 구현 세부보다 `이걸 지금 이 범위로 해야 하는가` 를 판단한다.

## 0. Required Inputs
- [ ] Read `docs/office-hours.md` first if present.
- [ ] Read `conductor/product.md` if present.
- [ ] Read `.agent/memory/task_board.md`.
- [ ] Read `docs/api-spec.md` if present.

## 1. CEO Rubric
- [ ] Problem: 실제로 누가 아프고, 지금도 우회 비용을 치르고 있는가?
- [ ] Wedge: 이 범위가 가장 좁고 강한 첫 승리인가?
- [ ] Evidence: 최근 사례, 인터뷰, 운영 현실, 매출/사용성 신호가 있는가?
- [ ] Timing: 왜 지금 해야 하는가?
- [ ] Cost: 이 범위가 현재 팀/시간/리스크에 비해 너무 크지 않은가?
- [ ] Disproof: 어떤 결과가 나오면 이 방향을 접어야 하는가?

## 2. PASS / FAIL Gate

### PASS
- [ ] `Go`, `Revise`, `Halt` 중 하나를 분명하게 선택했다.
- [ ] Keep / Cut / Risk / Metric 이 문서화됐다.
- [ ] 지금 하지 말아야 할 범위가 분명하다.

### FAIL
- [ ] `좋아 보인다` 수준의 감상만 있고 판단이 없다.
- [ ] 사용자 문제보다 기능 목록이 더 길다.
- [ ] 반증 조건이 없다.

## 3. Red Flags
- 증거 없이 `시장성이 있을 것 같다`고 말한다.
- 현재 wedge가 아니라 장기 비전만 이야기한다.
- 팀이 감당 못 할 운영/세일즈/지원 비용을 숨긴다.
- 핵심 문제와 무관한 기능이 scope를 잡아먹는다.

## 4. Artifact
- [ ] Create or update `.agent/memory/plan-ceo-review.md`.
- [ ] Use this structure:

```md
# Plan CEO Review

> Decision: Go | Revise | Halt

## Keep
- ...

## Cut
- ...

## Risks
- ...

## Metric
- ...

## Why Now
- ...

## What Would Disprove This
- ...
```

## 5. Handoff
- [ ] `Go` -> return to `/plan` and lock the board/spec.
- [ ] `Revise` -> send concrete cuts back to `/plan` or `/office-hours`.
- [ ] `Halt` -> go back to `/office-hours` or `/brainstorm`.
