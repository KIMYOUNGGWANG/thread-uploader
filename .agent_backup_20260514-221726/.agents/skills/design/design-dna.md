---
name: design-dna
description: Intentional UI rules loaded by /develop, /uiux, and /design-review workflows. Keeps surfaces specific, coherent, and non-generic.
---

# 🎨 Design DNA

Apply these rules when implementing or reviewing UI. The goal is not "premium" as a vague adjective. The goal is a surface that feels intentional, trustworthy, and specific to the product.

## 1. Start From the Contract

- [ ] If `DESIGN.md` exists, follow it before inventing new taste.
- [ ] If `docs/screen-flow.md` exists, match the implemented states and transitions to it.
- [ ] Reuse the existing design system when working inside an established product.
- [ ] Do not redesign the app into a different brand unless the task explicitly asks for it.

## 2. Anti-Slop Guardrails

- [ ] Start with one strong visual direction, not `clean modern SaaS`.
- [ ] Reject generic combos:
  - centered hero + three equal cards
  - decorative gradient orb with no structural role
  - one default-safe sans for every hierarchy layer
  - identical radius, shadow, and spacing on every section
  - "premium" copy with no visible design move
- [ ] Add at least one signature move:
  - editorial typography contrast
  - composition break
  - material depth
  - motion identity
  - brand-specific accent pattern
- [ ] If removing the logo makes the page interchangeable, keep refining.

## 3. Typography and Korean UI

- [ ] Use purposeful font pairings, not a single default-safe family everywhere.
- [ ] Prefer Korean-friendly pairings when the interface is in Korean:
  - `Pretendard`
  - `SUIT`
  - `Paperlogy`
  - `Noto Serif KR` for expressive headings when appropriate
- [ ] Long Korean text blocks should consider `word-break: keep-all`.
- [ ] Body copy should usually use generous line-height for Korean readability.
- [ ] Avoid literal translations of English SaaS phrases.
- [ ] CTA copy should describe the outcome, not just the interaction.

**Examples**

```css
.body-copy-ko {
  line-height: 1.7;
  word-break: keep-all;
}

.heading-editorial {
  letter-spacing: -0.03em;
  line-height: 1.05;
}
```

## 4. Color and Material

- [ ] Color should have ownership:
  - one primary role
  - one supporting accent
  - a clear neutral system
- [ ] Avoid purple/pink AI-startup gradients unless the brand already owns them.
- [ ] Do not default to flat white backgrounds without tone, texture, or a deliberate editorial reason.
- [ ] Material choice must be intentional:
  - framed
  - paper
  - frosted
  - tinted
  - clean flat
- [ ] Glassmorphism is optional, never the default answer.

**Directional palettes**

| Direction | Primary | Accent | Surface | Text |
|:---|:---|:---|:---|:---|
| Warm Editorial | `hsl(18 72% 54%)` | `hsl(38 78% 58%)` | `hsl(28 22% 96%)` | `hsl(18 18% 18%)` |
| Quiet Utility | `hsl(210 72% 46%)` | `hsl(188 54% 42%)` | `hsl(210 20% 98%)` | `hsl(210 22% 16%)` |
| Moss Product | `hsl(156 42% 36%)` | `hsl(32 66% 54%)` | `hsl(90 16% 95%)` | `hsl(156 18% 16%)` |
| Ink Contrast | `hsl(222 32% 18%)` | `hsl(12 72% 58%)` | `hsl(210 18% 97%)` | `hsl(222 28% 14%)` |

## 5. States and Goodwill

- [ ] Loading, empty, error, success, permission, and partial states must be visible when relevant.
- [ ] Empty states must include:
  - context
  - next action
  - expected outcome
- [ ] Error states must offer recovery, not just apology.
- [ ] Success states should show what changed.
- [ ] Review every surface with `Goodwill Drains` and `Goodwill Fills`.

**Goodwill Drains**

- ambiguous button labels
- weak confirmation
- dead-end empty states
- generic success copy
- unclear ownership of destructive actions

**Goodwill Fills**

- progress visibility
- reassuring inline guidance
- clear confirmation and undo where possible
- concrete success feedback
- trustworthy, specific copy

## 6. Motion and Interaction

- [ ] Motion should support hierarchy or feedback, not decorate emptiness.
- [ ] Use transform and opacity for performance-friendly interactions.
- [ ] Respect `prefers-reduced-motion`.
- [ ] Touch targets should be at least `44x44px`.
- [ ] Hover cannot be the only signal for critical actions.
- [ ] Focus states must remain visible.

**Interaction defaults**

```css
.interactive {
  transition: transform 180ms ease, opacity 180ms ease, background-color 180ms ease;
}

.interactive:hover {
  transform: translateY(-1px);
}

.interactive:active {
  transform: translateY(0);
}
```

## 7. Layout and Responsive Rhythm

- [ ] Mobile behavior is part of the design, not a follow-up.
- [ ] Avoid using the exact same container rhythm for every section.
- [ ] Use one deliberate scale break or asymmetric composition where the page needs identity.
- [ ] Keep the primary CTA obvious at narrow widths.
- [ ] Prevent horizontal overflow, clipped actions, and keyboard-hidden forms.

## 8. Quick Review Checklist

- [ ] Is the visual direction specific?
- [ ] Is there at least one signature move?
- [ ] Does the page avoid default-safe AI composition?
- [ ] Do Korean type and copy read naturally when applicable?
- [ ] Are user-visible states actually visible?
- [ ] Does the page increase trust, not just visual polish?
