# Transactional email quota

Production was inspected read-only on 8 November 2026. No diagnostic email was sent.
The website logged 59 sent messages in the preceding 24 hours, including 20 student
Sīrah registration messages and 20 copies of those registrations to admins. Resend's
account-wide warning reports 80% of a 100-email daily allowance; website logs alone
cannot establish account-wide usage or the provider's exact quota window.

## Delivery policy

| Event | Recipients |
| --- | --- |
| Registration and secure payment resumption | Student |
| Manual payment submission | Student and configured admins |
| Verified payment confirmation / renewal | Student and configured admins |
| Rejected receipt, renewal reminder, course completion, group invitation | Student |
| Checkout reconciliation, pending refund reconciliation, billing follow-up, missing invitation configuration | Configured admins |
| Cancellation, refund, refund request, failed renewal, late settled payment needing review | Student and configured admins |

Unknown future notice types retain both recipients to avoid silently losing important
notifications. Duplicate configured admin addresses are normalised and removed.
Already queued unnecessary copies are marked SUPPRESSED, preserving their history.
Sent messages are never resent or removed. Paid group invitations retain the existing
verified-payment/access checks. Payment verification and enrolment logic are unchanged.

Operational test emails are disabled unless ALLOW_OPERATIONAL_TEST_EMAILS=true is
explicitly supplied in addition to the existing operations send flag. Production had
neither switch enabled at inspection. Audits should inspect existing delivery records.

Provider failures retain durable Sīrah notifications with retry leases. Retry-After is
honoured; quota errors wait at least one hour, other HTTP 429 responses at least one
minute, and other failures at least five minutes. A rate-limited batch stops immediately
and defers its remaining pending notifications. This does not promise a provider quota
reset at a particular time. Existing maintenance/admin retry handles eligible notices;
there is no new mail-sending schedule.

Removing registration admin copies alone would have avoided 20 of the 59 sends in the
sample. Essential traffic can still exceed the plan's allowance: more than 100 genuine
recipient deliveries per day requires a larger Resend allowance. Do not discard payment
receipts or student confirmations to conceal quota exhaustion. This change does not
purchase or modify the Resend plan, and cannot recover quota already used.
