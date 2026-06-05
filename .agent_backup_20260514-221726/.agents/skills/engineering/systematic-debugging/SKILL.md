---
name: systematic-debugging
description: "Use when debugging errors, investigating bugs, or fixing failures. 4-phase root cause protocol: Reproduce → Pattern → Hypothesis → Implement. Prevents recurring bugs through systematic analysis instead of quick patches."
user-invocable: true
allowed-tools: ["Bash", "Read", "Write"]
---

# Systematic Debugging

**Core principle:** ALWAYS find root cause before attempting fixes. Symptom fixes are failure.

## The Iron Law

```
NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST
```

## The Four Phases

### Phase 1: Root Cause Investigation
1. **Read Error Messages** — Don't skip. Read stack traces completely.
2. **Reproduce Consistently** — If not reproducible → gather more data, don't guess.
3. **Check Recent Changes** — `git diff`, recent commits, env differences.
4. **Gather Evidence** — For multi-component systems, add diagnostic logging at EACH boundary. See `references/pattern-library.md`.
5. **Trace Data Flow** — Where does bad value originate? Keep tracing up.

### Phase 2: Pattern Analysis
1. Find working examples in same codebase
2. Compare against references — read COMPLETELY, don't skim
3. Identify differences between working and broken
4. Understand dependencies and assumptions

### Phase 3: Hypothesis and Testing
1. Form single, specific hypothesis: "I think X because Y"
2. Make SMALLEST possible change to test
3. Didn't work? Form NEW hypothesis. Don't stack fixes.
4. **3-Strike Rule**: 3 hypotheses failed → STOP. Question the architecture.

### Phase 4: Implementation
1. Create failing test case FIRST
2. ONE fix at a time — no "while I'm here" improvements
3. Verify: test passes, no regressions
4. If ≥3 fixes failed → architectural problem. Discuss with human.

## Red Flags — STOP and Return to Phase 1

If thinking: "Quick fix for now", "Just try X", "One more attempt", "I don't fully understand but..."

## Resources in This Skill

- `references/pattern-library.md` — Common bug patterns, signatures, and where to look
- `scripts/scope-guard.sh` — Validates file edits against debug scope lock
- `gotchas/common-traps.md` — AI-specific debugging pitfalls

## Quick Reference

| Phase | Key Activity | Success Criteria |
|-------|-------------|-----------------|
| 1. Root Cause | Read errors, reproduce, trace | Understand WHAT and WHY |
| 2. Pattern | Find working examples, compare | Identify differences |
| 3. Hypothesis | Form theory, test minimally | Confirmed or new hypothesis |
| 4. Implementation | Create test, fix, verify | Bug resolved, tests pass |
