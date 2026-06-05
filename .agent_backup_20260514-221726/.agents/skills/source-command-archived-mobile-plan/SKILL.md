---
name: "source-command-archived-mobile-plan"
description: "Strategic Planning for Mobile Native Apps (Legacy workflow)"
---

# source-command-archived-mobile-plan

Use this skill when the user asks to run the migrated source command `archived-mobile-plan`.

## Command Template

# 📱 Mobile Plan (Native Straegist v6.0)

> [!WARNING]
> Legacy workflow. Keep only for mobile-specific planning. Default planning should happen in `/office-hours` and `/plan`.

모바일 앱 아키텍처부터 UI/UX 설계까지 **모바일 전문 기획을 한 번에 실행**.

## 0. [AGENT] Orchestrator: Intelligence Setup
- [ ] **Model Router**: Mobile Planning is `[HEAVY]` → Recommend Pro/Sonnet.
- [ ] **Smart Skill Discovery** ⚡: Run `bash .agent/scripts/smart-skill-loader.sh "mobile native architecture uiux design ios android" --concat --strict` → read `.agent/memory/current_loaded_skills.md`.
- [ ] **Environment Scan**: Run `bash .agent/scripts/audit-status.sh` to detect stack (Expo, React Native, or Flutter).
- [ ] **Board Init**: Initialize `.agent/memory/task_board.md`.

---

## Phase A: 모바일 제품 정의 (Native Discovery)

### 1. [AGENT] Mobile Architect: Platform Strategy
- [ ] **Detect**: Identify the target mobile framework by scanning `package.json` or project files.
- [ ] **Design DNA**: Prefer the loaded mobile or native architecture skills for native-first UI principles.
- [ ] **Gesture Map**: Define key mobile interactions (Swipe, Pull-to-refresh, Long-press).

### 2. [AGENT] Critic Gate — Feasibility Check ♻️
- [ ] **Evaluate**: Is the chosen native stack optimal for the requirements?
- [ ] **PASS** → Proceed to Phase B.
- [ ] **FAIL** → Suggest architectural changes. Max 2 retries.

---

## Phase B: 모바일 전용 API 명세 & 가이드 (Native Spec)

### 3. [AGENT] Architect: Mobile-First API Spec
- [ ] **Generate**: Create `docs/api-spec.md` optimized for mobile.
    - Define endpoints with pagination (Infinite Scroll).
    - Specify Push Notification payloads if applicable.
    - Define Deep Link schemas (`myapp://path`).
- [ ] **Lock**: Mark spec as LOCKED.

### 4. [AGENT] Workflow Transition
- [ ] **Present**: Use `notify_user` with `BlockedOnUser: true` and `PathsToReview: ["docs/api-spec.md", ".agent/memory/task_board.md"]`.
- [ ] **Next**: 승인 시 → `/mobile-dev` 자동 시작.

---
> [!IMPORTANT]
> **Mobile Rule**: Mobile implementation MUST consider offline/network-lag scenarios in the spec.

## [AGENT] Secretary: Daily Log
- [ ] **Log**: Run `bash .agent/scripts/logger.sh ".agent/memory/daily/$(date +%Y-%m-%d).md" "MOBILE-PLAN" "[Summary of native planning session]"`
