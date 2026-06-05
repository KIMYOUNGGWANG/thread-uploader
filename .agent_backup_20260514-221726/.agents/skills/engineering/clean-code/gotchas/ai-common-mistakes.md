# AI Common Mistakes — Gotchas

## 1. `any` Type Leakage
- **Symptom**: TypeScript compiles but runtime errors occur
- **Cause**: AI uses `any` to bypass type errors quickly
- **Prevention**: NEVER use `any`. Use `unknown` + type narrowing or Zod.

## 2. Abbreviation Habit
- **Symptom**: `req`, `res`, `btn`, `msg` in code
- **Cause**: AI trained on codebases that use abbreviations
- **Prevention**: `request`, `response`, `button`, `message`. Always.

## 3. Over-commenting
- **Symptom**: Comments describing what code does (not why)
- **Cause**: AI generates explanatory comments by default
- **Prevention**: If you're writing a comment, ask: "Can I make the code clearer instead?"

## 4. Hallucinated API Parameters
- **Symptom**: Calling Supabase/Next.js APIs with invented parameters
- **Cause**: AI confuses similar APIs across versions
- **Prevention**: Check `docs/api-spec.md` FIRST. If not specified, read actual source.

## 5. Unnecessary `"use client"`
- **Symptom**: Every component becomes a client component
- **Cause**: AI defaults to client components from older React patterns
- **Prevention**: Server Component is default. Only add `"use client"` for hooks, events, browser APIs.

## 6. Giant Functions
- **Symptom**: 50+ line functions doing multiple things
- **Cause**: AI generates entire features in one function
- **Prevention**: 20-line limit is hard. Extract into smaller functions.
