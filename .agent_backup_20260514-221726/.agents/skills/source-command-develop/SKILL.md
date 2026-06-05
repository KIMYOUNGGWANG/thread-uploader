---
name: "source-command-develop"
description: "Contract-first development with explicit step completion gates and drift prevention (Orchestrator v7)"
---

# source-command-develop

Use this skill when the user asks to run the migrated source command `develop`.

## Command Template

# ⚙️ Develop

`docs/api-spec.md` 를 단일 진실 원본으로 두고 구현하는 개발 워크플로우. 중요한 변화는 코드보다 `spec과 task board를 어기지 않는 것` 이다.

## -1. IntentGate — 워크플로우 진입 전 의도 분류

작업 요청을 한 문장으로 받아 올바른 워크플로우로 라우팅한다.

```bash
bash .agent/scripts/intent-gate.sh "<작업 요청 한 줄 요약>"
```

| 분류 | 권장 워크플로우 |
|------|----------------|
| 버그 | `/fix` |
| 기능 개발 | `/develop` ← 현재 |
| 리팩터링 | `/develop` ← 현재 |
| 코드 리뷰 | `/review` |

> 분류가 `/develop` 이 아닌 경우, 해당 워크플로우로 전환한다. 불확실하면 계속 진행.

## 0. Required Inputs
- [ ] Read hub `global_learnings.md` if present: `$ORCHESTRATOR_HOME/.agent/memory/global_learnings.md`
- [ ] Read `.agent/memory/learnings.md` if present.
- [ ] Run `bash .agent/scripts/audit-status.sh`.
- [ ] If Revenue OS state exists, run `bash .agent/scripts/revenue-status.sh .` and confirm there is no `blocked` recommendation before large build work.
- [ ] Verify a constitution exists (`GEMINI.md`, `AGENTS.md`, or `AGENTS.md`).
- [ ] Verify `docs/api-spec.md` exists. 없으면 `/plan`.
- [ ] Load skills with:
  - `bash .agent/scripts/smart-skill-loader.sh "<detected tech signals>" --concat --strict`

## 0.5. 실행 모드 — 앱별 Codex 우선

코드 구현은 **태스크 수와 무관하게 Codex 앱/CLI** 가 담당한다.
Codex는 설계와 리뷰, Antigravity/Gemini는 미션 컨트롤과 QA를 맡는다.

### 현재 앱별 기본 동작

| 현재 실행 환경 | 기본 동작 |
| --- | --- |
| Codex 앱 | 이 워크플로우의 Step Gates를 직접 구현한다. |
| Codex | 구현하지 않고 설계/리뷰 후 Codex로 handoff 한다. |
| Antigravity/Gemini | 상태 점검, QA 라우팅, Codex 구현 dispatch를 맡는다. |

```
bash .agent/scripts/codex-bridge.sh check
  → FOUND:     Mode A (Codex handoff/direct build) 진행
  → NOT_FOUND: Mode B (manual/direct fallback) 안내
```

### Mode A — Codex direct build 또는 handoff (기본값)

**Codex 앱 안에서 실행 중일 때:**
- 이 문서의 Step Gates를 직접 수행한다.
- `docs/api-spec.md` 와 task_board 범위만 구현한다.
- 검증 명령과 변경 파일을 handoff에 남긴다.

**Codex/Antigravity에서 orchestrating 중일 때:**
- `pumasi-bridge.sh` 또는 Codex 앱 handoff를 사용한다.

**Codex 역할 (pumasi-bridge.sh 내부):**
- `docs/api-spec.md` 기반 `pumasi.config.yaml` 설계
- 파일 경로 + 함수 시그니처 + 게이트 정의

**Codex 역할:**
- 실제 코드 작성 전부
- 게이트(tsc / build / test) 통과 책임

```bash
bash .agent/scripts/pumasi-bridge.sh "[task_board.md In-Progress 태스크 요약]"
```

**완료 기준:** 모든 게이트 PASS + `pumasi-bridge.sh` exit 0

**실패 시 → Ralph Loop:**
```bash
bash .agent/scripts/ralph-loop.sh   # 최대 3회 자가 재시도, 초과 시 /fix 에스컬레이션
```

### Mode B — manual/direct fallback (Codex 미설치 시만)

Codex 없을 때만 진입한다. Codex나 Antigravity가 직접 구현해야 한다면 그 사실을 handoff에 명시하고, 가능한 즉시 Codex 환경을 복구한다.

## 1. Step Gates

### Backend
- [ ] Implement only the contract surfaces defined in `docs/api-spec.md`.
- [ ] Completion gate: responses, auth, and error behavior match the spec.

### Frontend
- [ ] Build only the fields, states, and flows agreed in the contract.
- [ ] Completion gate: loading, empty, error, success states exist and no invented fields appear.

### Revenue Assets
- [ ] Build only the agreed asset: landing page, MVP slice, automation delivery, content batch, or report.
- [ ] Completion gate: asset maps to the current offer, target customer, channel, and evidence threshold.

### Integration
- [ ] Wire frontend to real contract surfaces.
- [ ] Completion gate: targeted validation path passes and no contract drift remains.

## 2. PASS / FAIL Gate

### PASS
- [ ] Current step completion gate is met.
- [ ] Contract drift is zero.
- [ ] `critic-gate` passes or remaining risk is explicit.

### FAIL
- [ ] UI or API invented new scope not in plan/spec.
- [ ] Revenue work proceeds despite missing target customer, offer, channel, or metrics gate.
- [ ] Validation path is still red.
- [ ] Repeated patching is happening without returning to `/plan` or `/fix`.

### FAIL 시 — Ralph Loop (자가 복구)

게이트 실패 후 자동 재시도가 필요할 때:

```bash
bash .agent/scripts/ralph-loop.sh
# LOOP_STATUS=continue → 다음 미완료 태스크부터 Step Gates 재수행
# LOOP_STATUS=done     → 모든 태스크 완료, Handoff로 이동
# LOOP_STATUS=give_up  → 최대 재시도 초과, /fix 또는 /plan 에스컬레이션
```

기본 최대 재시도: 3회. 변경 시: `bash .agent/scripts/ralph-loop.sh --max-retries 5`

## 3. Red Flags
- spec를 안 읽고 구현 감으로 확장한다.
- task board에 없는 대형 범위가 끼어든다.
- validation 없이 다음 단계로 넘어간다.

## 4. Artifact
- [ ] Update `.agent/memory/task_board.md` progress honestly.
- [ ] Keep `docs/api-spec.md` as source of truth; if the contract must change, return to `/plan`.
- [ ] Log meaningful progress:
  - `bash .agent/scripts/logger.sh ".agent/memory/daily/$(date +%Y-%m-%d).md" "DEVELOP" "[완료한 step, 검증, 남은 risk]"`

## 5. Handoff
- [ ] visual polish needed -> `/uiux`
- [ ] broader validation needed -> `/qa`
- [ ] ship-ready candidate -> `/review` or `/ship`
- [ ] bug or instability -> `/fix`
