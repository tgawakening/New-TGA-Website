# Scholarship transfer evidence and application emails

The regular Sīrah registration and saved-registration evidence endpoints already
require a valid receipt for Meezan Bank and JazzCash. Scholarship applicants choosing
a partial manual contribution must now also select their transfer method and upload
a JPG, PNG or PDF receipt up to 4 MB. Full-scholarship applicants do not need a receipt.

Both the public endpoint and submission service enforce the rule. Multipart bodies
are bounded before parsing; the existing Sīrah content-signature and image/PDF decoder
validation is reused. Evidence and the application are saved atomically. Evidence is
not proof of settlement: submission remains pending, and approving a partial scholarship
still leaves its payment under review and enrolment pending staff verification.
The selected manual method is retained on the eventual payment record.

New receipt bytes live in a separate private table, never in overview JSON or email.
Staff can view a receipt from the existing scholarship detail panel or an authenticated
staff link in the notification. Anonymous receipt access is denied; successful downloads
use private/no-store, nosniff and sandbox headers. Historical applications are unchanged.

Student acknowledgements and named admin notifications now include a sectioned overview
of every visible form field: personal information, Islamic learning and Arabic, motivation,
service/mission contributions, skills and learning plan, attendance and time commitment,
contribution and transfer details, receipt metadata, need, referral and all agreements.
HTML and plain-text versions are generated from the same field list, with HTML escaping.
Only staff emails include the private receipt/review links. Subjects identify the applicant.
Duplicate configured staff addresses are removed and per-application idempotency keys
are used. No extra diagnostic or broadcast email is introduced, and old applications
are not emailed again. Provider failures remain recorded in the existing email log.

Before deploying, apply `202611090002_scholarship_receipt` with `prisma migrate deploy`.
It adds a receipt table only; existing student, scholarship and payment rows are untouched.

Validation: 10 isolated scholarship tests and 78 existing Sīrah workflow tests passed;
lint, TypeScript and build passed. Tests cover both methods, missing/invalid receipts,
private downloads, pending payment/access, multipart submission, complete escaped emails,
and recipient deduplication. Browser checks at 390, 768 and 1350 px verify conditional
uploads, full/partial local submissions and staff receipt access. Email rendering was
previewed locally without sending a production test message.
