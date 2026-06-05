---
name: "source-command-archived-mvp"
description: "Ship a SaaS MVP (Legacy workflow)"
---

# source-command-archived-mvp

Use this skill when the user asks to run the migrated source command `archived-mvp`.

## Command Template

# 🚀 SaaS MVP (Fast Shipper v6.0)

> [!WARNING]
> Legacy workflow. Prefer composing the core loop instead of starting from this all-in-one SaaS MVP path.

End-to-end workflow to scope, build, test, and ship a SaaS MVP quickly.

## 0. [AGENT] Orchestrator: Intelligence Setup
- [ ] **Model Router**: MVP Build is `[HEAVY]` → Recommend Pro/Sonnet.
- [ ] **Learnings Preload**: If `.agent/memory/learnings.md` exists → read it.
- [ ] **Environment Scan**: Run `bash .agent/scripts/audit-status.sh`.

## 1. [AGENT] Product Manager: Plan the Scope
- [ ] **Skill Loading ⚡**: Run `bash .agent/scripts/smart-skill-loader.sh "brainstorming planning scope milestones" --concat --strict`
- [ ] **Goal**: Convert the idea into a clear implementation plan and milestones.
- [ ] **Action**: Define problem, user persona, MVP boundaries, and acceptance criteria in `.agent/memory/mvp_plan.md`.

## 2. [AGENT] Backend Dev: Core API & Auth
- [ ] **Skill Loading ⚡**: Run `bash .agent/scripts/smart-skill-loader.sh "backend api database auth" --concat --strict`
- [ ] **Goal**: Implement the core data model, API contracts, and auth baseline.
- [ ] **Action**: Prefer small vertical slices; keep API contracts explicit and testable. Generate `docs/api-spec.md`.

## 3. [AGENT] Frontend Dev: UI & User Flow
- [ ] **Skill Loading ⚡**: Run `bash .agent/scripts/smart-skill-loader.sh "frontend react design ux" --concat --strict`
- [ ] **Goal**: Deliver the primary user flows with production-grade UX patterns.
- [ ] **Action**: Prioritize onboarding, empty states, and one complete happy-path flow. Integrate with Backend APIs.

## 4. [AGENT] QA Tester: Validate Core
- [ ] **Skill Loading ⚡**: Run `bash .agent/scripts/smart-skill-loader.sh "tdd debugging browser automation" --concat --strict`
- [ ] **Goal**: Catch regressions and ensure key flows work before release.
- [ ] **Action**: Write unit and critical E2E tests.

## 5. [AGENT] DevOps: Ship Safely
- [ ] **Skill Loading ⚡**: Run `bash .agent/scripts/smart-skill-loader.sh "deployment observability telemetry" --concat --strict`
- [ ] **Goal**: Release with basic observability and rollback readiness.
- [ ] **Action**: Define release checklist, minimum telemetry, and rollback triggers.

## 6. [AGENT] Critic Gate — MVP Launch Review ♻️
- [ ] **Evaluate**: Does the MVP meet the initial scope? Are critical paths tested?
- [ ] **PASS** → Present app to user.
- [ ] **FAIL** → Fix bugs. Max 2 retries.

## 7. [AGENT] Workflow Transition
- [ ] **Present**: Use `notify_user` to announce MVP completion. Ensure preview link or commands are provided.

## [AGENT] Secretary: Daily Log
- [ ] **Log**: Run `bash .agent/scripts/logger.sh ".agent/memory/daily/$(date +%Y-%m-%d).md" "MVP" "[Summary of MVP session]"`
