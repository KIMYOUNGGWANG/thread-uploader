# CosmicPath viral reset visual QA manifest

Captured after the final UI edit on 2026-09-28 from the real Next.js dashboard in Playwright Chromium.

## Enumerated states and viewports

1. Empty state: 375x900, 768x900, 1280x900
2. Incomplete state: 375x900, 768x900, 1280x900
3. Ready state: 375x900, 768x900, 1280x900
4. Supplemental full-page mobile coverage: incomplete and ready at 375px viewport width

## Runtime assertions

- Authenticated dashboard route: `/brands/ulw-qa-demo-assets`
- Campaign panel toggles open and exposes the readiness surface.
- Before responsive fix: `clientWidth=360`, `scrollWidth=477`.
- After responsive fix: `clientWidth=360`, `scrollWidth=360`, overflow offenders `[]`.
- All viewport captures are valid RGB PNG files at the exact requested viewport dimensions.
- Incomplete and ready states use a browser-local response override only; no database records were written.
- There is no pixel-reference target. Review against the stated product intent, responsive behavior, existing component system, and CJK precision.
