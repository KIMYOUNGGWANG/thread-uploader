---
name: context-window-management
description: "Strategies for managing LLM context windows: summarization, trimming, routing, serial position optimization. Essential for multi-agent token efficiency."
source: "vibeship-spawner-skills (Apache 2.0), rewritten for Orchestrator 5.2"
risk: safe
---

# 🧠 Context Window Management

> **Core principle**: Context is a finite resource with diminishing returns. More tokens ≠ better results. The art is curating the right information at the right position.

## When to Activate

- Context approaching token limits
- Agent performance degrading on long conversations
- Designing prompts for Bridge or multi-agent handoff
- Optimizing Codex/Codex context bundles

## 1. Serial Position Effect

LLMs pay most attention to content at the **beginning** and **end** of context. Content in the middle gets "lost."

```
[🔴 HIGH PRIORITY — Rules, constraints, identity]
[🟡 MEDIUM — Background context, examples]
[🔴 HIGH PRIORITY — Current task, instructions]
```

**Application to Bridge output:**
- Section 1 (Mission) → top → high attention ✅
- Section 5 (Rules) → near bottom → high attention ✅
- Section 3 (Skills) → middle → lower attention ⚠️

> 💡 **Tip**: Put the most critical skill content in Section 6 (Instructions) at the very end.

## 2. Tiered Context Strategy

| Context Size | Strategy | Example |
|:---|:---|:---|
| **< 4K tokens** | Full context | Simple bug fix, one-file edit |
| **4K–16K tokens** | Selective inclusion | Feature implementation with api-spec |
| **16K–64K tokens** | Summarize + reference | Multi-file refactor with learnings |
| **> 64K tokens** | Chunk + delegate | Full project audit → multi-agent split |

## 3. Intelligent Summarization

### ❌ Naive: Summarize by recency
```
"Keep last 10 messages, drop everything else"
→ Loses critical early context (rules, identity)
```

### ✅ Smart: Summarize by importance
```
Always keep: Rules, constraints, current task
Summarize: Previous task results → 1-line each
Drop: Intermediate reasoning, failed attempts
```

### Summarization Template
```markdown
## Previous Context (Summarized)
- Task A: Completed. Created `/api/users` with CRUD. Tests pass.
- Task B: Failed approach with Redis caching. Switched to ISR.
- Learning: Supabase RLS requires `auth.uid()` not `current_user`.
```

## 4. Context Trimming Rules

| What to Trim | When | How |
|:---|:---|:---|
| Failed approaches | After noting lesson | 1-line summary in learnings.md |
| Verbose tool output | After extracting key info | Keep only relevant lines |
| Duplicate instructions | Before sending to agent | Deduplicate via AGENTS.md layering |
| Stale task context | After task completion | Archive to task_board.md history |

## 5. Token Counting Heuristics

| Content Type | ~Tokens per 1KB |
|:---|:---:|
| English text | ~250 |
| Code (TypeScript) | ~300 |
| JSON/Config | ~350 |
| Markdown with code | ~280 |

**Quick estimates:**
- `api-spec.md` (5KB) ≈ 1,400 tokens
- `task_board.md` (2KB) ≈ 560 tokens
- Single skill file (3KB) ≈ 840 tokens
- Bridge full output (15KB) ≈ 4,200 tokens

## 6. Multi-Agent Context Isolation

```
Orchestrator (Antigravity)
├── Full context: GEMINI.md + task_board + api-spec + learnings
│
├── → Codex (via Bridge): task_board + api-spec + selected skills + workflow
│     No: GEMINI.md, session history, internal reasoning
│
└── → Codex: task_board + api-spec (via clipboard)
      No: skills, learnings, workflows
```

> 🎯 Each agent gets **only what it needs**. Never share full orchestrator context downstream.

## Anti-Patterns

### ❌ Naive Truncation
Cutting context at arbitrary token limits. Loses critical information unpredictably.

### ❌ Ignoring Token Costs
Loading all skills for every task. Use smart-skill-loader with `--strict` to load only relevant skills.

### ❌ One-Size-Fits-All
Using same context bundle for planning vs coding vs reviewing. Each phase needs different context shape.

## Implementation Checklist

- [ ] Critical rules at TOP and BOTTOM of context (serial position)
- [ ] Stale context pruned before adding new content
- [ ] Skills loaded on-demand, not all-at-once
- [ ] Each agent gets only its required context
- [ ] Failed approaches summarized in 1 line, not carried verbatim
- [ ] Token budget estimated before assembling context

## Related Skills

- `concise-planning/` — Minimal, atomic planning
- `coding-standards.md` — Section 6 covers token management rules
- `multi-agent-patterns/` — Context isolation across agents
