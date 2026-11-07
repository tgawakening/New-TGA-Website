# Dedicated Sīrah card payments

The new Sīrah batch uses a dedicated Stripe client and signing secret. The older
batch and mission-support routes still use their existing global Stripe keys.
If new-account credentials were placed into those global variables, restore the
older account there and put the new account in the SIRAH-prefixed variables below.
No secret values should be sent in chat, screenshots or logs.

## Exact webhook settings

Public URL: **https://tga-awakening.com/api/sirah/stripe/webhook**

In the new Stripe account's sandbox, create a webhook destination for **events
from your account**, using **Snapshot** events (JSON, not thin events). Select API
version **2026-02-25.clover**, matching the installed Stripe SDK. Select:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `refund.created`
- `refund.updated`

The signing-secret variable is **SIRAH_STRIPE_WEBHOOK_SECRET**. Use the sandbox
endpoint's own signing secret; a CLI-forwarding secret or the older batch's
signing secret is different. The old route
`/api/payments/stripe/webhook` is preserved for the previous integration.

## App Platform variables (server-side, runtime)

| Variable | Value / role |
| --- | --- |
| `SIRAH_STRIPE_SECRET_KEY` | New Sīrah account's sandbox secret API key during verification |
| `SIRAH_STRIPE_WEBHOOK_SECRET` | Signing secret for the new URL in that same sandbox |
| `SIRAH_STRIPE_ACCOUNT_ID` | Expected new merchant `acct_…` identifier; verified against Stripe |
| `SIRAH_STRIPE_MONTHLY_CURRENCIES` | Comma-separated approved/tested charge currencies for subscriptions |
| `SIRAH_STRIPE_ANNUAL_CURRENCIES` | Comma-separated approved/tested charge currencies for annual payments |
| `SIRAH_STRIPE_SANDBOX_VERIFIED` | Keep `false` until BOTH plans and signed webhook delivery pass real sandbox tests |
| `SIRAH_LIVE_PAYMENTS_APPROVED` | Keep `false` until sandbox evidence and finance approval are complete |
| `SIRAH_PK_RECURRING_VERIFIED` | Keep `false` until PKR monthly first-charge and renewal are verified |
| `NEXT_PUBLIC_APP_URL` | `https://tga-awakening.com` for customer return links |
| `SIRAH_MONTHLY_TERMS_JSON` | Final approved monthly payment terms; existing approval gate remains |
| `SIRAH_ANNUAL_TERMS_JSON` | Final approved annual payment terms; existing approval gate remains |
| `SIRAH_MANUAL_ACCOUNTS_VERIFIED` | Only `true` after finance verifies the existing manual accounts |

There is **no required publishable-key variable for this hosted Checkout flow**.
The browser receives only the server-created Checkout URL. Never add secret or
signing keys to a `NEXT_PUBLIC_…` variable. Legacy `STRIPE_SECRET_KEY` and
`STRIPE_WEBHOOK_SECRET` remain assigned to the older account.

Monthly Checkout uses `mode: subscription` and a monthly recurring price.
Annual Checkout uses `mode: payment`, charges the fixed annual amount once, and
never creates a subscription. Both accept debit/credit cards; students do not
need a Stripe account. No approved manual route is advertised outside its
allowed market. Pakistan transfer/JazzCash evidence stays pending until a TGA
admin verifies the receipt and records approval.

## Inspect account and test/live mode without revealing credentials

In the App Platform web component's console, run:

```
npm run sirah:stripe:check
```

This contacts Stripe and prints only merchant account ID, account-match boolean,
actual sandbox/live mode, charge readiness and configuration/approval booleans.
It prints no keys. While signed into TGA admin, the same check is available at
`/api/admin/sirah/stripe` (unauthenticated requests are denied).

The current connected tools do not expose App Platform runtime secrets or an
App Platform execution console. Adding secrets in DigitalOcean does not copy
those secrets to the coding workspace. Real account/mode verification and real
sandbox charges cannot be claimed from synthetic local provider tests.

## Required real sandbox checks before live activation

Use the dedicated sandbox credentials, approved test-environment terms and only
currencies approved for that merchant. Test cards belong only in Stripe's hosted
sandbox Checkout; do not collect or store card details in TGA.

1. Monthly: complete Checkout with a Stripe test card. Confirm subscription mode,
   exact country/currency amount and an initial paid invoice. Confirm the signed
   webhook returns 2xx and enrolment activates once, after Stripe settlement.
2. Renew the monthly subscription with Stripe's test-clock/sandbox tooling.
   Confirm a new paid invoice is recorded once and the existing 12-payment cap
   prevents a thirteenth payment. For PKR, verify PKR 3,000 and its renewal before
   enabling `SIRAH_PK_RECURRING_VERIFIED`.
3. Annual: complete a separate annual Checkout. Confirm one payment at the fixed
   discounted catalogue amount, no subscription and verified enrolment.
4. Redeliver the signed events: no duplicate payment, enrolment or notification.
   A modified body or invalid signature must fail. An unpaid/failed Checkout or
   a successful browser redirect alone must not activate enrolment.
5. Test failed/cancelled payment and a manual Pakistan transfer. Manual monthly
   remains PKR 3,500 (PKR 42,000 across 12 months), with receipt review required;
   verified automatic monthly is PKR 3,000 (PKR 36,000 across 12 months).
6. Keep an evidence record, then explicitly approve live mode. Install the new
   account's LIVE secret and LIVE endpoint signing secret before live activation;
   test and live credentials/signatures cannot be mixed. Do not enable either
   approval flag solely because keys have been entered.

## Registration refinements

Direct entry opens the same retained popup over the Sīrah landing page. Close,
Escape and outside clicks return to the landing view. Password visibility,
cryptographic strong-password suggestions, live strength/match feedback and
browser-password-manager saving use memory/native browser capabilities; the
app never writes plaintext passwords to browser storage or payment data.
Browser password-saving UI is controlled by the browser. The save option is
available once the account exists, including while course payment is pending;
it does not imply enrolment is paid.

Phone and residence flags are locally hosted PNGs from flagcdn.com, with AC/TA SVGs from the MIT-licensed country-flag-icons project (license included beside the assets). International
numbers pasted/autofilled into the phone field are normalized to a single visible
calling code and national number. Choosing a phone country updates the residence
suggestion and fees immediately, then requires residence confirmation. Students
can correct residence independently; a country hint never overrides their choice.
Annual registration shows the same 12-online-month comparison and fixed upfront
saving as the landing page. Unverified PK recurring pricing remains unavailable.
