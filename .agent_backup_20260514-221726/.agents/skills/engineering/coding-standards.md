---
name: coding-standards
description: Mandatory coding standards loaded by /develop and /fix workflows. Extracted from GEMINI.md Section 7 to reduce base token load.
---

# 🛠️ Embedded Engineering Standards (Global Rules)

The following checklist must be strictly adhered to during any **EXECUTION** (coding) phase. Treat these as mandatory test cases.

### [ ] 1. Architecture & Clean Code
- [ ] **Descriptive Naming**: DO NOT use acronyms (e.g., `req`, `res`, `err`). Use full-word, descriptive variable names.
- [ ] **Function Size**: Functions over 40 lines must be extracted and refactored.
- [ ] **FSD Lite**: Keep components, hooks, and utils logically co-located by feature/domain.

### [ ] 2. Next.js App Router & React
- [ ] **Server by Default**: All components must be React Server Components (RSC) unless interactivity (hooks, events) is required.
- [ ] **Interactive Boundaries**: Push `"use client"` directives as deep into the component tree as possible.
- [ ] **Data Fetching**: Use TanStack Query for client state. Fetch directly in RSC for server state.

### [ ] 3. State & Error Handling
- [ ] **State Management**: Use Zustand for global state. Do NOT use React Context for rapidly changing values.
- [ ] **Defensive Coding**: Every API/DB call MUST be wrapped in a `try...catch` block.
- [ ] **User Feedback**: Errors must trigger a user-facing Toast message. Never fail silently.

### [ ] 4. Security & Validation
- [ ] **Input Validation**: All forms, API payloads, and DB inserts MUST be rigidly validated using Zod.
- [ ] **Strict Types**: Define all TypeScript interfaces/types explicitly. The `any` keyword is strictly prohibited.
- [ ] **Accessibility (A11y)**: Buttons and interactive elements must have semantic IDs and `aria-label`s.

### [ ] 5. Planning & Continuous Improvement (concise-planning + kaizen)
- [ ] **Plan First**: Before writing ANY code, produce a brief numbered list of what will be done. Max 5 lines.
- [ ] **Atomic Commits**: Each commit does exactly ONE thing. No mixed concerns.
- [ ] **Kaizen Gate**: After each PR/task, log one thing that could be improved next time in `task_board.md`.

### [ ] 6. Context & Token Management (context-window-management)
- [ ] **Summarize, Don't Repeat**: Never repeat previous outputs verbatim. Reference them by filename instead.
- [ ] **Trim First**: Before adding new context, remove irrelevant/stale information from memory files.
- [ ] **Serial Position**: Put the MOST CRITICAL rules at the TOP of any prompt/context bundle (not the bottom).

### [ ] 7. Payments & Growth (stripe-integration + analytics-tracking + form-cro)
- [ ] **Stripe Webhooks**: All Stripe events MUST be handled via signed webhooks. Never trust client-side payment confirmation.
- [ ] **Analytics Events**: Track only intentional, decision-driving events (e.g., `signup_complete`, `upgrade_clicked`). No vanity metrics.
- [ ] **Form Friction**: Every form field must have a business justification. If it can't be removed, make it optional.

### [ ] 8. Release Hygiene (changelog-automation + code-review-checklist)
- [ ] **Changelog**: Every PR MUST have a one-line entry in `CHANGELOG.md` under the correct version header.
- [ ] **PR Checklist**: Before merging, verify: (1) Tests pass, (2) No `any` types, (3) No hardcoded secrets, (4) Error boundaries present.
- [ ] **ADR**: Any architectural decision (new DB, new auth provider, etc.) MUST be documented in `docs/decisions/`.

## Measured Standards

| Area | Default | Escalate When |
|------|---------|---------------|
| Function length | under 20 lines | 21+ lines require extraction or comment-level justification |
| Branch count | up to 3 branches | 4+ branches suggests strategy extraction |
| File responsibility | 1 primary concern | mixed UI + data + policy in one file |
| Naming | full words | acronym only when industry-standard (`URL`, `HTML`) |

## Good vs Bad

```typescript
// ❌ vague and overloaded
async function handle(req: Request) {
  const data = await getData(req);
  if (!data) return null;
  // ...
}

// ✅ descriptive and focused
async function createBookingFromRequest(request: Request) {
  const bookingInput = await parseBookingInput(request);
  return await persistBooking(bookingInput);
}
```

## Review Checklist

- [ ] 함수 이름만 봐도 부작용과 반환값이 예상되는가?
- [ ] 한 파일 안에서 정책, IO, UI가 뒤섞이지 않았는가?
- [ ] `any`, 암묵적 null, magic string이 남아 있지 않은가?
- [ ] 리팩터링 없이 설명 주석만 늘어난 부분은 없는가?
