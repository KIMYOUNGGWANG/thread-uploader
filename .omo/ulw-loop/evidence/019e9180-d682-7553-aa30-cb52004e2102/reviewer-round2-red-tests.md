# Reviewer Round 2 RED Evidence

Command:

```sh
npm test -- --run src/lib/product-auto-setup.test.ts src/app/api/products/auto-setup/route.test.ts src/components/ProductCampaignStartPanel.test.ts
```

Result: failed as expected before round 2 fixes.

Key failures:

- `//invoiceflow.app` was accepted as ready.
- Product start panel was enabled when campaign landing URL was blank.
