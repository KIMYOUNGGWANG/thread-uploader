# Reviewer Follow-Up RED Evidence

Command:

```sh
npm test -- --run src/lib/product-auto-setup.test.ts src/app/api/products/auto-setup/route.test.ts src/app/api/generate/route.test.ts src/components/ProductCampaignStartPanel.test.ts
```

Result: failed as expected before follow-up fixes.

Key failures:

- Malformed `landingUrl: "not-a-url"` still returned `ready`.
- Product campaign start panel did not disable on malformed landing URL.
- `validateGenerationReadiness` did not require explicit product campaign start approval.
