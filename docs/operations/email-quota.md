# Sīrah transactional email delivery

## Production audit — 12 November 2026

A read-only audit used Resend's authenticated usage, domain and email APIs. It sent no diagnostic emails. At the first inspection, daily usage was **14/100**, monthly usage **884/3000**, the sending domain was verified, and one unique admin recipient was configured. The login-only shared team address was not configured as an admin recipient.

Of 408 provider messages within the checked seven-day window, 400 were delivered to recipient mail servers and eight bounced. 280 matched this website's logs. Those include 50 delivered payment-confirmation emails, 20 delivered manual-submission emails, and 40 delivered scholarship student/admin submission emails. Six website registration messages bounced, all associated with unpaid registrations: four permanent failures, one full mailbox and one general transient failure. The other two provider bounces did not match this website's logs. Private follow-up records and provider bounce details are stored outside Git; student addresses and private group invitations are not included here.

There were no pending/failed Sīrah outbox messages or API-send failures in the inspected period. `EmailLog.status=SENT` means the provider accepted the request, not confirmed inbox delivery. Delivery outcomes above were independently checked against Resend. Mail-server delivery does not establish inbox placement or a read receipt.

Separately, 25 verified paid enrolments had group invitations pending because regional paid-group settings were absent. The owner supplied both regional destinations on 12 November. They were added as encrypted app-level runtime settings for the website and maintenance/audit jobs, preserving all unrelated app settings. Active-runtime assignment and invitation delivery must be verified after that configuration deployment. Public enquiry groups remain separate. Missing groups do not reverse verified enrolment.

## Recipient policy

| Event | Recipients |
| --- | --- |
| Pending registration and secure payment resumption | Student |
| Manual receipt submission | Student and configured admins |
| Verified payment confirmation / renewal | Student and configured admins |
| Rejected receipt, renewal reminder, completion, group invitation | Student |
| Checkout/refund/billing reconciliation, missing invitation configuration | Configured admins |
| Cancellation, refund/request, failed renewal, late settled payment review | Student and configured admins |

Scholarship submission/decision notifications retain the existing student/admin recipients. Unknown future Sīrah notice types retain both recipients. Admin addresses are normalised and deduplicated. Existing unnecessary *unsent* copies are marked SUPPRESSED with audit history retained. Successful sends are not replayed or removed. Paid invitations retain their existing verified payment, active entitlement and current regional-link checks.

Routine operational test email is disabled unless `ALLOW_OPERATIONAL_TEST_EMAILS=true` is explicitly set in addition to the existing diagnostic-send flag. Read delivery records for operational checks instead of sending tests.

## Limits and safe retries

Resend's free daily quota resets at midnight UTC (**05:00 Pakistan time**); it is not a rolling 24-hour window. Both sent and received messages count. Each recipient consumes quota. The website cannot manually reset Resend's allowance. More than 100 essential deliveries per day needs an adequate provider plan; this change does not purchase an upgrade or discard essential notices.

Durable Sīrah notifications retain retry leases. A daily quota rejection waits until 00:01 UTC after reset (or longer if Retry-After requires it). Monthly quota failures wait at least an hour; other 429 responses at least a minute; other failures at least five minutes. A 429 stops and defers the remaining batch, preventing repeated requests while the provider is limiting delivery.

Clearly rejected 429 attempts are marked internally only if there is no earlier potentially accepted attempt. These may recover after reset even when the notification is older than 23 hours. An old ambiguous network failure or expired SENDING lease remains DELIVERY_UNKNOWN for provider reconciliation rather than being blindly replayed beyond the idempotency window. Resend's stable idempotency key is preserved. No additional sending schedule or schema change is added.

Bounced messages already accepted by Resend are different from rejected send requests. Do not reset those notifications or repeatedly resend to the same failing mailbox. Staff should check the private bounce report, confirm a working address / resolve a full mailbox, verify the student identity before changing account details, and use the secure payment-resume flow for a fresh link when needed. Old resume links expire after 72 hours.

## Validation and rollout

The patch reuses the existing work from draft PR #38 on current main. Six focused tests cover recipient selection, historical-copy suppression, operational-email blocking, retry leases, quota batch pauses, daily reset recovery and holding ambiguous old sends. The broad workflow run has 84 passing / 3 failing out of 87; those three discount/rate-limit expectation failures were already documented and reproduced on main during PR #53, and do not involve email policy. Lint, TypeScript and production build passed.

The owner authorised deployment after fixes on 12 November. Commit/push and review the concrete patch, then merge/deploy it. Verify the active source commit, live email policy, essential outbox delivery and current provider usage. Do not send test mail, replay delivered/bounced messages, reset payment state or expose secrets in logs. No provider credentials, prices, payment approval flags or enrolment decisions change.
