# C003 Regression Test Evidence

Command:

```sh
npm test -- --run src/app/api/generate/route.test.ts src/app/api/campaigns/summary/route.test.ts src/docs-contract.test.ts src/lib/account-discovery.test.ts src/types/brand.test.ts
```

Result:

```text
Test Files  5 passed (5)
Tests  20 passed (20)
```

This confirms existing generate readiness/UTM behavior, campaign summary contracts, docs contract, account-discovery product mode, and brand normalization tests remain green after the product auto-setup workflow changes.
