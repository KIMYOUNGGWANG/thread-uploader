---
name: "source-command-archived-v7-consolidated-retro"
description: "Git-history-based engineering retrospective with learnings handoff (Orchestrator v7)"
---

# source-command-archived-v7-consolidated-retro

Use this skill when the user asks to run the migrated source command `archived-v7-consolidated-retro`.

## Command Template

# 📊 Retro

최근 작업 히스토리를 정리해 회고 메트릭과 다음 개선 액션을 남기는 워크플로우. 기본 산출물은 `.agent/memory/retros/*.json` 과 `learnings.md` 이다.

## 0. Required Inputs
- [ ] Choose a window: `24h`, `7d`, `14d`, `30d`, or `compare`.
- [ ] Read `.agent/memory/task_board.md` and `.agent/memory/learnings.md` if present.
- [ ] If available, read the latest review / ship reports for release context.

## 1. Retro Protocol
- [ ] Run the retro collector:
  - `bash .agent/scripts/retro.sh <window>`
- [ ] Review:
  - commit mix
  - hotspots
  - fix ratio
  - test ratio
  - active days and sessions
- [ ] Distill 1 to 3 concrete improvements instead of generic reflection.

## 2. PASS / FAIL Gate

### PASS
- [ ] New retro JSON snapshot exists under `.agent/memory/retros/`.
- [ ] A summary line is appended to `.agent/memory/learnings.md`.
- [ ] One improvement action is named.

### FAIL
- [ ] Metrics were not generated.
- [ ] 회고가 단순 감상으로 끝나고 다음 액션이 없다.

## 3. Red Flags
- 히스토리 근거 없이 느낌만 이야기한다.
- `fix` 비율, 핫스팟, 검증 공백을 무시한다.
- learnings로 다시 연결되지 않는다.

## 4. Artifact
- [ ] Primary artifacts:
  - `.agent/memory/retros/YYYY-MM-DD.json`
  - `.agent/memory/learnings.md`
- [ ] Example payload: `docs/templates/retro-example.json`
- [ ] Optional compare mode reads the previous retro and highlights deltas.

## 5. Handoff
- [ ] quality risk 발견 -> `/review`
- [ ] process drift 발견 -> `/status`
- [ ] release learnings 정리 완료 -> `/ship`
