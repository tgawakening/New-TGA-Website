# Sīrah card and wallet availability — production inspection, 9 November 2026

DigitalOcean reports ACTIVE deployment `ed716f56-eefd-4277-8219-abf8fd73f067`,
serving main `53166182b1912b42abf7790a5c236023cc9ffbe5`. The public registration
page and session endpoint independently report the same source revision.

Read-only Stripe inspection confirmed that the configured merchant matches the
runtime account and can accept charges. Card, Google Pay and Apple Pay are available
and switched on in the live payment-method configuration referenced by recent
Sīrah Checkout Sessions. Those sessions use card/Link; card-backed wallets are not
separate `payment_method_types`. There is no checkout-level Google Pay exclusion
in the inspected integration. Automatic tax is disabled in those sessions, so its
shipping-address filtering is not the reason wallets are missing there.

Stripe explicitly states that live Google Pay is not displayed to customers with
IP addresses in India; Apple Pay is also suppressed for Indian IP addresses. See
https://docs.stripe.com/google-pay?platform=web and
https://docs.stripe.com/testing/wallets?ui=checkout . Elsewhere, supported device,
browser, region and saved-card eligibility still determine rendering. A Google Pay
app used only for UPI does not establish eligibility for this card-wallet checkout.
No claim is made that every student can see or use either wallet.

In the inspected three-day sample, four Stripe payments succeeded and four orders
were PAID/ACTIVE. Bank declines included transaction_not_allowed, do_not_honor and
insufficient-funds reasons. No successful wallet-backed charge was observed in that
sample. This audit did not create any payment, Checkout Session, subscription,
registration or email, and did not change merchant settings, categories or flags.
The earlier Al Hilal restriction remains an issuer/support matter, not something
this label change can override.

This PR updates the registration payment option and saved-order action to mention
debit/credit cards, Google Pay and Apple Pay, with an eligibility explanation. The
compact option keeps wallet wording in the secondary line for mobile readability.
It does not replace Stripe-hosted Checkout or alter settlement verification,
automatic enrolment, prices or payment-route approval. No environment change or
migration is required for this PR.

Validation: full lint, TypeScript and production build; browser rendering at 390,
768 and 1350 px, including no horizontal overflow. Local preview used the existing
production public pricing responses read-only. A real eligible personal wallet was
not available in the automated browser, so wallet-button rendering or a genuine
wallet transaction has not been certified by this inspection.
