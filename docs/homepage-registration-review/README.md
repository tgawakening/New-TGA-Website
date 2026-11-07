# Homepage and registration reconciliation — 7 November 2026

## Repository state

The workspace was clean at the start. Local `main` was stale; the first fetch found `origin/main` at `3cbff63` (the newer Sīrah landing hero). Draft #13 remained on `codex/homepage-sirah-feature` at `628b9ba`. Although it had been reported unmergeable, the fresh GitHub metadata reported it mergeable. Merging latest main into that branch completed without textual conflicts and preserved the landing hero.

The combined registration form and secure resume links were on draft #14 at `370aee4`, absent from main at the first fetch. The enquiry-button styling was on draft #16 at `1d3f04b`; it remains a separate review item. There were no uncommitted registration design edits to recover.

During verification, main advanced to `e8f92dd6a417f04bbad5ad392d0b4d7499041f34`: #14 was merged. Its merge message records that the production payment-resume migration completed before rollout. This latest main was merged into the homepage branch too. Registration now matches main exactly; this PR's remaining application changes are the homepage feature and removal of the old promotion. The `/seerah` landing markup and CSS also match main exactly.

## Homepage

One feature sits immediately after the main hero and before Mission & Vision. It reuses the desktop and portrait parchment sources from `courseConfig`, shows the visible full course name including Law, Power, Leadership & Movement, a short introduction, and one “Explore the Sīrah Course” link to `/seerah`. The old doorway promotion/component is removed.

Desktop height is content driven: 390 px at 1,350 px wide. At 390 px wide the feature is 586 px tall, with the copy and button in normal flow above the portrait; only its empty upper surface is cropped. Browser checks also cover 768 and 1,440 px. The section has no horizontal overflow at any checked width.

[Desktop preview](homepage-desktop.png) · [Mobile preview](homepage-mobile.png)

## Registration and public checks

Before the #14 rollout, direct `/seerah/register` entry and the Register button on `/seerah` both opened the older compact form: account fields, plan and pricing appeared, but inline payment-method selection was missing. This was an undeployed-branch issue rather than a different entry component.

Public pages were checked again after main advanced, at **19:53 PKT on 7 November 2026**. On fresh desktop and mobile sessions, both entry points now open the combined form, including inline payment-method selection. Changing to UK annual updates the summary to **GBP 323.89**, one payment for 12 months. The public quote returns `methods: []` and `terms: null` for that selection: methods remain unavailable pending approved configuration. Those gates were not changed.

The public homepage still has the doorway promotion after Mission & Vision. The newer landing hero is public. These observations come from rendered public pages, not Vercel's separate deployment status.

[Live desktop registration](registration-live-desktop.png) · [Live mobile registration](registration-live-mobile.png) · [Live mobile price and methods after selecting UK annual](registration-live-payment-mobile.png)

The production origin responds with `x-do-app-origin: ec0a3209-f496-4fc4-b695-93f2e0ed3000`. No DigitalOcean credentials, console, source-branch metadata or deployment SHA are available in this environment; public pages do not expose an exact source revision. Their observed behaviour is consistent with main including `e8f92dd`, but that is not independent confirmation of the active DigitalOcean branch/SHA.

## Verification

- `npm run check`: lint, TypeScript and production build passed.
- `npm run test:seerah`: six configuration tests passed.
- `npm run test:sirah-workflow`: all 31 tests passed against isolated local MySQL, including same-order reuse, method pricing, resume tokens, email deduplication, verified confirmation, signed synthetic webhooks and older registrations.
- The resume migration applied successfully in that isolated database. No production database operation was performed in this task.
- Chromium checks against the production build at 390, 768, 1,350 and 1,440 px: correct feature placement, one feature/link, correct responsive source, no section overflow, clear mobile copy, working `/seerah` navigation and preserved landing hero.
- Eight fresh registration entry checks: direct URL and landing button at all four widths. Blank account fields, inline methods in the same form, and no dialog horizontal overflow.
- Country/plan/method checks: PK monthly automatic PKR 3,000 vs manual PKR 3,500, UK GBP 29.99 monthly / 323.89 annual, Bahrain BHD 8.500 monthly / 91.800 annual, and an unconfigured market with no methods. Changing country removes an ineligible selected manual method.
- A synthetic browser registration saved one UNPAID/PENDING order. Refresh reused that order and did not add a resume link or notification. An anonymous secure resume link reopened the same order, removed its URL fragment, and could not access the general order listing. The paid invitation endpoint denied access before verified payment.

[Local combined form and payment controls](registration-local-payment-desktop.png) uses explicitly synthetic local payment configuration and terms. It is not evidence of live provider availability. No external email or payment was sent; no real Stripe/PayPal settlement was tested here.

## Deployment step

Review and merge updated **PR #13** into `main`, then let DigitalOcean deploy that resulting main commit (or select that exact commit in App Platform if automatic deployment is disabled). The homepage change adds no migration. The already merged registration migration is recorded as completed in `e8f92dd`; verify the active deployment's source branch and SHA in DigitalOcean before declaring the homepage live. Finally check the public homepage feature appears before Mission & Vision, links to `/seerah`, and both registration entry points still work.

No production merge or deployment was performed for this homepage update.

## Follow-up synchronization

The owner identified a newer main push, `0a8f6cdfec576318d6d67f70ba995da67ec5bb4e`, containing the approved-domain registration submission and payment-return fix. That main commit was merged into this review branch, preserving the newer server origin checks. Build, lint, TypeScript and all 31 isolated workflow tests passed again.

Public read-only invalid-resume probes now return HTTP 410 on both `https://tga-awakening.com` and `https://www.tga-awakening.com`, while an unrelated Origin returns HTTP 403 on both. This verifies the deployed origin handling without creating a registration or charging a payment. It does not expose the active DigitalOcean source SHA; the homepage feature remains in this review PR.
