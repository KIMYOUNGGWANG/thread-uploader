---
name: "source-command-archived-v7-consolidated-office-hours"
description: "Problem framing and scope compression before `/plan` (Orchestrator v7)"
---

# source-command-archived-v7-consolidated-office-hours

Use this skill when the user asks to run the migrated source command `archived-v7-consolidated-office-hours`.

## Command Template

# 🧭 Office Hours

막연한 요청을 구현 가능한 문제 정의로 압축하는 discovery 워크플로우. 여기서는 코드를 만들지 않고, `docs/office-hours.md` 한 장으로 문제와 wedge를 잠근다.

## 0. Purpose & Inputs
- [ ] 구현, 스캐폴딩, API 설계로 바로 점프하지 않는다.
- [ ] Read `conductor/product.md` if present.
- [ ] Read `.agent/memory/task_board.md` for current mission context.
- [ ] If the request extends an existing product, also read `README.md` and `docs/api-spec.md` if present.
- [ ] Load discovery skills when needed:
  - `bash .agent/scripts/smart-skill-loader.sh "product discovery strategy market research business model user research" --concat --strict`

## 1. Mode Lock
- [ ] Choose the mode before asking questions:
  - `Startup`: 고객, 시장성, 반복 사용, 매출, GTM, 경쟁 우위가 중요할 때
  - `Builder`: 개인 생산성, 내부 도구, 프로토타입, 학습, 오픈소스가 중심일 때
- [ ] State the chosen mode in one short sentence before continuing.

## 2. Questioning Rules
- [ ] Ask one question at a time and synthesize after every answer.
- [ ] Push vague answers one level deeper with concrete follow-ups.
- [ ] Anti-sycophancy rule: 사용자의 첫 답이 추상적이면 맞장구치지 말고 증거, 최근 사례, 실제 제약으로 다시 묻는다.
- [ ] Do not accept answers like `everyone`, `AI로 더 좋게`, `그냥 편하게`, `예뻐 보이게` as final framing.

## 3. Forcing Questions

### Startup Mode
1. 정확히 누가 이 문제를 겪는가?
2. 그 사람은 지금 무엇으로 버티거나 우회하고 있는가?
3. 최근 실제 사례 한 건은 무엇인가?
4. 가장 좁고 강한 wedge는 무엇인가?
5. 왜 지금 이 문제가 더 중요해졌는가?
6. 어떤 증거가 나오면 이 방향을 접어야 하는가?

### Builder Mode
1. 결국 만들고 싶은 결과 화면 또는 경험은 무엇인가?
2. 왜 만들고 싶은가? 재미, 생산성, 학습, 공개 배포 중 무엇이 핵심인가?
3. 시간과 구현 제약은 무엇인가?
4. 가장 작은 데모 또는 가장 작은 유용한 버전은 무엇인가?
5. 기존 도구가 이미 해결하는 50%는 무엇인가?
6. 첫 버전에서 의도적으로 버릴 것은 무엇인가?

## 4. PASS / FAIL Gate

### PASS
- [ ] `docs/office-hours.md` 에 아래가 모두 있다:
  - 누구를 위한 문제인지
  - 현재 우회 방법과 최근 실제 사례
  - JTBD 또는 desired outcome
  - 가장 좁은 wedge
  - 지금 버릴 범위
  - 가장 큰 가정과 반증 조건
  - `/plan` 이 답해야 할 질문

### FAIL
- [ ] 대상 사용자가 여전히 모호하다.
- [ ] 불편의 증거가 없고 단지 아이디어만 있다.
- [ ] wedge 대신 wishlist가 남아 있다.
- [ ] `/plan` 으로 넘길 만큼 scope가 잠기지 않았다.

## 5. Red Flags
- `모든 사람을 위한 제품`처럼 사용자 범위가 너무 넓다.
- 현재 workaround가 없는데도 문제가 심각하다고 주장한다.
- 왜 지금 해야 하는지 설명이 없다.
- 가장 작은 유용한 버전이 아니라 곧바로 플랫폼/운영체계를 상정한다.
- 리스크를 숨기기 위해 긍정 문장만 반복한다.

## 6. Artifact
- [ ] Create or replace `docs/office-hours.md`.
- [ ] Reference template: `docs/templates/office-hours-template.md`
- [ ] Use this structure:

```md
# Office Hours

> Date: YYYY-MM-DD
> Mode: Startup | Builder
> Status: Ready for /plan | Needs another discovery pass

## Problem
- Who:
- Pain / desired outcome:
- JTBD:

## Reality Check
- Current workaround:
- Why now:
- Evidence or observed examples:

## Recommended Wedge
- Smallest useful version:
- What to exclude now:

## Risks
- Assumptions:
- Unknowns:
- What would disprove this direction:

## Next Step
- Recommended next workflow:
- Questions `/plan` must answer:
```

## 7. Handoff
- [ ] `/plan` must read `docs/office-hours.md` first.
- [ ] If value, timing, or wedge confidence is weak, route next to `/plan-ceo-review` before locking scope.
- [ ] If the framing is still mushy, stay in `/office-hours` or go back to `/brainstorm`.
- [ ] Log major direction changes:
  - `bash .agent/scripts/logger.sh ".agent/memory/daily/$(date +%Y-%m-%d).md" "OFFICE-HOURS" "[문제 정의, wedge, 다음 단계 요약]"`
