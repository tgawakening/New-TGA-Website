# LMS Phase 2: Stripe + PayPal + Manual Payment Review

## What is implemented
- Stripe checkout session creation endpoint
- Stripe webhook endpoint to mark payment paid and activate enrollment
- PayPal order creation endpoint for one-time payments only
- PayPal order capture endpoint for one-time payments only
- Manual payment submit endpoint (Pakistan only)
- Admin manual payment review endpoints (confirm/reject)
- Dashboard now shows latest payment method/status/reference
- Admin review page for manual payments
- Registration now lets students choose between monthly subscription and one-time full course payment
- Full course price is calculated dynamically as `monthly price x 8 months`
- Payment plan selection is stored on registrations and drives Stripe/PayPal/manual charge amounts

## Key files
- `services/payment.service.ts`: payment orchestration and status transitions
- `app/api/payments/stripe/create-checkout/route.ts`
- `app/api/payments/stripe/webhook/route.ts`
- `app/api/payments/paypal/create-order/route.ts`
- `app/api/payments/paypal/capture-order/route.ts`
- `app/api/payments/manual/submit/route.ts`
- `app/api/admin/payments/manual/route.ts`
- `app/api/admin/payments/confirm/route.ts`
- `app/admin/payments/page.tsx`
- `prisma/schema.prisma` (manual submission + payment reference)

## Required environment variables
Add in `.env.local` (runtime) and `.env` (Prisma CLI):

```env
DATABASE_URL="mysql://root:password@localhost:3306/global_awakening"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

ADMIN_API_TOKEN="replace_with_long_random_admin_token"

STRIPE_SECRET_KEY="sk_test_xxx"
STRIPE_WEBHOOK_SECRET="whsec_xxx"

PAYPAL_ENV="sandbox"
PAYPAL_CLIENT_ID="paypal_client_id"
PAYPAL_CLIENT_SECRET="paypal_client_secret"
```

## Stripe setup (dashboard)
1. Go to Stripe Dashboard > Developers > API keys.
2. Copy Secret key to `STRIPE_SECRET_KEY`.
3. Create webhook endpoint URL:
   `https://your-domain.com/api/payments/stripe/webhook`
   local testing URL: `http://localhost:3000/api/payments/stripe/webhook`.
4. Subscribe to event:
   - `checkout.session.completed`
5. Copy signing secret to `STRIPE_WEBHOOK_SECRET`.

## PayPal setup
1. Go to PayPal Developer Dashboard > Apps & Credentials.
2. Create Sandbox app for testing (or Live later).
3. Copy Client ID -> `PAYPAL_CLIENT_ID`.
4. Copy Secret -> `PAYPAL_CLIENT_SECRET`.
5. Set `PAYPAL_ENV=sandbox` for test mode, `live` for production.

## Important limitation
- The Seerah registration flow is monthly/recurring, but this codebase does not yet implement PayPal Subscriptions.
- Current PayPal code uses the Orders API (`/v2/checkout/orders`) with capture, which is suitable for one-time checkout, not recurring billing.
- Stripe is the only provider currently connected to an actual recurring subscription record for course registrations.
- PayPal is now suitable for the new one-time full course payment option, but it should still remain unavailable for monthly subscriptions until the Billing Plans + Subscriptions flow is added.

## What is required before enabling recurring PayPal
1. Create a PayPal product and monthly billing plan in PayPal.
2. Replace order creation with subscription creation using PayPal's subscriptions APIs.
3. Store the PayPal `subscription_id` in `Subscription.providerSubscriptionId`.
4. Add webhook handling for subscription lifecycle events and payment events.
5. Sync renewals, failed payments, cancellations, and period dates into the local `Subscription` table.
6. Test the full buyer return flow and webhook flow in sandbox before switching to live.

## Prisma migration for Phase 2
```bash
npm run prisma:migrate:dev -- --name phase2_payments
npm run prisma:generate
```

## Prisma migration for payment plan selection
```bash
npm run prisma:migrate:deploy
npm run prisma:generate
```

- New registration field: `paymentPlanType`
- Values:
  - `SUBSCRIPTION`
  - `FULL_COURSE`

## Admin review flow
1. Open `/admin/payments`.
2. Paste `ADMIN_API_TOKEN`.
3. Click "Load Manual Payments".
4. Confirm or reject each pending submission.

## Manual payment details shown to Pakistan users
- JazzCash: Areej Fatima 03244517741
- Easypaisa: Irshad Ahmad 03326725419
- User must submit transfer reference for admin matching.
