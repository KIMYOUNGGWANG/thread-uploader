---
name: "source-command-archived-cycle"
description: "High-Level Autonomous Lifecycle (Legacy workflow)"
---

# source-command-archived-cycle

Use this skill when the user asks to run the migrated source command `archived-cycle`.

## Command Template

# ♾️ Cycle (Master Factory v6.0)

> [!WARNING]
> Legacy workflow. Prefer the explicit core route: `/office-hours → /plan → /develop → /qa → /review → /ship`.

**God Mode**. Full lifecycle from idea to production with Contract-First development.

## 0. [AGENT] Orchestrator: Intelligence Setup
- [ ] **Model Router**: Cycle is `[HEAVY]` → Recommend Pro/Sonnet.
- [ ] **Smart Skill Discovery** ⚡: Run `bash .agent/scripts/smart-skill-loader.sh "<project tech signals>" --concat` → read `.agent/memory/current_loaded_skills.md`.
- [ ] **Learnings Preload**: If `.agent/memory/learnings.md` exists → read it.
- [ ] **Environment Scan**: Run `bash .agent/scripts/audit-status.sh`.
- [ ] **Board Init**: Create master `.agent/memory/task_board.md`.

## 1. [AGENT] Strategist: Inception Phase
- [ ] **Trigger**: Execute `/plan` (아이디어 검증 + API 명세서 생성).
- [ ] **Outcome**: Verified `task_board.md` + `docs/api-spec.md` locked.

## 2. [AGENT] Factory: Construction Phase (Sequential Pipeline)
- [ ] **Trigger**: Execute `/develop` engine (Backend → Frontend → Integration 순차 실행).
- [ ] **Quality**: Critic Gate auto-retry loop 적용.
- [ ] **Dispatch**: Any issue → Specialist Dispatch (P7).

## 3. [AGENT] Designer: Polish Phase
- [ ] **Trigger**: Execute `/uiux` engine (if applicable).

## 4. [AGENT] Inspector: Review Phase
- [ ] **Trigger**: Execute `/review` (보안 감사 + 성능 최적화).

## 5. [AGENT] Delivery: Ship Phase
- [ ] **Trigger**: Execute `/ship` engine.
- [ ] **Pruning**: Context archived and reset automatically.
- [ ] **Kaizen**: `learnings.md` updated (MAX 20 entries).

---
> [!IMPORTANT]
> Cycle = Contract-First lifecycle. API Spec is generated in Phase 1.
> 워크플로우 전환: `/plan` → `/develop` → `/uiux` → `/review` → `/ship` 순서로 진행.

## [AGENT] Secretary: Daily Log
- [ ] **Log**: Run `bash .agent/scripts/logger.sh ".agent/memory/daily/$(date +%Y-%m-%d).md" "CYCLE" "[Summary of CYCLE session]"`
