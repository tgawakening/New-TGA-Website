# Sīrah Beyond Chronology registration workflow

This update adds the current 12-month programme alongside the existing student, authentication and historical payment systems. It does not migrate or reprice old student contracts. The stable course slug remains `seerah-course`; the new batch is `beyond-chronology-2026` and its catalogue version is `sirah-2026-11-02-v1`.

## Student experience

- The hero, fee cards, closing section and mobile action open an accessible native registration dialog. `/seerah/register` uses the same form and endpoints. The old inline popup is retained only for an authenticated, owned historical `?resume=` order.
- New registration creates an account through the existing bcrypt/session system, or reuses the signed-in account. An existing anonymous email is directed to sign in. No passwords are persisted in browser storage, notification payloads, receipts, exports or payment metadata. The historical form also strips passwords from saved browser state.
- Registration records an unpaid application. It does not claim payment, confirmed enrolment, or phone/WhatsApp ownership verification. A normalized phone is validated on both client and server using `libphonenumber-js/max`; phone country and editable billing country are separate. Shared `+1` countries require explicit selection.
- Billing country, plan and method are repriced on the server before checkout. The browser cannot supply payable amounts, currency or payment status. Locked current orders contain integer minor units, market, plan, method, pricing version, batch and approved terms snapshot. In-flight or settled amounts cannot be edited.
- Manual evidence is uploaded privately or matched through the supplied payment-support WhatsApp contact. Reference remarks include `SIRAH BEYOND CHRONOLOGY` and the unique registration reference. The support contact is not a payment account or course-group invitation.
- Receipt submission means **awaiting admin review**. Rejection includes the reason and resubmission instructions. Original evidence versions remain attached to their audit history. Course-group links are absent from unpaid/pending responses and public bundles.
- Payment and enrolment are shown separately. After verification, the authenticated confirmation endpoint returns the assigned invitation or “Your course group invitation will follow.” Signed-in students can manage a provider billing profile or request cancellation according to the approved terms.

## Prices and compatibility

`lib/sirah/catalog.ts` is the authoritative shared fixed-price source, transcribed from the client's SIRAH Website Pricing Team Guide of 2 November 2026. The landing-page display, new registration, payment creation, admin and notifications use it or the order's locked snapshot. All 18 configured markets and the GBP fallback are included. The Eurozone list is explicit; the UAE and other unconfigured countries use GBP 29.99 monthly / GBP 323.89 annual. No live FX, local estimate or stacked discount is invented.

Money is parsed with integer/BigInt arithmetic. BHD and KWD use three decimal places; PayPal's HUF amount conversion is handled separately. Unsupported PayPal currencies and unverified provider/plan/currency combinations are hidden. Pakistan online monthly is PKR 3,000 only after the recurring route is verified; otherwise the manual monthly rate is PKR 3,500. Annual is PKR 32,400 irrespective of the manual monthly rate. Monthly 12-payment totals are comparisons, not invented commitment terms.

The original eight-month calculation and agreed amounts remain in legacy services and authenticated historical resumptions. The historical route quotes the original snapshot, blocks changing its country/plan/method/discount, and does not recalculate it from the new catalogue. Incomplete historical pricing metadata is referred for support review instead of inventing a replacement quote. Old scholarship and unrelated-course flows remain under their existing processes; there is no automatic assignment of a new-batch paid invitation to them.

New applications are stored as `SirahOrder` before any method is selected, so no fake payment method or completed sale is created. A canonical `Registration`/`Payment` and eligible `Enrollment` are created on verified settlement. An earlier enrolment for the same stable course is preserved; current-batch access also checks its own order. New batch financial rows are excluded from legacy revenue screens rather than mixing minor-unit conventions or converting currencies without an approved FX source. The dedicated admin section is the source of truth for current-batch payments and refunds; historical records remain available read-only by the stable course slug.

## Verification, billing and notifications

Stripe reuses the existing signed `/api/payments/stripe/webhook`, dispatching current-batch metadata to the new verifier before legacy handling. Server-return verification checks merchant identity, session/order ownership, locked amount/currency, billing mode and actual paid settlement. An annual purchase creates no subscription. Monthly Stripe subscriptions receive a calendar-clamped cancellation boundary at 12 months. Renewal invoices are individually verified and recorded against the same order; a thirteenth payment is rejected for reconciliation.

PayPal uses the existing credentials and API environment, with a new signature-verified `/api/sirah/webhooks/paypal` endpoint. It verifies the merchant on annual orders and requires matching order/subscription identifiers, amount, currency and completed captures/transactions. Subscription approval or `ACTIVE` status alone never grants access. Monthly plans have exactly 12 regular billing cycles. PayPal monthly billing stays inactive for policies requiring a future period-end provider cancellation that this integration cannot guarantee.

Financial ledger identities use settled payment IDs, not browser return parameters or only webhook IDs. Serializable transactions and unique ledger/outbox keys protect confirmation and manual approval against retries and concurrent admins. A late payment is recorded without reactivating a cancelled order. A verified refund received before its settlement record is held for reconciliation without releasing a group invitation. Provider refunds update the financial ledger only after actual verification; manual refunds require the real transaction reference. Course completion does not mark payment paid.

The approved terms include explicit cancellation timing, failed-payment access behaviour, refund access behaviour and whether a refund stops subsequent billing. No production policy values are filled in. Provider cancellation failures after a verified refund remain a persisted billing-follow-up notification and are retried by maintenance.

The existing Resend delivery function and admin recipients are reused. `SirahNotification` is a persistent, uniquely keyed outbox, while `EmailLog` retains delivery logs. It covers unpaid registration, submitted evidence, rejection, confirmed payment, renewal/failure, cancellation/refund, completion and missing invitations. Failed delivery does not roll back payment or enrolment. The admin retry action skips successful sends; provider idempotency keys protect retries. Ambiguous delivery beyond the provider idempotency window is marked `DELIVERY_UNKNOWN` for reconciliation rather than silently sending a duplicate. Missing admin recipients are resolved once configuration is supplied. Pending group invitations are queued once their regional configuration becomes available. Queued group-bearing messages recheck current access and regional mapping before dispatch, so a refund or suspension can withhold an unsent invitation.

## Admin and storage

`/admin/sirah`, linked from the existing admin dashboard, preserves the current signed admin session / API-token access model. It supports search, separate payment/enrolment filters, pagination, per-page CSV export, private receipt download, ledger and audit history, verified manual approval, rejection, cancellation, course completion, verified refunds, provider reconciliation and notification retry. Admin record links select the actual order. Financial approval requires the expected revision, independently verified amount/currency and transfer reference. Online payments cannot be marked paid through the older cosmetic status action. CSV cells are escaped against formula injection.

No working private file storage or server-side Google Drive integration was present. Receipt bytes are therefore stored in the existing private MySQL database as `SirahReceipt` rows, not in `/public` or public Drive folders. Uploads are limited to 4 MiB plus a bounded multipart envelope, detected by actual content, decoded/parsed as JPG, PNG or PDF, and downloaded as authenticated attachments with no-store, nosniff and sandbox headers. Student ownership or existing admin authorization is checked on every download. Google Drive mirroring is deliberately not a dependency.

## Migration and deployment

Apply `prisma/migrations/202611070001_sirah_registration_workflow/migration.sql` through the normal Prisma migration process before running this branch against a production database:

```sh
npm ci
npx prisma migrate deploy
npm run build
```

The migration creates five additive tables (`SirahOrder`, `SirahReceipt`, `SirahAudit`, `SirahPaymentEvent`, `SirahNotification`) and their foreign keys; it does not rewrite existing amounts or receipts. Use the actual SQL/table list as authoritative. Back up production normally before a schema deployment. Do not run the destructive test fixture against production; its guard only permits `127.0.0.1` and database `sirah_test`.

Schedule the existing authenticated `POST /api/internal/subscriptions/process-renewals` endpoint at least daily, using the existing `ADMIN_API_TOKEN` bearer/header mechanism. It now also enforces current programme/access boundaries, retries refund billing cancellation and notification delivery, sends manual renewal reminders and releases newly configured invitations. Stripe and PayPal have provider-side 12-month/12-cycle limits; the maintenance job is still required for reminders, pending tasks and manual access transitions. Authentication also checks access expiry even between maintenance runs.

## Required configuration and unresolved decisions

Existing server settings are reused: `DATABASE_URL`, `NEXT_PUBLIC_APP_URL`, Stripe/PayPal credentials, `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_NOTIFICATION_EMAIL`, admin dashboard credentials/secret and `ADMIN_API_TOKEN`. None of the host's production credentials were available in this session, so actual provider sandbox and delivery tests need those connections. Do not replace existing production secrets with test fixtures.

New settings are documented as empty/disabled fields in `.env.example`:

| Setting | Required decision / value |
| --- | --- |
| `SIRAH_MONTHLY_TERMS_JSON`, `SIRAH_ANNUAL_TERMS_JSON` | Approved JSON fields: `version`, `commitment`, `cancellation`, `refund`, `access`, `tax`; plus `cancellationTiming` (`IMMEDIATE` / `PERIOD_END`), `failedPaymentAccess` (`KEEP` / `PAUSE`), `refundAccess` (`KEEP` / `REVOKE`), and `refundBilling` (`CANCEL` / `CONTINUE`). Values are not invented. |
| `SIRAH_MANUAL_ACCOUNTS_VERIFIED` | Finance confirmation of the existing Meezan/JazzCash details. Existing account holder/number/IBAN were found in the previous registration source and are preserved behind this gate. |
| `SIRAH_MEEZAN_*`, `SIRAH_JAZZCASH_*` | Optional server overrides if finance supplies corrected account details. The proof-submission WhatsApp number must not be substituted for the JazzCash wallet number. |
| `SIRAH_STRIPE_ACCOUNT_ID` and `SIRAH_STRIPE_MONTHLY_CURRENCIES`, `SIRAH_STRIPE_ANNUAL_CURRENCIES` | Verified merchant account and explicitly tested presentment currencies for each plan. |
| `SIRAH_PK_RECURRING_VERIFIED` | Confirmation that the intended Pakistan recurring card route works. Off by default. |
| `SIRAH_PAYPAL_MERCHANT_ID`, `SIRAH_PAYPAL_WEBHOOK_ID`, `SIRAH_PAYPAL_PRODUCT_ID` | Verified merchant, configured webhook, and monthly product. Existing PayPal client credentials/environment remain in use. |
| `SIRAH_PAYPAL_MONTHLY_CURRENCIES`, `SIRAH_PAYPAL_ANNUAL_CURRENCIES` | Explicitly tested provider-supported currencies for each plan. Unsupported catalogue currencies stay hidden. |
| `SIRAH_LIVE_PAYMENTS_APPROVED` | Explicit live activation after configured terms and successful sandbox checks. Off by default. |
| `SIRAH_SUPPLIED_GROUP_URL`, `SIRAH_SUPPLIED_GROUP_AUDIENCE` | The user-supplied invitation is held only in a git-ignored local server setting, without a regional assignment. Its audience must be confirmed as `PAKISTAN` or `INTERNATIONAL`, then configured securely on the host. It is not committed in this public repository. |
| `SIRAH_PAKISTAN_GROUP_URL`, `SIRAH_INTERNATIONAL_GROUP_URL` | Independent regional overrides. The international invitation is still awaiting supply. Missing invitations do not reverse a verified enrolment. |
| Optional Drive mirror | No server integration existed. A future private mirror would need a server credential, folder identifier and restricted service-account access. The database upload flow works independently. |

## Validation and changed-file summary

- Additive migrations applied successfully to a fresh, isolated MySQL 8.4 test database.
- `npm run test:seerah`: all 4 existing campaign/currency/analytics regression tests passed.
- `npm run test:sirah-workflow`: all 23 real-MySQL workflow tests passed on Node 22, with controlled Stripe/PayPal protocol responses and real Stripe signature verification. They cover phone mismatch/shared-prefix validation, catalogue precision/fallbacks, browser tampering, signed-in reuse, concurrent manual approval, private receipt validation and replacement, provider success/pending/duplicates, twelve-payment boundaries, cancellation/refund, missing invitations, failed-email retry, historical price preservation and out-of-order settlement/refund handling.
- Browser checks cover 360, 390, 768, 1024 and 1440 px, modal focus restoration, scroll/overflow, accessible controls, actual HTTP registration/manual submission/admin approval, protected download, pending invitation, dashboard and existing-account sign-in.
- Actual gateway sandbox charges, recurring second charges for every enabled currency and live Resend delivery have not been performed because corresponding credentials/configuration were unavailable. Controlled protocol tests are not represented as real sandbox transactions.
- `npm run lint`, TypeScript checking (`npx tsc --noEmit`) and `npm run build` passed. Production migrations, payment activation and deployment are separate from the repository implementation.

Main changes: `lib/sirah/*` (catalogue, phone, terms/route configuration, validators and auth helpers); `services/sirah-*` (registration, financial verification, receipts, notifications, admin and maintenance); `/api/sirah/*` and `/api/admin/sirah/*`; shared `components/sirah/*`; standalone `/seerah/register`; landing-page registration actions; admin/student dashboard links; legacy compatibility guards; Resend idempotency support; additive Prisma schema/migration; configuration template and workflow tests.

Registration previews: [mobile](sirah-registration/registration-390.png) and [desktop](sirah-registration/registration-1440.png). These show the initial empty form, with no customer data.
