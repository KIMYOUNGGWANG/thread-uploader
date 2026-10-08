# Global Viral Formulas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `ecommerce_d2c` (cosmicpath-global) formulas with five English-market-proven hook formulas and unblock the word "Saju".

**Architecture:** Data-only change in the domain preset registry plus intent-mode mappings. Generation route already merges `trackFormulas` and `defaultTopics`; no route changes.

**Tech Stack:** TypeScript, Vitest.

Spec: `docs/superpowers/specs/2026-10-08-global-viral-formulas-design.md`

---

### Task 1: Failing test for the new preset

**Files:** Test: `src/lib/domain-registry.test.ts`

- [ ] Add inside the existing `describe`:

```ts
  it("ecommerce_d2c uses english-market viral formulas and allows Saju", () => {
    const preset = getDomainPreset("ecommerce_d2c");
    const formulas = [
      ...preset.trackFormulas.track_a,
      ...preset.trackFormulas.track_b,
      ...preset.trackFormulas.track_c,
    ];
    const ids = formulas.map((formula) => formula.id);
    expect(ids).toEqual(expect.arrayContaining([
      "trend_correction",
      "real_sign_boundary",
      "identity_callout",
      "all_twelve_series",
      "two_birthday_compatibility",
    ]));
    for (const formula of formulas) {
      expect(formula.forbiddenKeywords).not.toContain("Saju");
      expect(formula.forbiddenKeywords).toContain("사주");
    }
  });
```

- [ ] Run `npx vitest run src/lib/domain-registry.test.ts` → FAIL.

### Task 2: Rewrite the preset

**Files:** Modify `src/lib/domain-registry.ts` (`ecommerce_d2c` block), `src/lib/viral-intent-modes.ts` (formula→intent map).

- [ ] Replace `defaultTopics` and `track_a`/`track_b`, drop `"Saju"`, `"Korean bazi"`, `"10-year luck pillar"` from every `forbiddenKeywords` in the block (track_c kept otherwise).
- [ ] Add intent mappings: `trend_correction: "quiet_contrarian"`, `real_sign_boundary: "saveable_tool"`, `identity_callout: "identity_profile"`, `all_twelve_series: "saveable_tool"`, `two_birthday_compatibility: "friend_share"`.
- [ ] Run `npx vitest run src/lib/domain-registry.test.ts` → PASS.
- [ ] Run `npm run test`, `npm run typecheck`, `npm run lint` → no new failures vs `main`.
- [ ] Commit `src/lib/domain-registry.ts src/lib/domain-registry.test.ts src/lib/viral-intent-modes.ts`.

### Task 3: Production viral sources (needs explicit user approval)

- [ ] Read `cosmicpath-global` `brandConfig`, set only `viralDiscovery.competitorHandles`, `viralDiscovery.keywords`, enable `threads_keyword`/`threads_profile` adapters, write back. Values in the spec.
