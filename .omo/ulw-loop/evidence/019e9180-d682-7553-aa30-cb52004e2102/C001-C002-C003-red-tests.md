# RED Test Evidence

Command:

```sh
npm test -- --run src/lib/product-auto-setup.test.ts src/app/api/products/auto-setup/route.test.ts src/app/api/brands/route.test.ts src/components/portfolio-surface.test.ts
```

Result: failed as expected before implementation.

Key failures:

- `src/lib/product-auto-setup.test.ts`: cannot find `@/lib/product-auto-setup`.
- `src/app/api/products/auto-setup/route.test.ts`: cannot find `@/app/api/products/auto-setup/route`.
- `src/app/api/brands/route.test.ts`: cannot find `@/lib/product-auto-setup`.
- `src/components/portfolio-surface.test.ts`: missing `자동 세팅 미리보기`, `세팅 준비도`, and `7일 캠페인 시작` UI contract strings.

This establishes RED for C001 happy path, C002 insufficient-context edge handling, and C003 adjacent UI/regression surface.
