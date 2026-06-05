---
name: "source-command-archived-ddd"
description: "Design a DDD Core Domain (Legacy workflow)"
---

# source-command-archived-ddd

Use this skill when the user asks to run the migrated source command `archived-ddd`.

## Command Template

# 🏗️ DDD Architect (Domain Designer v6.0)

> [!WARNING]
> Legacy workflow. Use only when the project truly needs domain-driven design. Otherwise prefer `/plan` and document boundaries there.

Workflow to model complex domains and implement tactical and evented patterns with explicit boundaries.

## 0. [AGENT] Orchestrator: Intelligence Setup
- [ ] **Model Router**: DDD Architecture is `[HEAVY]` → Recommend Pro/Sonnet.
- [ ] **Learnings Preload**: If `.agent/memory/learnings.md` exists → read it.
- [ ] **Environment Scan**: Run `bash .agent/scripts/audit-status.sh`.

## 1. [AGENT] Architect: Assess Fit & Scope
- [ ] **Skill Loading ⚡**: Run `bash .agent/scripts/smart-skill-loader.sh "domain driven design adr" --concat --strict`
- [ ] **Goal**: Decide if full DDD is justified and define the modeling scope.
- [ ] **Action**: Document why DDD is needed, where to keep it lightweight, and what success looks like in an ADR.

## 2. [AGENT] Strategist: Strategic Modeling
- [ ] **Skill Loading ⚡**: Run `bash .agent/scripts/smart-skill-loader.sh "ddd strategic boundaries context" --concat --strict`
- [ ] **Goal**: Define subdomains, bounded contexts, and ubiquitous language.
- [ ] **Action**: Classify subdomains and assign ownership before making implementation decisions. Create Map.

## 3. [AGENT] Modeler: Context Relationships
- [ ] **Skill Loading ⚡**: Run `bash .agent/scripts/smart-skill-loader.sh "ddd context mapping corruption" --concat --strict`
- [ ] **Goal**: Define context integration patterns, ownership, and translation boundaries.
- [ ] **Action**: Prefer explicit contracts and anti-corruption layers where domain models diverge.

## 4. [AGENT] Developer: Tactical Implementation
- [ ] **Skill Loading ⚡**: Run `bash .agent/scripts/smart-skill-loader.sh "ddd tactical aggregates value objects tdd" --concat --strict`
- [ ] **Goal**: Encode invariants with aggregates, value objects, repositories, and domain events.
- [ ] **Action**: Start from invariants and transaction boundaries, not from tables or endpoints.

## 5. [AGENT] DistSys Engineer: Evented Patterns
- [ ] **Skill Loading ⚡**: Run `bash .agent/scripts/smart-skill-loader.sh "cqrs event store saga projections" --concat --strict`
- [ ] **Goal**: Apply CQRS, event store, projections, and sagas only where required.
- [ ] **Action**: Use evented patterns where consistency and scale tradeoffs are explicit and accepted.

## 6. [AGENT] Critic Gate — DDD Review ♻️
- [ ] **Evaluate**: Are bounded contexts cleanly separated? Are aggregates protecting their invariants?
- [ ] **PASS** → Present design.
- [ ] **FAIL** → Refactor boundaries. Max 1 retry.

## 7. [AGENT] Workflow Transition
- [ ] **Present**: Use `notify_user` to present the DDD Model diagrams and domain code.

## [AGENT] Secretary: Daily Log
- [ ] **Log**: Run `bash .agent/scripts/logger.sh ".agent/memory/daily/$(date +%Y-%m-%d).md" "DDD" "[Summary of DDD modeling session]"`
