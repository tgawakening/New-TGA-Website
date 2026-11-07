# Interrupted receipt compatibility check — 7 November 2026

Started from `main` at `526eec5d06e0904787941fa1336e4694770e9dd2`. The workspace was clean. Existing registration, PayPal plan/capture/webhook checks and sandbox-renewal ownership guards were inspected and reused. No landing-page redesign, new checkout architecture, payment account, product, plan or webhook was created.

## Compatibility repair

The API already accepts private evidence for an owned manual order with its saved terms even when new collection is disabled. The form showed evidence controls but hid the terms checkbox behind current method availability, leaving Submit for admin review permanently disabled. It now renders the saved terms when `manualEvidenceAllowed` is true and shows the locked method as saved instructions only. It warns against a new transfer, retains the receipt/reference flow, and explains replacement after rejection. Current disabled-account details are not redisplayed and the API's ownership, amount, revision and staff-verification rules are unchanged.

Optional `SIRAH_BANK_TRANSFER_VERIFIED` and `SIRAH_JAZZCASH_VERIFIED` independently control new instructions. Blank/unset inherits the existing `SIRAH_MANUAL_ACCOUNTS_VERIFIED`; explicit false revokes new collection for that account. Setting one to true does not approve the other. Both still require the existing plan-terms gate. No production flags were changed.

A public malformed PayPal delivery probe returned 504 while attempting provider verification. Unsigned/malformed deliveries now fail with HTTP 400 before OAuth/provider requests. Complete signed deliveries retain the same PayPal signature verification and quote-checked, idempotent capture path.

## Verification

- 39 isolated MySQL workflow tests pass, including disabled bank/JazzCash proof compatibility, wrong-owner denial, no new account creation through disabled methods, rejection/replacement, two staff reviewers, one enrolment, independent receiving-account approval, and malformed/unsigned PayPal rejection without external calls.
- Six Sīrah configuration tests pass; lint, TypeScript and production build pass.
- Desktop (1,350 px) and mobile (390 px) tests against the production build with all new-payment routes disabled: scoped resume into saved bank/JazzCash orders, visible saved terms, enabled proof upload after consent, no current account details, pending review, staff dashboard visibility, rejection/replacement and idempotent approval. New applicants cannot select a disabled manual route and can still save a pending registration.
- [Desktop proof form](desktop.png) and [mobile proof form](mobile.png) contain isolated synthetic student/receipt data only. No external email, real charge or subscription was created.
- Public quotes were checked for PK, GB, US, FR, BH and SA, both plans: all returned no methods and no approved terms/instructions. Registration readiness returned 200/available; anonymous order/evidence access was denied; missing receipts remained private; invalid Stripe signatures returned 400.

No DigitalOcean credentials, production database, provider API credentials or sandbox credentials are attached to this session. Private deployment state/logs, migration history, actual student records, webhook delivery history and current merchant/account configuration cannot be independently inspected. Public readiness is not a full migration audit. Repository documents report that the resume migration was previously applied; this repair adds no migration.

## Approval request and exact configuration actions

TGA must provide approved policy values rather than placeholders:

- Annual: refund window, eligibility/exclusions and calculation; access start/end, recording duration and refund/access consequences; confirm one payment for twelve months without rebilling.
- Monthly: twelve-instalment obligation versus voluntary continuation; cancellation timing; failed-payment access; refund eligibility and consequences for access and future billing.
- Finance: actual merchant/service tax classification and collection jurisdictions, supported billing regions, and inclusive/exclusive/non-taxable fee treatment. Tax-added collection requires subtotal/tax/gross verification implementation and tests before approval.
- Manual: approve the existing Meezan and JazzCash accounts separately, exact instructions/transfer fees and the named receipt-verifying staff member. No new account details are proposed.
- PayPal: expected Business Merchant ID; authorise the compatible subscription collection settings. The old preferred GBP plan is incompatible and is not modified. Product and Sīrah webhook references in the launch handoff remain prior-inspection evidence, not fresh provider verification here.

In approved secure configuration, provide DigitalOcean/admin runner access and the isolated `SIRAH_SANDBOX_STRIPE_SECRET_KEY`/`SIRAH_SANDBOX_STRIPE_ACCOUNT_ID`; provide a separate PayPal sandbox app and buyer. Never substitute sandbox credentials into older-batch or live variables.

After each route's real tests and approvals pass, apply only that route's settings:

- Terms: `SIRAH_ANNUAL_TERMS_JSON` / `SIRAH_MONTHLY_TERMS_JSON` using the existing full validated terms schema.
- Pakistan manual: `SIRAH_BANK_TRANSFER_VERIFIED=true` only after Meezan approval; `SIRAH_JAZZCASH_VERIFIED=true` only after JazzCash approval. Keep unapproved overrides false and the shared flag false. Existing staff receipt verification is mandatory.
- PayPal upfront first: verify `PAYPAL_ENV`, existing API credentials, `SIRAH_PAYPAL_MERCHANT_ID`, `SIRAH_PAYPAL_WEBHOOK_ID`, then allow only tested currencies in `SIRAH_PAYPAL_ANNUAL_CURRENCIES`. `SIRAH_LIVE_PAYMENTS_APPROVED` stays false until applicable annual terms, finance and genuine capture/signed-app-webhook/enrolment checks pass. Keep monthly currency list empty while monthly is unverified.
- PayPal monthly: additionally verify `SIRAH_PAYPAL_PRODUCT_ID`, a compatible `SIRAH_PAYPAL_MONTHLY_PLAN_GBP` if supplied, and `SIRAH_PAYPAL_MONTHLY_CURRENCIES`; test actual first and subsequent settlement, signed app delivery, failure and cancellation before collection.
- Stripe: retain the dedicated `SIRAH_STRIPE_SECRET_KEY`, `SIRAH_STRIPE_WEBHOOK_SECRET` and `SIRAH_STRIPE_ACCOUNT_ID`; set only tested plan currencies. `SIRAH_STRIPE_SANDBOX_VERIFIED`, `SIRAH_PK_RECURRING_VERIFIED` and live approval cannot be inferred from a provider-only payment or mocked tests. Never run the test-clock script with live credentials.

Resume email uses existing `RESEND_API_KEY`, verified `EMAIL_FROM` and `NEXT_PUBLIC_APP_URL`; actual production delivery is still unverified here. The earliest manual route needs TGA's receiving-account, plan/tax and staff approval. The priority PayPal annual route additionally needs merchant identity and genuine sandbox capture/app-webhook/enrolment evidence. No method is reported activated by this code repair.
