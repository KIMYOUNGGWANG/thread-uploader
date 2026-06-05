# Final Manual QA

## HTTP

- `/api/brands` with `auth_session=ulw_qa_user_portfolio`: PASS, returned fixed QA products with product profiles and active experiments.
- `/api/brands` with `auth_session=ulw_qa_user_empty_portfolio`: PASS, returned `[]`.
- `/api/campaigns/summary?brandId=ulw_qa_product_cosmicpath`: PASS, returned product/experiment metrics and next action.
- `/api/campaigns/summary?brandId=ulw_qa_product_no_posts`: PASS, returned `product_growth_baseline` and `product_growth`.
- `/api/campaigns/summary?brandId=ulw_qa_product_cosmicpath&campaignId=missing_campaign`: PASS, returned HTTP 404.
- `/api/tiktok/videos/generate` for disabled generic product: PASS, returned HTTP 400 before draft generation.
- `/api/accounts/discover` for generic product: PASS, returned adjacent product/brand-topic candidate and no career/saju keyword sources.
- `/api/brands` id-only product baseline create followed by `/api/accounts/discover`: PASS, top-level `product_growth` readback and product-mode discovery.
- `/api/generate` for missing prompt fixture: PASS, returned product settings validation error.
- `/api/generate` for valid generic product: PASS on retry, created one `product_growth_baseline` post with product_growth quality and UTM readback.

## Browser

- `/login`: PASS, title is Portfolio Growth OS.
- `/brands`: PASS, product cards and product language render.
- `/brands` create product modal: PASS, neutral `InvoiceFlow`/`invoiceflow` placeholders render and modal-scoped forbidden CosmicPath/career/saju text is absent.
- `/brands` create product modal POST intercept: PASS, payload includes `brandConfig.productProfile` and `brandConfig.activeExperiment`.
- Empty QA user `/brands`: PASS, "아직 제품이 없어요" and "첫 제품 만들기" render.
- `/brands/ulw-qa-cosmicpath/settings` Product tab: PASS, product profile and active experiment fields render.
- `/brands/ulw-qa-no-posts/settings` Product tab save: PASS, edited Product Profile and Active Experiment fields were sent in PATCH and persisted after reload.
- `/brands/ulw-qa-no-posts/settings` Product tab: PASS, neutral placeholders render.
- `/brands/ulw-qa-no-posts/settings` Campaign tab: PASS, product baseline and generic product formulas render.
- `/brands/ulw-qa-cosmicpath`: PASS, Portfolio Overview renders experiment, metrics, quality, and next action.

## Artifacts

- `.omo/evidence/portfolio-brands.png`
- `.omo/evidence/portfolio-create-modal.png`
- `.omo/evidence/portfolio-create-modal-payload.png`
- `.omo/evidence/portfolio-product-save-e2e.png`
- `.omo/evidence/portfolio-settings-product-tab.png`
- `.omo/evidence/portfolio-dashboard-overview.png`
- `.omo/evidence/portfolio-noncosmic-campaign-tab.png`
- `.omo/evidence/portfolio-noncosmic-product-tab.png`
- `.omo/evidence/noncosmic-summary-response.json`
- `.omo/evidence/task-8-account-discovery-product.http`
- `.omo/evidence/task-8-idonly-product-discovery.http`
- `.omo/evidence/task-9-summary-missing-campaign.http`
- `.omo/evidence/task-10-disabled-tiktok-generate.http`
- `.omo/evidence/task-5-product-settings-save-e2e.txt`
- `.omo/evidence/task-6-create-modal-placeholder-browser.txt`
- `.omo/evidence/task-6-create-modal-payload-intercept.txt`
- `.omo/evidence/task-7-generate-product.http`
