# Production handoff — 8 November 2026

PR #20 merged as `aa0adfbcf6dfc4fd5a0c71e39a0cc579bd028dc8` and was independently observed ACTIVE on DigitalOcean `tga-app` / `new-tga-website`. Its 50 isolated MySQL workflow tests, six configuration tests, lint, TypeScript and production build passed. No schema migration was added.

## Continuation changes

- Checkout only selects an existing saved or configured reusable PayPal plan; it never creates a plan per student. Incompatible plans fail closed, without being modified. Monthly availability also requires the currency's stable plan mapping.
- `scripts/provision-sirah-paypal-plans.ts` inventories/reuses compatible plans by default. `--apply --merchant-order <existing order ID>` may create missing plans only after approved monthly terms are installed and the existing provider order independently matches the configured merchant. Stable provider idempotency keys and inventory checks avoid duplicate per-currency plans. Creation does not enable website checkout or establish settlement verification.
- The authenticated live product inventory found only `P-41P7163096581714RNLXSPAA`, GBP 29.99, ACTIVE, monthly, twelve cycles, but `auto_bill_outstanding=true`. It is preserved. No compatible plan exists for the eleven requested currencies; none has been created while applicable terms and merchant verification remain unresolved. [Inventory](paypal-plan-inventory.json).
- Exact upfront savings derive from the authoritative catalogue using minor units. UK saves GBP 35.99; Pakistan saves PKR 3,600 against online PKR 3,000 × 12, not the manual PKR 3,500 rate. All catalogue prices are unchanged.
- Sīrah legacy payment support now uses 03262055614 / https://wa.me/923262055614. The shared form prioritises private portal proof uploads with WhatsApp as optional support. Existing saved-instruction/proof compatibility remains intact.
- The separate [course-specific policy draft](../owner-policy-review/sirah-policy-proposed.md) preserves confirmed owner decisions, identifies the old fourteen-day/full-refund overlap and keeps publication approval false. The general policy and older-batch payment integrations are unchanged.

## Authenticated provider/configuration checks

Dedicated Stripe account `acct_1UYuUHLfETexupIv` matches the current secret key, is GB-based, and has charges, payouts and card-payments capability enabled. Its enabled live webhook is `we_1UZ6dULfETexupIvsWndphk5` at `https://tga-awakening.com/api/sirah/stripe/webhook`. Its company legal name is **Global Awakening Ltd**, which differs from the owner-confirmed **Global Awakening CIC**. This requires authorised business-record/account correction or clarification before live collection; the integration does not change KYC details. Configuration alone is not a signed application-event/enrolment end-to-end test.

Existing live PayPal credentials access product `PROD-4MG49974LK7417127` and webhook `8P300895YB677700G` at `https://www.tga-awakening.com/api/sirah/webhooks/paypal`. Configured merchant ID is present; comparison with independently retrieved payment payee details remains necessary. No new PayPal app/product or older-batch credentials were created/replaced.

The exact confirmed Meezan and JazzCash values were installed in the existing five service runtime variables, not a duplicate account file. The verified existing PayPal webhook ID was restored to service runtime configuration. App Platform redeploys for these environment changes. Activation flags and currency whitelists remain unchanged.

## Production audit

`scripts/check-sirah-production.ts` runs inside the existing authorised app runtime. It reads aggregate payment/notification state, active-admin count, receiving-detail consistency and available existing provider references without printing student identities. Optional `SIRAH_OPERATIONS_SEND_EMAIL=true` plus a stable `SIRAH_OPERATIONS_RUN_ID` sends one operational delivery check per configured admin through the existing `sendTransactionalEmail`/EmailLog path. It neither creates student registrations nor simulates paid enrolment. Delivery is reported separately from provider acceptance. It cannot by itself prove a genuine student payment webhook or renewals.

## Remaining activation requirements

1. Authorised publication approval and the exact unresolved clauses in the course policy draft; finance/accountant determination for the actual mixed teaching/recordings supply and each first launch jurisdiction. No universal tax exemption is inferred from CIC status, and prices/tax are not changed automatically.
2. Pakistan receiving accounts must match organisation records and have authorised reviewing staff. Each manual account is independently gated; saved instructions/proofs remain usable even when new transfers are disabled. New manual payment instructions additionally require approved plan terms.
3. Genuine Stripe app signed-event/payment/enrolment and monthly test-clock renewal checks remain pending. The Sīrah sandbox API key is absent in current runtime; existing live credentials cannot operate a test clock. The earlier successful PKR 32,400 upfront and first PKR 3,000 invoice are provider-only evidence.
4. PayPal monthly compatible reusable plans, genuine initial/renewal settlement, cancellation and signature/enrolment checks remain pending. Annual uses existing Orders/Capture without subscription. No real customer is charged as an operational check.

No unverified route is enabled by this rollout. Registrations remain saveable with secure resume and pending status. Live collection is not inferred from API-key authentication or an ACTIVE provider plan.
