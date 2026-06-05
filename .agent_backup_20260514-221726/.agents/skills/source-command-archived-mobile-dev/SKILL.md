---
name: "source-command-archived-mobile-dev"
description: "Autonomous Mobile Development Loop (Legacy workflow)"
---

# source-command-archived-mobile-dev

Use this skill when the user asks to run the migrated source command `archived-mobile-dev`.

## Command Template

# ⚙️ Mobile Dev (Native Factory v6.0)

> [!WARNING]
> Legacy workflow. Keep only for mobile-specific projects. General work should stay on `/plan`, `/develop`, `/qa`, and `/ship`.

모바일 앱의 **고속 구현** 및 **시뮬레이터 검증**을 위한 전용 엔진.

## 0. [AGENT] Orchestrator: Intelligence Setup
- [ ] **Smart Skill Discovery** ⚡: Run `bash .agent/scripts/smart-skill-loader.sh "mobile native build implementation ios android flutter expo" --concat` → load skills.
- [ ] **Environment Scan**: Run `bash .agent/scripts/audit-status.sh`.
- [ ] **Constitution Check**: Verify a constitution file exists (`GEMINI.md`, `AGENTS.md`, or `AGENTS.md`).
- [ ] **Contract Check**: Verify `docs/api-spec.md` exists.
- [ ] **Worker Dispatch** ⚡: If using Codex/Codex, run `bash .agent/scripts/generate-worker-prompt.sh "Implement [Target Feature] in mobile environment"` → use for external worker.

## 1. [AGENT] Native Implementation Pipeline ⚡

### Step 1: Native UI & Logic
**Output**: UI Components & Business Logic
- [ ] **Skill Injection**: Load `mobile-developer` and `native-architecture` skills.
- [ ] **Code**: Implement screens according to `fsd-lite`. Ensure 20-line function limits.
- [ ] **Safe Area**: ALWAYS apply `SafeAreaView` (RN/Expo) or equivalent to avoid notch collisions.

### Step 2: Native API Integration
- [ ] **Wire**: Connect UI to the API defined in `docs/api-spec.md`.
- [ ] **Offline Guard**: Implement basic skeleton screens or loading states.

## 2. [AGENT] Critic Gate — Runtime Audit ♻️
- [ ] **Evaluate**: Audit code against `api-spec.md` and the loaded mobile design rules.
- [ ] **Simulator Check**: If possible, trigger build command (e.g., `npx expo start`) and verify UI layout.
- [ ] **FAIL** → **Context Prune (Cognitive Reset)**: discard failure and restart with clean context.

## 3. [AGENT] Specialist Dispatch 🎯
- [ ] **Diagnose**: classify issues (UI Layout, Native Module, API, etc.).
- [ ] **Dispatch**: `smart-skill-loader.sh` to find mobile specialists.

## 4. [AGENT] Workflow Transition
- [ ] **Next**: Use `notify_user` to ask: "모바일 개발이 완료되었습니다. 시뮬레이터에서 최종 확인을 진행할까요?"

---
> [!CAUTION]
> **Mobile Standards**: Never hardcode colors. Use the Design System from `GEMINI.md`.

## [AGENT] Secretary: Daily Log
- [ ] **Log**: Run `bash .agent/scripts/logger.sh ".agent/memory/daily/$(date +%Y-%m-%d).md" "MOBILE-DEV" "[Summary of native changes]"`
