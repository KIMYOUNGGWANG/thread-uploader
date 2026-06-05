---
name: "source-command-archived-micro"
description: "Lean Autonomous Execution (Legacy workflow)"
---

# source-command-archived-micro

Use this skill when the user asks to run the migrated source command `archived-micro`.

## Command Template

# ⚡ Micro (Agentic Lean v6.0)

> [!WARNING]
> Legacy workflow. Prefer `/fix` for small repairs or a narrowly scoped `/develop` pass for quick implementation.

Fast-track engine for 5-10 minute tasks. Skips API Spec and parallel threads.

## 0. [AGENT] Orchestrator: Intelligence Setup
- [ ] **Model Router**: Micro tasks are `[LIGHT]` → Recommend Flash/mini.
- [ ] **Learnings Preload**: If `.agent/memory/learnings.md` exists → read it (even small tasks can repeat past mistakes).
- [ ] **Skill Discovery**: Quick scan → load `clean-code`, `typescript-expert` (if TS).

## 1. [AGENT] Lead Dev: Direct Action
- [ ] **Implement**: Code directly using clean code rules.

## 2. [AGENT] Critic: Instant Audit
- [ ] **Check**: Quick sanity check (syntax, structure).
- [ ] **Verify**: Smoke test (`npm run build` or core units).
- [ ] **FAIL** → Fix immediately. No formal retry loop for micro tasks.

## 3. [AGENT] Secretary: Minimal Log
- [ ] **History (KR)**: One-line to `.agent/memory/feature_history_kr.md`.

---
> [!NOTE]
> Micro skips API Spec, environment scan, and specialist dispatch for maximum speed.

## [AGENT] Secretary: Daily Log
- [ ] **Log**: Run `bash .agent/scripts/logger.sh ".agent/memory/daily/$(date +%Y-%m-%d).md" "MICRO" "[Summary]"`
