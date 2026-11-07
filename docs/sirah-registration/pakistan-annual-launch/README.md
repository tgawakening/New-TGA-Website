# First live route: Pakistan annual, PKR 32,400

This package uses PR #25; it does not repeat that development. Meezan and
JazzCash are independent of each other and of every Stripe/PayPal test. Nothing
here records missing approval as received or enables payments automatically.

## Reviewable publication and configuration

- `policy-for-approval.md`: complete first-market publication candidate, including
  the already-approved course-start fourteen-day full refund and statutory priority.
- `annual-terms.candidate.json`: exact checkout field text and existing server enums.
- `digitalocean.after-approval.json`: exact App Platform runtime values, split into
  shared annual terms and a separate activation patch for each receiving method.

**Do not install the after-approval values yet.** The owner has now confirmed **14 November 2026** as the first paid class; 7 November was the free orientation. The additive migration records that confirmed date in the cohort setting. The remaining date token is the actual prospective publication date. Replace it consistently in both JSON files only when publication is authorised.
Retain the final published version and legal/tax approval references securely.
No additional tax or altered PKR 32,400 price is authorised. If finance determines
that the existing total cannot lawfully be used, obtain separate pricing approval;
do not silently add tax. Configuring a `tax` string is not accountant clearance.

The existing receiving details are already owner-confirmed. Reuse their existing
App Platform values. Set only the target method's annual certificate to `PK:PKR`;
its receiving verification flag is already authorised, and does not open monthly
payments. Do not change online live flags, other plans, country/currency lists or
old-batch credentials. Installing shared annual terms alone must not be treated
as approval of an online annual route.

The added optional consent texts cause separate unchecked service-start and
recording-access checkboxes. Server evidence/checkout rejects missing required
choices. Audit records retain exact versioned text, choices and timestamps;
submission/confirmation emails include the accepted terms and choices. Old saved
agreements without these new texts retain their original proof/resume behaviour.
The controls do not establish completed legal review. The reviewer must confirm
mixed-supply classification and final early-service/digital-content treatment.

## Single action for each external blocker

| Responsible person | One action |
| --- | --- |
| Authorised course owner with applicable consumer-law reviewer | Approve `policy-for-approval.md` for prospective publication, confirming the final consent treatment while retaining the confirmed 14 November 2026 teaching date. Commercial decisions are already settled. |
| CIC's accountant/tax adviser | Answer the one UK/Pakistan first-market question at the end of that document, with basis, effective date and approved reference, preserving PKR 32,400 unless a price change is separately approved. |
| DigitalOcean administrator | Make the existing App Platform runtime/API accessible to the authorised operator; current connected tools provide Droplet/account operations only and the executor has no bound app/provider/database credentials. Retain credentials in their existing secure settings. |

Once the runtime is accessible, run `npm run sirah:launch:check` in the existing
`new-tga-website` console. It reuses the existing read-only migration, receiving,
registration and notification checks. It explicitly prevents the optional
operational-email sender from running. It reports safe route/configuration
metadata without revealing credentials or receiving-account numbers. It never
creates a payment, updates an order, installs terms or changes a flag. Add
`-- --providers` to reuse existing Stripe merchant and PayPal product/eleven-
currency plan inventory checks, with no `--apply`, no duplicate plan creation,
no capture and no subscription creation. Failure in provider checks does not
hold up the independent manual-only check.

One additive migration, `202611080001_sirah_cohort_commencement`, creates the cohort setting and records the owner-confirmed 14 November date. Apply it through the existing authorised runtime before accepting dated payments; no student/payment/history rows are reset. `publicSirahCohort` explicitly reports pending/schema-unavailable if the table is absent, while pending registration and old proof/resume flows remain available. The date can then be confirmed/corrected at `/admin/sirah` without a code deployment, with owner reference, reason, revision protection and private history. Public responses exclude internal actor/reference details. Refund review uses the most protective recorded commencement protection, separate from statutory review and unused-month calculations.

## Activation and first genuine acceptance

After recorded clearances, the authorised operator installs the final shared
annual terms and applies the Meezan patch, JazzCash patch, or each separately.
Rebuild/redeploy the existing main service if required. Check production
`/api/sirah/session`: `releaseCommit` is stamped at build time from a valid source
binding or git HEAD; `unknown` is reported honestly if neither is available.
App Platform's optional `${_self.COMMIT_HASH}` binding is documented by DigitalOcean:
https://docs.digitalocean.com/products/app-platform/how-to/use-environment-variables/
Compare it with the active App Platform deployment source; a successful Vercel
preview deployment is not production evidence.

Check a public PK/ANNUAL pricing quote: currency PKR, amountMinor 3240000, only the
individually enabled/approved methods present; PK/MONTHLY and unverified online
routes remain closed. A real student should register/save one annual order,
accept the published terms/express choices, receive the approved instructions,
and transfer PKR 32,400 through the selected route. They upload proof or use the
existing private WhatsApp-evidence option. Evidence leaves enrolment pending.
Authorised staff independently check the actual receiving account, amount,
currency, unique transaction reference and receipt. Only then approve the saved
order, with the verified reference, through the existing protected admin workflow.
Confirm one paid annual event, one enrolment, twelve-month dates, protected admin
record and genuinely delivered student/admin confirmation emails. Repeat approval
must not duplicate payment, enrolment or notices. Do not generate a fictitious
production deposit or self-approve a screenshot as proof of bank receipt.

A method can be called enabled after the public quote/instructions check, but
call it **live and independently verified** only after the genuine settlement /
staff / enrolment / delivery acceptance above. Record each method separately.
A first Meezan success must not be represented as verification of JazzCash.

Stripe/PayPal genuine transaction tests require access to the existing provider
runtime and approved test instruments. Reuse existing sandbox evidence where
valid. A live charge additionally needs explicit approval of its amount and
instrument. Existing credentials, ACTIVE plans and unsigned/fabricated deliveries
are not evidence of genuine settlement or a provider-signed webhook.

## Validation and rollout evidence

63 isolated workflow tests and seven configuration tests pass. Built-app browser
checks at 390 and 1350 px verify the confirmed 14 November date, separate unchecked
express choices, submission blocked until choices are made, private receipt
submission leaving access pending, staff approval at PKR 32,400, duplicate-safe
annual enrolment and no horizontal overflow, for both Meezan/JazzCash. Protected
cohort GET rejects anonymous access and POST rejects an unrelated origin. The
screenshots/result JSON alongside this document are explicitly isolated tests:
synthetic receipts, synthetic receiving details, no real student charge and no
new genuine production email delivery claimed. Email payload persistence is
covered by workflow tests; genuine delivery is checked in the authorised runtime.

The new public release marker is `cohort-consent-v2`. The session response also
reports `releaseCommit` and `cohort.schemaAvailable`, so production code identity
and whether the additive cohort table exists can be distinguished. A missing
cohort table does not disable pending registration or manufacture a start date.
Collection remains closed pending the recorded policy/tax approvals and required
configuration. No actual activation is performed by this package's code rollout.
