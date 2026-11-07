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

## Country activation isolation

Live online routes additionally require a matching ISO country in `SIRAH_STRIPE_MONTHLY_COUNTRIES`, `SIRAH_STRIPE_ANNUAL_COUNTRIES`, `SIRAH_PAYPAL_MONTHLY_COUNTRIES` or `SIRAH_PAYPAL_ANNUAL_COUNTRIES`, alongside their existing currency/terms/verification gates. No wildcard or default country is accepted. A GBP-only UK annual test must not enable untested countries that fall back to GBP pricing, nor monthly billing. These country lists remain empty until individual routes are verified and approved.

The GB Stripe country specification was read through the authenticated API. BHD and KWD are **absent** from its supported payment currencies; Bahrain/Kuwait local-currency Stripe collection is not prepared as supported. No FX substitution is authorised. The other catalogue currencies appearing in the country specification are only potential presentment support, not evidence of successful checkout or enrolment. PayPal local-currency routes for PKR, INR, SAR, QAR, BHD, KWD and RON remain unavailable in this integration. Students can save a pending registration.

`process-sirah-maintenance.ts` calls the existing Sīrah maintenance/outbox processor without invoking legacy manual renewal processing. The intended App Platform schedule is hourly at minute 15 UTC, using the existing service's effective runtime variables. Scheduled jobs run only at their scheduled times; there is no permanently running worker.

## Runtime evidence

The production audit completed on deployment `7c327061-8204-4784-860f-aebd045d4e99`, revision `6b8dad8600e6fd2e75412902bcc4b451c80d9f36`. Receiving details match existing organisation records. Existing Sīrah data contains one UNPAID/PENDING registration and two REGISTERED outbox notices recorded SENT; no registration/payment/enrolment was created or changed by the audit. There are no database-role ADMIN users, but the existing static staff dashboard is configured and authenticated `GET /api/admin/sirah` returns 200. Thus staff access is not inferred from the database-role count. No existing PayPal order was available to independently compare the expected merchant ID.

The one explicitly authorised operational message used the existing transactional mailer and EmailLog: log `cmw6t0gb70000t001dbpmc6st`, Resend `01a1b782-e737-7f30-9893-35aca879b783`. Resend subsequently reported **delivered**, separately checked via its authenticated read API. The stable run ID and existing SENT record prevent another operational message on retry/redeployment. This is genuine admin email delivery, not a simulated student payment confirmation. Existing student/admin notice delivery is checked separately by the read-only audit; future successful-payment/refund messages still require genuine relevant events.

Twenty public server quotes across Pakistan, UK, USA, Canada, Eurozone, India, Saudi Arabia, Qatar, Bahrain and Kuwait matched catalogue amounts for both plans. All payment methods remained unavailable under the unset terms and false live verification approvals. Public malformed/unsigned Stripe and PayPal webhook checks returned 400. Desktop (1440) and mobile (390) browser tests verified one saved registration on repeat submission, one student registration notice, secure pending/resume copy, withheld paid invite/access and country/plan persistence. Annual savings rendered GBP 35.99 correctly without horizontal overflow. Browser registrations were isolated in local `sirah_test`, not production.

Receiving-account approval does not by itself publish transfer instructions: `/api/pricing` now filters account details through the selected plan's availability checks, so unset policy approval still returns no receiving instructions. The regression test also verifies that independently revoking JazzCash does not expose its account through a still-approved bank route. Existing issued registrations retain their private proof-submission compatibility.

Follow-up validation: 52 isolated MySQL workflow tests and seven configuration tests pass, including live country isolation and withholding receiving instructions before route/terms approval. Lint/TypeScript pass. The maintenance wrapper passed an isolated local smoke run (no pending work, zero failed tasks). The new availability notice does not claim PayPal is universally unsupported for all residents of a country.
