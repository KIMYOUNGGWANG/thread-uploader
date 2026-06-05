---
name: code-quality-reviewer
description: 태스크 완료, 주요 기능 구현, main 브랜치 병합 전 코드 리뷰 요청 시 사용. Git SHAs 기반 코드리뷰어 서브에이전트 디스패치. Critical 이슈 즉시 수정, Important 이슈 진행 전 수정.
---

# Requesting Code Review

Dispatch code-reviewer subagent to catch issues before they cascade. The reviewer gets precisely crafted context for evaluation — never your session's history. This keeps the reviewer focused on the work product, not your thought process.

**Core principle:** Review early, review often.

## When to Request Review

**Mandatory:**
- After completing major feature
- Before merge to main
- After each task in subagent-driven development

**Optional but valuable:**
- When stuck (fresh perspective)
- Before refactoring (baseline check)
- After fixing complex bug

## How to Request

**1. Get git SHAs:**
```bash
BASE_SHA=$(git rev-parse HEAD~1)  # or origin/main
HEAD_SHA=$(git rev-parse HEAD)
```

**2. Dispatch code-reviewer subagent:**

Use the Agent tool with `superpowers:code-reviewer` type:

Fill in:
- `{WHAT_WAS_IMPLEMENTED}` - What you just built
- `{PLAN_OR_REQUIREMENTS}` - What it should do
- `{BASE_SHA}` - Starting commit
- `{HEAD_SHA}` - Ending commit
- `{DESCRIPTION}` - Brief summary

**3. Act on feedback:**
- Fix Critical issues immediately
- Fix Important issues before proceeding
- Note Minor issues for later
- Push back if reviewer is wrong (with reasoning)

## Review Checklist (Self-Review Before Dispatching)

### Logic & Accuracy
- [ ] Does code handle edge cases (null, undefined, empty)?
- [ ] Is there any dead or unreachable code?
- [ ] Are error states handled explicitly?
- [ ] Are all async operations properly awaited?

### TypeScript Quality
- [ ] No `any` types (use `unknown` + type narrowing or proper interfaces)
- [ ] No unsafe `as` casting without justification
- [ ] No `ts-ignore` or `ts-expect-error` comments
- [ ] All function parameters and return types typed

### React/Next.js Patterns
- [ ] No raw `useEffect` for data fetching (use TanStack Query)
- [ ] Named exports only (except Next.js reserved files)
- [ ] No `components/ui/` files modified directly
- [ ] Loading, error, empty states all handled
- [ ] No hardcoded secrets or env values

### Supabase/Security
- [ ] All user inputs validated with Zod
- [ ] No service role key used on client
- [ ] RLS enabled on affected tables
- [ ] Error messages don't expose internal details
- [ ] All Supabase calls check `{ data, error }`

### Code Style
- [ ] Are variables named clearly (per clean-code.md)?
- [ ] Are functions single-purpose and well-named?
- [ ] Are components reusable and not over-specialized?
- [ ] Is there hardcoded logic that should be configuration?

## Example Review Request

```
[Just completed: User authentication with Supabase]

Get SHAs:
BASE_SHA=$(git rev-parse origin/main)
HEAD_SHA=$(git rev-parse HEAD)

Dispatch code-reviewer:
  WHAT_WAS_IMPLEMENTED: Supabase auth with email/password and Google OAuth
  PLAN_OR_REQUIREMENTS: Users can sign up, log in, and access protected routes
  BASE_SHA: a7981ec
  HEAD_SHA: 3df7661
  DESCRIPTION: Added auth middleware, login page, and protected route wrapper

[Reviewer returns]:
  Strengths: Proper httpOnly cookie handling, middleware pattern correct
  Issues:
    Critical: getSession() used instead of getUser() in server component
    Important: Missing rate limiting on auth endpoints
    Minor: Console.log left in auth callback
  Assessment: Fix Critical and Important before deploying
```

## Integration with Workflows

**During `/develop` workflow:**
- Review after each phase (Backend → Frontend → Integration)
- Catch issues before they compound
- Fix before moving to next phase

**Before `/ship` workflow:**
- Full review of all changes since last review
- Ensure production readiness checklist passes

## Red Flags

**Never:**
- Skip review because "it's simple"
- Ignore Critical issues
- Proceed with unfixed Important issues
- Argue with valid technical feedback

**If reviewer is wrong:**
- Push back with technical reasoning
- Show code/tests that prove it works
- Request clarification on the concern
