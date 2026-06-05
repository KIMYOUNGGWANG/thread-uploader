---
name: clean-code
description: "Use when writing, reviewing, or refactoring code. Applies Clean Code principles: naming, functions, error handling. Includes Golden Stack (Next.js/Supabase/Zustand) specific patterns and AI-common mistakes."
user-invocable: true
allowed-tools: ["Bash", "Read", "Write"]
---

# Clean Code Skill

> "Code is clean if it can be read, and enhanced by a developer other than its original author." — Grady Booch

## Core Rules

### 1. Meaningful Names
- **Intention-revealing**: `elapsedTimeInDays` not `d`
- **No disinformation**: Don't use `accountList` if it's a `Map`
- **Class names**: Nouns (`Customer`). Avoid `Manager`, `Data`
- **Method names**: Verbs (`postPayment`, `deletePage`)

### 2. Functions
- **Small!** < 20 lines. Do ONE thing.
- **One level of abstraction** — don't mix business logic with regex
- **0-2 arguments** ideal. 3+ needs strong justification
- **No side effects** — don't secretly change global state

### 3. Error Handling
- Use exceptions, not return codes
- Write try-catch-finally FIRST
- Don't return/pass null

### 4. Classes & Structure
- Single Responsibility (SRP)
- Law of Demeter — avoid `a.getB().getC().doSomething()`
- The Newspaper Metaphor — high-level at top, details at bottom

## Resources in This Skill

- `references/golden-stack-patterns.md` — Next.js + Supabase + Zustand specific conventions
- `gotchas/ai-common-mistakes.md` — Mistakes AI agents repeat frequently

## Implementation Checklist

- [ ] Function < 20 lines? Does one thing?
- [ ] Names searchable and intention-revealing?
- [ ] Avoided comments by making code clearer?
- [ ] Spec Compliance: Matches `docs/api-spec.md`?
- [ ] Cognitive Reset: If retrying, pruned context?
