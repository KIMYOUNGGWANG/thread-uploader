# GREEN Targeted Test Evidence

Command:

```sh
npm test -- --run src/lib/product-auto-setup.test.ts src/app/api/products/auto-setup/route.test.ts src/app/api/brands/route.test.ts src/components/portfolio-surface.test.ts
```

Result:

```text
Test Files  4 passed (4)
Tests  14 passed (14)
```

Covered criteria:

- C001: ready auto-setup draft, persisted create config, and UI surface contract.
- C002: insufficient product context returns gaps and blocks campaign start readiness.
- C003: existing product-growth creation and generic product UI contracts still pass.
