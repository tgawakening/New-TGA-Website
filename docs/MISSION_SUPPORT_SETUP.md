# Support Our Mission: staging and launch

This site is Next.js, so the contribution flow uses the existing Stripe SDK rather than a WordPress/GiveWP plugin. The page and checkout support GBP, one-time and monthly contributions, five preset amounts plus a custom amount, and three funding preferences plus general support. The preference is stored in the database and Stripe metadata, shown in acknowledgments, and visible in the admin dashboard. A selected preference does not establish a legally restricted fund; the page directs donors to agree specific restrictions with TGA. Existing purpose identifiers remain supported for previous records and saved selections.

## Content and approval

The donor-facing entity is **GLOBAL AWAKENING CIC**, company **15523255**, registered in England and Wales. Its registered office is 128 City Road, London, EC1V 2NX. Verify changes against the [official company record](https://find-and-update.company-information.service.gov.uk/company/15523255). This page does not claim registered-charity status or offer Gift Aid.

The page uses five original SVG illustrations in `public/images/mission/`, generated reproducibly by `node scripts/create-mission-art.mjs`. They are conceptual learning illustrations, not evidence of programme delivery. No classroom photographs, beneficiary quotations, funding targets, cost-per-child figures, impact totals or independently audited claims have been invented. The earlier hero-image environment settings remain reserved; this refinement uses the dedicated SVG assets. Obtain approval and necessary permissions before replacing them with photographs of children.

Before enabling checkout, TGA must approve and publish contribution terms covering purpose restrictions, use of surplus, operational costs, refunds and recurring cancellation. Set `MISSION_SUPPORT_POLICY_URL` to that HTTPS page and `MISSION_SUPPORT_ALLOCATION_NOTICE` to its approved, concise allocation explanation. Do not use an existing course purchase policy as a substitute. An approved HTTPS impact report can be added with `MISSION_SUPPORT_IMPACT_REPORT_URL`.

## Separate staging configuration

Keep production payment flags disabled while validating the preview. Configure secrets through deployment environment settings or an untracked `.env.local`; do not commit them or send them in chat.

1. Provision an isolated MySQL test database. Set `DATABASE_URL` to that database. Check the resolved hostname and database name before running migrations; never use a production database for staging tests.
2. Run `npm ci`, `npm run prisma:generate`, and `npm run prisma:migrate:deploy` against the isolated database. The added migration preserves existing contribution records and adds recurring identifiers, purpose, individual payment/refund records and webhook deduplication.
3. Set `NEXT_PUBLIC_APP_URL` to the actual HTTPS preview origin. Set real Stripe **test-mode** `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`. Configure `MISSION_SUPPORT_MANAGEMENT_SECRET` with at least 32 cryptographically random characters. Replacing it invalidates previously issued management links.
4. Configure Resend with a verified sender using `RESEND_API_KEY` and `EMAIL_FROM`. Set `ADMIN_NOTIFICATION_EMAIL` for the team. Confirm delivery and check email logs for failures; successful payment records do not become unpaid when email delivery fails.
5. Publish the approved terms and allocation notice described above. Set `MISSION_SUPPORT_PAYMENTS_ENABLED=true` in staging only; leave `MISSION_SUPPORT_LIVE_APPROVED=false`. Example or missing credentials keep checkout disabled.
6. Configure Stripe Checkout branding to match TGA. Configure the Stripe Billing Portal to permit payment-method updates and subscription cancellation. Optionally set `MISSION_SUPPORT_PORTAL_CONFIGURATION_ID` to that configuration. Enable Stripe receipts as appropriate. Check wallet availability in the actual Stripe account and supported browser; no unsupported payment method is advertised.

The webhook endpoint is `/api/payments/stripe/webhook`. Register these events in the same Stripe mode as the checkout key:

- `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`
- `invoice.paid`, `invoice.payment_failed`
- `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
- `charge.refunded`

The endpoint verifies Stripe's signature using the raw request body. A browser success URL alone never confirms payment. Monthly checkout completion does not count as income; confirmed invoices create individual payment entries. Repeated payment events do not create duplicate income or acknowledgments. Subscription events retrieve current provider state to handle delayed deliveries.

## Required Stripe test-mode walkthrough

Local automated tests use a fake provider and in-memory database. They cover validation, exact GBP amounts, purpose metadata, checkout idempotency logic, signature verification, recurring invoices, delayed/duplicate events, cancellation and refunds. They do **not** replace this walkthrough with a real staging database and Stripe test account:

- Complete one-time and monthly contributions for all four purposes, including a custom amount. Check Stripe metadata, database records, the admin dashboard, donor acknowledgments and team notifications.
- Test approved/declined cards, authentication, an abandoned checkout, cancellation and a failed network request followed by retry. Confirm no unpaid payment is reported as received.
- Replay webhook events and deliver invoice events before checkout events. Confirm one ledger entry per payment and correct renewal totals.
- Use Stripe test clocks to exercise a subsequent monthly invoice and a failed invoice followed by recovery. Confirm separate payment history and the actual provider subscription state.
- Open the secure management link from an acknowledgment; update the payment method and cancel future payments. Verify the correct effective cancellation date. Management links expire after one year; the team can assist if a link has expired.
- Request a refund using the authenticated admin payment-history action. It refunds the remaining eligible amount to the original Stripe payment method. Verify `charge.refunded` updates the ledger and net income. Partial refunds can be requested through the authenticated refund endpoint by passing an integer amount in pence. A requested refund is not displayed as completed before provider confirmation.
- Test donor and admin email delivery failures and recovery operationally. Failed messages are retained in email logs; there is no automatic email retry worker. Stripe payment receipts remain separately available through the provider.
- Check the preview on desktop/mobile, keyboard navigation, reduced motion, a narrow screen, form errors and the secure checkout return. Verify no management token is shared: this page sets a no-referrer policy and management URLs should be treated as private access links.

Run `npm run test:mission-support` and `npm run check` before release. This checkout is card-based and collects no card data inside the TGA application.

## Production release

After the staging walkthrough and TGA's content/terms approval, configure production-specific database, Stripe live keys, live webhook endpoint, verified email sender, live Billing Portal and the correct production origin. Apply the additive migration to the verified production database through the normal release procedure. Set both `MISSION_SUPPORT_PAYMENTS_ENABLED=true` and `MISSION_SUPPORT_LIVE_APPROVED=true` only after the launch checklist is complete. Perform an authorised small live contribution and refund, and monitor webhook delivery and email logs.

The page can be reviewed with payments disabled. Publishing a preview does not activate a provider, migrate a production database or approve a funding policy. Existing course payment flows continue using their existing integration; the new mission handler processes only mission contributions.
