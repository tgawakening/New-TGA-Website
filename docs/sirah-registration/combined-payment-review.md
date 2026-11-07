# Combined Sīrah registration and payment review

The new batch now previews approved payment methods and method-specific regional prices immediately beneath the account fields, following the inline selection/instruction pattern in `components/sirah/legacy-registration.tsx`. It reuses the existing new-batch form, password/phone controls, server catalogue, order/repricing service, Checkout locks, receipt review, notification outbox and verified confirmation endpoint. The legacy component, routes and global Stripe keys are unchanged.

## Behaviour

- Country and monthly/upfront selections fetch a fresh server quote. An unapproved payment method cannot create an account or start payment. A stale quote cannot submit online payment, and a changed terms version or saved agreement requires review again.
- Registration saves first, with one order per user/course/batch. Online continuation uses that saved order. Lost Checkout responses refresh its server status; an unresolved provider attempt must be reconciled/expired before another route can start.
- Manual routes show approved account instructions inline, then use the saved reference and existing private evidence submission. Status becomes **Awaiting bank transfer verification**, with enrolment withheld until approval.
- One student email uses subject **Complete your Sīrah registration** and button **Complete my payment**. Its 256-bit random bearer link expires after 72 hours, contains no personal details, and opens the existing registration. Token hashes are stored separately; the mail outbox necessarily retains the delivery payload. Treat mail payloads as sensitive.
- The token is in the URL fragment, is removed before exchange, and becomes an HttpOnly, SameSite=Lax cookie (Secure in production). It grants access only to its registration, not the general account, dashboard or other orders. It does not grant course access. Normal sign-in remains supported.
- Refresh/retry does not enqueue the first email again. A fresh-link request is generic to avoid email enumeration and deduplicated to one email per registration/hour. Paid registrations do not receive payment reminders; opening a valid older link after payment shows the existing confirmation.
- Name and phone can be corrected on the same unpaid order. Residence/plan/method use the existing revision-checked repricing. Account email changes require account verification/support; the payment link cannot change the account email.

## Deployment

Apply the additive migration **before deploying this branch** against the production database, using the existing App Platform runtime `DATABASE_URL`:

```sh
npm run prisma:migrate:deploy
```

New migration: `202611070002_sirah_payment_resume` creates only `SirahResumeLink`; it does not change recorded prices, payments, or older-batch records. Generate Prisma Client during build (existing `postinstall`). The registration readiness check intentionally requires the new table. Do not deploy the code ahead of the migration.

No new secret/environment variable is required for resume links. Existing mail settings must be valid:

- `RESEND_API_KEY`
- `EMAIL_FROM` (verified sending domain/address)
- `NEXT_PUBLIC_APP_URL=https://tga-awakening.com`
- `ADMIN_NOTIFICATION_EMAIL` for staff notices, where desired

Existing Sīrah maintenance/admin notification retries continue to process the durable outbox. Email delivery was intercepted/disabled during local tests; real production sending configuration and delivery still require verification.

## Verification

- 30 isolated MySQL workflow tests pass, including expiring token resolution, tampering rejection, same-order reuse, email deduplication, paid reminder suppression and method-specific pricing.
- Browser checks at 390 px and 1440 px: regional/plan changes, inline methods, registration saving, refresh, scoped email-link return, denial of other orders/general order listing, correction of saved contact details, manual submission, admin approval, paid-link return and expired-link recovery. No horizontal page overflow.
- Existing payment verification tests exercise signed webhooks, duplicate events and provider retries with synthetic provider responses; they do not constitute real Stripe end-to-end delivery.
- Screenshots: `combined-390.png`, `combined-1440.png`, `combined-confirmed-390.png`. Synthetic local configuration/terms only. The mobile form scrolls internally to its payment section.

## Live payment status — checked 7 November 2026

The dedicated live Sīrah Stripe account reports charges and payouts enabled. Production pricing still reports `cardAvailable: false` and no approved terms for Pakistan monthly, UK monthly and UK upfront. No live funds were charged and no approval flags were changed.

Actual sandbox evidence so far: PKR 3,000 first subscription invoice paid; monthly and PKR 32,400 one-time Checkout sessions created. Annual settlement, monthly renewal and signed webhook delivery through the TGA app are still unverified. The connected execution environment has no injected App Platform/production database credentials or sandbox app runtime, so production migration and configuration could not be applied from here.

Finance explicitly left course tax classification, collection jurisdictions and inclusive/exclusive fee treatment pending. Sandbox prices remain `unspecified`, product tax code absent and automatic tax off. Live approval must wait for finance and the remaining provider tests. The current payment verifier expects exact base amounts; tax-added live charging will require verified subtotal/tax/gross accounting before it can be enabled.
