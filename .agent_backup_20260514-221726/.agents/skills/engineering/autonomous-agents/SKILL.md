---
name: autonomous-agents
description: "Autonomous agent design patterns: ReAct loops, goal decomposition, self-correction, and production reliability. Key insight: 95% per-step success = 60% by step 10."
source: "vibeship-spawner-skills (Apache 2.0), rewritten for Orchestrator 5.2"
risk: safe
---

# 🤖 Autonomous Agents — Reliability-First Design

> **Core insight**: Autonomy is earned, not granted. A 95% success rate per step drops to 60% by step 10. Start constrained, add freedom only when proven reliable.

## When to Activate

- Single-agent context limits constrain task complexity
- Tasks decompose naturally into parallel subtasks
- Building production agent systems with guardrails
- Designing self-correcting loops (ReAct, Plan-Execute)

## 1. Agent Loop Patterns

### ReAct (Reason + Act)

```
[User Query] → [Reason: What do I need?] → [Act: Tool call] → [Observe: Result] → [Reason again] → ...
```

- Best for: exploratory tasks, research, debugging
- Risk: loops without convergence → set max iterations

### Plan-Execute

```
[User Query] → [Plan: List all steps] → [Execute: Step 1] → [Verify] → [Execute: Step 2] → ...
```

- Best for: well-defined multi-step tasks (`/develop`, `/ship`)
- Risk: plan becomes stale → re-plan after failures

### Reflection Pattern

```
[Output] → [Self-Critique: "Is this correct?"] → [Improve] → [Output v2]
```

- Best for: code review, content generation
- Risk: over-correction → limit to 2 reflection rounds

## 2. Goal Decomposition

```
High-level Goal
├── Sub-goal 1 (independent, parallelizable)
├── Sub-goal 2 (depends on 1)
└── Sub-goal 3 (independent, parallelizable)
```

**Rules:**
- Each sub-goal must be **atomic** (completable in one agent session)
- Dependencies must be **explicit** (use agent-handshake protocol)
- Outputs must be **verifiable** (use critic-gate)

## 3. Self-Correction Protocol

| Step | Action | Max Retries |
|:---:|:---|:---:|
| 1 | Execute task | — |
| 2 | Validate output (type check, lint, test) | — |
| 3 | If fail → analyze error, adjust approach | 1 |
| 4 | If fail again → escalate to user | — |

> ⚠️ **Never retry more than 2 times**. If approach is fundamentally wrong, retrying wastes tokens.

## 4. Production Reliability

### ⚠️ Sharp Edges

| Issue | Severity | Solution |
|:---|:---:|:---|
| Compounding error rates | 🔴 Critical | Reduce step count. Validate after each step |
| Runaway token costs | 🔴 Critical | Set hard cost limits (max iterations, max tokens) |
| Context poisoning | 🔴 Critical | Fresh context per subtask (multi-agent isolation) |
| Hallucinated tool outputs | 🟡 High | Validate against ground truth (file exists? API responds?) |
| Fragile API dependencies | 🟡 High | Build robust clients with retry + circuit breaker |
| Excessive permissions | 🟡 High | Least privilege — only grant tools needed for subtask |
| Context window exhaustion | 🟠 Medium | Summarize, don't accumulate. Use file system as memory |
| Silent failures | 🟠 Medium | Structured logging. Every action must produce observable output |

### Guardrails Checklist

- [ ] Max iterations set (default: 5)
- [ ] Max token budget defined
- [ ] Each step has success criteria
- [ ] Failure escalation path defined (→ user)
- [ ] No unbounded loops
- [ ] Outputs validated before passing downstream

## Anti-Patterns

### ❌ Unbounded Autonomy
Letting agent run without limits. Always set max iterations and token budgets.

### ❌ Trusting Agent Outputs
Never pass agent output to production without validation. Verify file changes, API responses, test results.

### ❌ General-Purpose Autonomy
"Do anything" agents fail. Specialize: one agent per domain, clear boundaries.

## Related Skills

- `agent-handshake.md` — Structured agent-to-agent communication
- `critic-gate.md` — Quality gate with auto-retry
- `multi-agent-patterns/` — Orchestration architectures
- `context-window-management/` — Token budget management
