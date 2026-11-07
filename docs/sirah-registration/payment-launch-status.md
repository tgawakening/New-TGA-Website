# Sīrah registration-first launch

Registration remains open without approved payment methods. Students can save one pending registration, receive its secure payment-resume email and return to the same record. An unavailable payment route cannot take payment or grant enrolment. The saved page now explicitly says **Payment pending**. Existing sign-in, account creation, method-specific server prices and private receipt submission remain in the shared form.

## Route status

| Audience / option                  | Current status                                     | Required before collection                                                                                                                       |
| ---------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Pakistan bank transfer             | Disabled; receiving account is not marked verified | TGA approval of the receiving account, plan terms and tax treatment. Payment evidence remains pending until a staff member verifies receipt.     |
| Pakistan PayPal                    | Hidden for both plans                              | Deliberately unavailable for Pakistan.                                                                                                           |
| Pakistan Stripe monthly, PKR 3,000 | Disabled                                           | Real initial payment and test-clock renewal, signed app webhook/enrolment checks, approved monthly terms and tax treatment.                      |
| Stripe upfront                     | Disabled                                           | Provider-only PKR 32,400 sandbox payment succeeded without a subscription; app webhook/enrolment verification and live approvals remain pending. |
| International PayPal upfront       | Disabled                                           | Uses the existing Orders/Capture flow. Sīrah merchant ID/webhook configuration, real payment tests and annual terms/tax approval remain missing. |
| UK PayPal monthly                  | Disabled                                           | Validated plan under the Sīrah product, merchant/webhook setup, subscription settlement tests and monthly terms/tax approval.                    |

The existing sandbox and live-approval gates are unchanged. No testing waiver or placeholder policy is installed. Older-batch PayPal variables, plans and routes are unchanged.

## PayPal plan inspection

Read-only production inspection authenticated with the existing TGA PayPal credentials:

- Requested plan `P-41P7163096581714RNLXSPAA`: ACTIVE; GBP 29.99, one monthly interval, 12 regular cycles, no setup fee and no plan tax.
- Product `PROD-4MG49974LK7417127`: Sīrah | Beyond Chronology.
- The plan has `auto_bill_outstanding=true`. The new Sīrah flow uses `false`, with a failure threshold of one and exact single-instalment verification.
- Therefore this plan must not be reused as-is for this flow. It is not modified. A fully matching configured `SIRAH_PAYPAL_MONTHLY_PLAN_GBP` can be reused; otherwise checkout creates a separate matching plan under `SIRAH_PAYPAL_PRODUCT_ID`, only after existing route approvals permit checkout.
- Reuse validates ACTIVE status, product, amount, currency, twelve monthly regular cycles, no adjustable quantity, no setup fee, no extra plan tax and compatible collection settings.
- The Sīrah merchant/product/webhook settings were absent at the initial inspection. A separate Sīrah webhook destination and the verified product/preferred-plan references are now configured; none of these metadata settings enable a payment route. The API credentials authenticate, but the expected merchant-ID check is not complete. OAuth user info exposed only opaque subject identifiers; these are not substituted for the business Merchant ID.

Annual Orders retain both checks: the approved order must match merchant, quote currency and amount **before capture**, then the completed capture is re-read and verified before enrolment. Altered approved orders are rejected without capturing funds.

## Approvals needed from TGA

1. **Receiving account:** confirm the existing Meezan beneficiary/account/IBAN are approved for this Sīrah batch, identify the receipt-verifying staff and approve any transfer-fee instructions. Confirming the PKR 3,500 manual monthly fee alone does not verify a receiving account.
2. **Annual terms first:** refund window, eligibility/exclusions, full/partial refund calculation, access start/end and recordings duration; what happens to access after a refund. Annual payment is once for twelve months, without monthly rebilling.
3. **Monthly terms:** free-to-stop payments versus a twelve-instalment obligation; cancellation timing; access after failed payment; refund eligibility; whether refunds end access and future billing. The guide explicitly flags the current after-14-days policy conflict, so it is not silently inherited.
4. **Tax:** correct classification for the actual teaching/materials supplied, registered collection countries/states and whether published regional fees include tax, have tax added, or are not taxable under TGA's approved treatment. Tax-added settlement requires subtotal/tax/gross verification changes and testing before activation.
5. **PayPal:** expected business Merchant ID, obtainable from PayPal business account information. This is not an API secret. The product ID above is already known. A dedicated signed Sīrah webhook must be configured and tested.
6. **Test access:** add the Sīrah Stripe sandbox API key as encrypted `SIRAH_SANDBOX_STRIPE_SECRET_KEY`; supply PayPal sandbox app/buyer access through secure configuration for genuine Orders/subscription/webhook tests. Keep production PayPal credentials and live Stripe variables unchanged.

## Test-clock command

`scripts/check-sirah-sandbox-renewal.ts` refuses live keys and a mismatched account, requires tagged synthetic customer/subscription/clock ownership, verifies the already paid first PKR 3,000 invoice and advances the clock into one renewal. It verifies a paid PKR 3,000 cycle invoice. Re-running after a paid renewal does not advance another month. It does not change approval flags or claim app webhook/enrolment verification.

```sh
npm run sirah:stripe:sandbox:renewal -- --clock clock_1UZ960LHDrdNH91BlEyKX9G8 --subscription sub_1UZ9LmLHDrdNH91Bozi1wgfi
```

Requires the encrypted test key and `SIRAH_SANDBOX_STRIPE_ACCOUNT_ID=acct_1UYuZsLHDrdNH91B` in the isolated runner. A provider-only renewal is insufficient to enable production by itself.

The signed `CHECKOUT.ORDER.APPROVED` event now invokes the same quote-checked, idempotent capture path used on browser return. Duplicate approval delivery cannot create another capture or enrolment. Suspended subscriptions are re-read at PayPal before applying the existing failed-payment/access policy.

Sīrah PayPal webhook: `https://www.tga-awakening.com/api/sirah/webhooks/paypal`, ID `8P300895YB677700G`. Event delivery and a genuine payment have not been verified end to end. The Stripe/PayPal currency whitelists, live approval and manual-account approval are not enabled by this rollout.

Validation: 35 isolated MySQL workflow tests passed, including mismatched approved quotes rejected before capture, preferred-plan compatibility, Pakistan PayPal exclusion and duplicate signed-approval delivery producing one enrolment. Provider responses in those integration tests are synthetic. Real Stripe upfront provider payment is separately verified; its app webhook/enrolment status remains pending.
