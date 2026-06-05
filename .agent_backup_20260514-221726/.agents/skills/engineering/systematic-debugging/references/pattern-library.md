# Bug Pattern Library

## Common Patterns

| Pattern | Signature | Where to Look |
|---------|----------|--------------|
| Race condition | Intermittent, timing-dependent | Concurrent access to shared state |
| Nil/null propagation | TypeError, undefined | Missing guards on optional values |
| State corruption | Inconsistent data, partial updates | Transactions, callbacks, hooks |
| Integration failure | Timeout, unexpected response | External API, service boundaries |
| Configuration drift | Works locally, fails staging | Env vars, feature flags |
| Stale cache | Old data returned, clears on cache flush | Redis, CDN, browser cache |

## Multi-Component Diagnostic Template

For systems with multiple layers (CI → build → signing, API → service → DB):

```bash
# Layer 1: Entry point
echo "=== Layer 1: Input ==="
echo "VAR: ${VAR:+SET}${VAR:-UNSET}"

# Layer 2: Processing
echo "=== Layer 2: Environment ==="
env | grep TARGET_VAR || echo "NOT FOUND"

# Layer 3: Output
echo "=== Layer 3: Result ==="
# Check final state
```

This reveals: Which layer the failure occurs at.

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Issue is simple, don't need process" | Simple issues have root causes too |
| "Emergency, no time" | Systematic is FASTER than thrashing |
| "Just try this first" | First fix sets the pattern. Do it right. |
| "Multiple fixes at once saves time" | Can't isolate what worked |
| "One more fix attempt" (after 2+) | 3+ failures = architectural problem |

## Real-World Impact

- Systematic approach: 15-30 minutes to fix
- Random fixes approach: 2-3 hours of thrashing
- First-time fix rate: 95% vs 40%
- New bugs introduced: Near zero vs common
