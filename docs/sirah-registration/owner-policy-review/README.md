# Owner policy implementation review

The owner confirmed voluntary monthly renewals without a compulsory twelve-payment commitment and the unused-month upfront refund principle. Fully unused months only, month-end access/recording expiry, a seven-calendar-day failed-renewal grace and a 20-calendar-day refund target after approval are proposed settings for final approval/legal review. They are not installed as live contractual terms. [Decision record](decisions.json) deliberately has null required terms fields and cannot be used as an approved terms payload.

The owner's stated tax position is that tax is not applicable to advertised fees. No tax is automatically added. This does not establish the merchant's legal classification or an exemption in every billing jurisdiction.

## Monthly cancellation and access

The previous PayPal PERIOD_END availability rejection is removed only with implemented cancellation support. The existing API stops PayPal future billing, reads the subscription again, verifies the order/plan association and CANCELLED/EXPIRED status, then preserves the verified current paid-period expiry in the app. An unconfirmed provider response leaves local cancellation unconfirmed. Stripe cancellation likewise verifies merchant/subscription ownership and the resulting period-end/cancelled state, without proration or automatic refunds.

Both provider cancellation webhooks preserve an already locked paid boundary. Duplicate events cannot extend access to the remaining unpaid programme months. Cancelling monthly never automatically refunds completed payments. Twelve cycles remain a maximum programme schedule, not an obligation to make twelve payments. Checkout shows voluntary renewal and cancellation instructions separately from the annual terms. Existing historical terms are not rewritten.

The optional approved-term field `failedPaymentGraceDays` controls grace; it is not enabled by default. With PAUSE plus seven days, the deadline is anchored to the verified renewal due date, or the first observed failure if no verified due date is available. Retries do not extend it. Entitlement checks deny access after expiry even without maintenance. Maintenance pauses access but leaves the original subscription available for recovery; a verified new payment restores access once and clears the grace boundary. Cancellation does not borrow extra grace days as a paid period. Failed-payment emails use the existing secure resume mechanism and billing-management route. An explicit recovery action can reactivate the same suspended PayPal subscription only after current approved terms, ownership and matching plan checks; the resulting ACTIVE state is re-read and does not count as settlement or restore access. Cancelled, expired or completed subscriptions cannot be restarted. No duplicate subscription is started.

Recordings follow the same paid entitlement and original programme expiry. This work creates no recording host or extension beyond the existing programme.

## Annual refund review

`calculateSirahAnnualRefund` uses verified charge-currency minor units, never monthly list prices: collected amount × eligible unused months ÷ 12. It rounds down once to the smallest currency unit, subtracts all previous refunds, and never proposes more than unrefunded collected funds. Fully started months are treated as used by the proposed calendar helper; exact monthly boundaries and month-end dates are tested. Rounding remains part of the policy review. Statutory exceptions require staff review rather than an automated policy refusal.

The staff-only `QUOTE_ANNUAL_REFUND` action verifies the original upfront payment and prior refund ledger against the recorded balances, checks the registration revision and calendar eligibility, and audits the calculation version, payment/refund references, inputs and output. It reports `policyApprovalRequired: true` and never issues money.

Students can request a refund review through the existing saved-registration experience. The private new endpoint requires ownership and a paid annual registration. Repeat requests for the same revision are deduplicated and queued through the existing notification outbox. Staff see requests in the existing audit/dashboard data. No refund amount or access change is approved by requesting a review.

Issuance remains in the existing authorised staff workflow, using the original provider/manual verification and signed refund reconciliation. No automatic monthly refund or provisional 20-day promise is published. The opt-in approved-term fields `annualRefundBasis: FULL_UNUSED_MONTHS` and `refundAccessTiming: CURRENT_MONTH_END` support the proposed end-of-current-month access rule; no new production term values are set by this PR. Existing agreements without these fields retain their existing behaviour.

Staff quote API (authenticated `/api/admin/sirah`): action `QUOTE_ANNUAL_REFUND`, orderId, current revision and whole `unusedEligibleMonths`. Student request API: `/api/sirah/orders/[id]/refund-request`, current revision and reason. These add no migration; requests/quotes use the existing durable audit and notification tables.

## Consumer-law review

Sources checked 7 November 2026:

- [UK Consumer Contracts Regulations 2013, regulation 34](https://www.legislation.gov.uk/uksi/2013/3134/regulation/34): statutory cancellation reimbursement can require a shorter deadline than 20 days after internal approval. Internal approval must not reset or extend a statutory clock.
- [Regulation 36: services started in the cancellation period](https://www.legislation.gov.uk/uksi/2013/3134/regulation/36): review express requests for early service performance and proportionate charges.
- [GOV.UK online selling](https://www.gov.uk/online-and-distance-selling-for-businesses/online-selling): provide reproducible terms/contract confirmation, clear total prices and cancellation information. Digital recordings/streaming consent and acknowledgement can have separate requirements. Review whether the actual supply is live teaching, digital content or a mixed contract; this code does not automatically waive cancellation rights.
- [PayPal Subscriptions cancellation API](https://developer.paypal.com/api/subscriptions/v1/subscriptions-cancel): the existing v1 billing subscription cancel call is used; no different subscription architecture or older-batch plan is substituted.

Owner publication approval and applicable consumer-law review remain outstanding. Overseas billing also needs the actual merchant/services and applicable tax/consumer jurisdictions confirmed. This research is not a statement that legal review is complete.

## Validation and production status

All 50 isolated MySQL workflow tests, six configuration tests, lint, TypeScript and production build pass. The policy work adds service regression tests for provider status verification, duplicate cancellation events, paid access, grace expiry/recovery, exact refund amounts, prior refunds, calendar eligibility, private/deduplicated requests and audited staff-only quotes. Desktop/mobile production-build browser tests use isolated synthetic paid registrations and mocked PayPal responses; they are not genuine provider settlement tests. The mobile recovery check reactivated only the original mocked suspended subscription and verified that the payment stayed pending, the collected amount/access boundary did not change, and no new checkout was offered.

[Monthly terms desktop](monthly-desktop.png) · [Monthly terms mobile](monthly-mobile.png) · [Cancelled paid access](cancelled-mobile.png) · [Existing-subscription recovery](recovery-mobile.png). Screenshots use synthetic local terms and student data.

PR #19 was separately approved and merged as `2e704b9`. Public checks confirm its receipt-compatibility bundle and unsigned-webhook HTTP 400 on both domains, with registration available. Existing real student records, production logs and provider delivery history remain inaccessible here; DigitalOcean credentials have not been attached to this executor. The confirmed DigitalOcean variables remain in DigitalOcean; they are not assumed absent or valid merely from their names. No keys were replaced, live flags/currency lists enabled, provider resources created, or real charges/refunds/subscriptions issued.

The cloud-desktop workflow was also checked: executor `ccarenv_b64_Y2NhcmVudl9kNjM3NjE5ZjQ2NGM4MTkxYWJmNWMyNzFjMDY2NGI3Zg` reports remote desktop enabled with state unknown, but no `cua_repl.js` control tool is offered. It supplies no additional authenticated DigitalOcean/provider access.

## Smallest outstanding activation steps

First finish owner publication/legal approval of the recorded policy and merchant-specific tax treatment. Reuse the existing PayPal app/product/webhook and existing sandbox evidence. An authorised runner must resolve the expected Business Merchant ID from approved business-account records, verify app association and signed delivery, and complete the remaining real capture/app-enrolment checks before allowing only a tested upfront country/currency (for example GBP 323.89 for UK annual). Monthly additionally requires a compatible plan, verified first/renewal settlement and real cancellation/failure behaviour; the old incompatible plan is not modified. Stripe account-mode verification can use the existing `npm run sirah:stripe:check` inside the authorised App Platform runtime. Its existing encrypted credentials need not be recreated.

No unverified route is activated by the engineering changes or by the policy decision record.
