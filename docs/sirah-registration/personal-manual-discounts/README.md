# Sponsorship choices and personal manual-payment offers

The Sīrah header's support action is now **Sponsor a Child**. It opens the existing
contribution form with learning access selected. The shared header keeps its existing
label on other pages. The purpose dropdown adds Gen-Mu’min and Sīrah | Beyond Chronology,
retains existing choices and restores the older existing-programmes/new-initiatives
choices. Purpose identifiers flow through the existing validation, provider metadata,
records and emails. Existing allocation/consumer terms and payment verification remain.
No promise of an individually assigned child or a restricted charitable fund is added.

## Email-restricted manual offer

`SirahManualDiscount` holds the configured recipient, SHA-256 code hash, cohort,
country, plan, currency and final monthly amount. The customer's personal email/code
are provisioned privately in production, not hardcoded in a browser bundle or migration.
This launch offer changes one authorised recipient's Pakistan manual monthly price from
PKR 3,500 to PKR 3,000 for the current cohort. It applies to Meezan Bank and JazzCash,
not annual upfront, Stripe, PayPal, other emails or other countries. It cannot stack
with the existing upfront discount. There is no automatic email or registration creation
when an offer is configured.

The form checks eligibility server-side and displays the code field below payment
methods for eligible Pakistan monthly applicants only. Applying a valid code recalculates
the displayed amount and receipt confirmation. Registration and owned-order repricing
resolve the fee again on the backend. Client amounts/grant IDs are not accepted. Public
responses do not expose the grant record, code hash or a recipient list. Pricing and
eligibility responses are private/no-store. Changing email invalidates the quote;
changing to an ineligible route removes the discount.

A nullable order snapshot locks the accepted discounted amount and original fee.
It survives switching between the two manual methods before payment. Staff verification
must match PKR 3,000; evidence alone never enrols the student. Later monthly renewals
retain that fee, with the existing maximum programme duration. Historical payments,
paid registrations and provider checkouts cannot be repriced through this feature.
The first confirmed registration records the normal fee, discount and actual payment
separately. Refund/access rules remain unchanged and use the actual amount paid.

Published Pakistan terms explicitly name the standard manual fee. A separate personal
price variation replaces that fee in the commitment/tax text and locks a distinct terms
version. Other cancellation, refund, statutory-rights, cohort and consent provisions are
retained. General course fees and approvals are unchanged. The shorter form guidance
retains the essential approved terms and separate consent controls.

## Release

Apply `202611090003_sirah_manual_discount` before starting the new release. It adds
an offer table and a nullable order snapshot only. Configure the one approved recipient
privately with the desired hash and 300000 minor units (PKR 3,000) as the monthly amount; inspect before
upserting to avoid replacing an unrelated offer. No existing order should be changed.
Then merge/deploy and verify the normal public URLs after edge-cache invalidation.

Validation includes 82 Sīrah workflow tests, 10 scholarship tests and 33 sponsorship tests,
lint, TypeScript and build. Local browser checks at 390, 768 and 1350 px cover the new
button, purpose choices, hidden field for unrelated emails, both manual quotes at 3,000,
receipt amount, and a complete local registration remaining pending staff verification.
Fixtures use synthetic accounts and receipts; no live payment or test notification is made.
