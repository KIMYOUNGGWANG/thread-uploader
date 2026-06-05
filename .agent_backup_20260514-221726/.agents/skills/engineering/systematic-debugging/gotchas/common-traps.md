# Debugging Gotchas — AI-Specific Traps

## 1. Scope Creep During Debug
- **Symptom**: Fixing bug A leads to "fixing" unrelated file B
- **Cause**: AI sees an improvement opportunity and acts on it
- **Prevention**: Use `scripts/scope-guard.sh` to enforce debug scope. Only edit files inside `debug-scope.txt`.

## 2. Symptom Masking
- **Symptom**: Bug disappears but root cause remains
- **Cause**: Adding a null check or try-catch that hides the real problem
- **Prevention**: Write a FAILING test BEFORE fixing. If no test, the fix can't be verified.

## 3. Fix Stacking
- **Symptom**: Multiple changes in one commit, unclear which one fixed it
- **Cause**: Trying multiple hypotheses without reverting between attempts
- **Prevention**: ONE hypothesis, ONE change, ONE test. Revert if it fails.

## 4. Hallucinated API Behavior
- **Symptom**: Fix assumes an API behaves a certain way
- **Cause**: AI confuses similar APIs or invents parameters
- **Prevention**: Always verify against `docs/api-spec.md`. If not specified, ASK.

## 5. WTF Score Blindness
- **Symptom**: Repeatedly editing the same file 5+ times
- **Cause**: Ignoring self-regulation signals
- **Prevention**: After 3rd edit to same file → WTF Score +2. Score ≥ 6 → HALT.
