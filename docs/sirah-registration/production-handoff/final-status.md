# Final Sīrah production handoff

## A. GitHub and deployment

PR #20 merged as `aa0adfb`; the continuation changes merged through PRs #21 and #22. Production revision **`b1ba0062d9d1bea911294aaf87b6a39b9d96aa16`** is ACTIVE in DigitalOcean `tga-app`, service `new-tga-website`, deployment `23d01f3b-a942-4462-b13b-b144d78616be`. Nine migrations are present with none pending. Existing local work, student records, older-batch credentials and general policy are preserved.

Registration: https://www.tga-awakening.com/seerah/register

## B. Pakistan

Meezan and JazzCash effective runtime details match the owner-confirmed existing organisation records. Authorised staff API access was verified. Independent receiving-account flags are true, but **new collection remains disabled until the applicable terms/tax treatment are approved**. New receiving instructions remain withheld while terms are unset. Saved issued-instruction proof submission remains supported.

Approved prices are unchanged: manual monthly PKR 3,500; eligible automatic card monthly PKR 3,000; upfront PKR 32,400. Private proof upload, replacement, ownership, staff approval/rejection and duplicate confirmation were tested against isolated MySQL. No production deposit was invented or marked received. Manual proof alone never confirms enrolment. Support is 03262055614 / https://wa.me/923262055614. PayPal is hidden for Pakistan.

## C. International

**No live Stripe or PayPal collection route is enabled.** All countries can save a pending registration. There is no silent FX conversion. GB Stripe's country specification does not list BHD or KWD; Bahrain/Kuwait local-currency Stripe collection is not treated as supported. Other catalogue currencies listed by the country specification still require actual route tests and approvals.

PayPal integration currency candidates: GBP, USD, CAD, EUR, CHF, SEK, NOK, DKK, PLN, CZK and HUF. This is not an activation list. PKR, INR, SAR, QAR, BHD, KWD and RON combinations remain unavailable in this integration. GBP fallback countries are not automatically eligible: live activation now requires separate country and currency allowlists for each provider and plan.

## D. PayPal plans and merchant checks

Existing product `PROD-4MG49974LK7417127` and webhook `8P300895YB677700G` were verified under the existing live app. Configured expected merchant ID is present. No existing provider order was available to independently compare its payee; the reporting API is not permitted by current app access (HTTP 403). No new credentials/app/product were substituted.

Existing UK plan `P-41P7163096581714RNLXSPAA`, GBP 29.99, ACTIVE, monthly × 12, remains preserved. It is **not reused** because `auto_bill_outstanding=true`. No new plans were created while applicable terms/merchant verification remain unresolved. The reusable provisioning script prepares/checks all eleven requested currencies, inventories before creation, and applies stable idempotency keys. Checkout no longer creates per-student plans. Annual uses Orders/Capture, not a subscription. See `paypal-plan-inventory.json`.

## E. Registration and verification

52 isolated workflow tests and seven configuration tests pass. TypeScript, lint and production build pass. Local browser checks verify one saved registration on repeat submission, one student notice, secure resume, country/plan retention and withheld access/invites while unpaid. Production render/change checks pass at 390 and 1440 px, with no horizontal overflow. Twenty production country/plan quotes match the catalogue and return no unapproved methods or receiving instructions. Malformed/unsigned Stripe and PayPal webhooks return 400.

The production audit found one existing UNPAID/PENDING registration, preserved unchanged. No live student charge or synthetic paid enrolment was created. Initial/renewal sandbox payment plus signed app webhook/enrolment checks are still required; provider-only earlier PKR payments are not presented as app end-to-end evidence.

Annual savings now show the actual currency saving using integer catalogue values: UK GBP 35.99, Pakistan PKR 3,600 against twelve online payments. Catalogue prices are unchanged.

## F. Notifications and admin

Resend confirms delivered status for the existing **student registration email**, **admin registration notice** and one authorised operational check. The operational check used the existing transactional mailer/EmailLog; it is now disabled and deduplicated. Provider IDs and delivery evidence are in `final-verification.json`, without recipient addresses.

Sīrah maintenance completed once in production with zero failed tasks. The App Platform hourly job is configured at minute 15 UTC and uses the existing Sīrah outbox/maintenance functions. It does not invoke the older batch's renewal processor. Successful-payment, renewal, cancellation and refund notifications remain covered by isolated workflow tests; genuine event delivery for those payment routes is not claimed complete.

Paid-student group URLs are absent: `SIRAH_PAKISTAN_GROUP_URL` and `SIRAH_INTERNATIONAL_GROUP_URL`. Public consultation/orientation groups are not substituted. Verified paid enrolment can queue an invitation follow-up until the private invite mapping is configured; unpaid students receive no invite.

## G. Exact remaining approvals and verification

1. **Policy publication:** authorise the separate proposed Sīrah policy, effective date, proposed detailed grace/access/refund-processing rules, first verified payment versus cohort start as the paid-period start, and whether the general policy's additional full-refund promise within fourteen days of the course start carries over. Confirmed voluntary renewals and the unused-month principle are not reopened. Statutory cooling-off/early-performance and digital-content consents need final applicable legal review. The old general policy is unchanged. Draft PR #23 contains the registry-verified seller details.
2. **Accountant:** determine education VAT exemption/eligible-body conditions for the actual mixed supply, current VAT registration and the applicable £90,000 taxable-turnover tests, live teaching/recordings place-of-supply treatment and collection obligations per first launch country. State whether no tax is due or whether any tax must be included/added. No universal exemption is inferred from CIC status. No tax or price is changed automatically.
3. **Merchant records:** Stripe account ID/credentials match and charges/card capability are enabled, but its company name is the former Ltd name. Companies House confirms the same company is now Global Awakening CIC, number 15523255; the account's business record needs authorised confirmation/update. PayPal expected merchant identity still needs independent provider/payee corroboration.
4. **Genuine payment tests:** the Sīrah sandbox Stripe API key is absent; live keys cannot run test clocks. Upfront signed app webhook/enrolment verification and monthly first/renewal/failure/recovery/cancellation tests remain incomplete. PayPal needs genuine Orders/subscription settlement, signature/enrolment and cancellation testing. Existing live credentials do not need to be entered again. Unverified plan/country/currency lists stay disabled.
5. **Paid group configuration:** add the approved private paid-student invite mappings when available; this is separate from public consultation destinations.

## H. Live status

**LIVE:** registration saving/resume, regional quotes, admin access, actual registration/admin emails, maintained pending states and existing issued-proof submission compatibility.

**READY BUT NOT COLLECTING:** Pakistan Meezan/JazzCash receiving configuration and staff verification workflow, pending approved contractual/tax treatment.

**DISABLED:** all new Stripe/PayPal collection and the PKR 3,000 recurring subscription. No payment option is called live solely because the merchant account or provider plan is ACTIVE.
