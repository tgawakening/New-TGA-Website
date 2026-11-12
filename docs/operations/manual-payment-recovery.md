# Recover incomplete Sīrah manual payments

## Staff workflow

Open **Sīrah enrolments → View Details → Approve / complete payment**. For an unpaid first manual registration, a missing student receipt no longer hides approval. Check the actual receiving account, tick the received-funds confirmation, and write a short review note explaining the independent check. When a Pakistan/PKR registration has no saved method, explicitly select Meezan Bank or JazzCash. The saved fee is shown and preserved; this does not apply a new discount or reprice historical registrations.

Staff recovery records a `MANUAL_PAYMENT_RECOVERED` audit alongside the existing verified payment event, registration, enrolment and notifications in one serializable transaction. It does not create a receipt or pretend the student submitted evidence. The existing permission checks, exact amount/currency matching, revision checks and payment-event idempotency remain in force. Monthly manual access covers only the paid month; annual access uses the existing annual rules. Course-group invitations still require verified payment and current entitlement.

The new recovery action covers pending first payments (UNPAID / REJECTED / FAILED), and historical missing-method AWAITING_REVIEW records. It excludes other missing-method country/currency combinations, online checkout/payment references, PROCESSING records, prior paid instalments and terminal enrolments. Existing submitted manual payment reviews and cancelled-transfer reconciliation retain their previous behaviour. Stripe and PayPal payments remain provider-verified; this feature cannot relabel them as manual payments.

## Receipt uploads

New registration, saved-registration evidence and scholarship contribution forms share browser-side image preparation. JPG/PNG/WebP images up to 20 MB are accepted as source images. Images larger than 2400 pixels or the 4 MB upload cap are resized, and WebP is converted to JPEG for upload. Browser file metadata may be missing or nonstandard when the extension identifies a supported image. PDF uploads remain limited to 4 MB. HEIC is not promised: export it as JPG/PNG first.

Real content is still checked server-side with file signatures, image decoding and PDF parsing. The 4 MB stored-file limit, bounded multipart stream, private receipt access and student requirement to attach a receipt remain. Client preparation errors preserve the form for correction/retry. Staff recovery is a separate, audited exception for independently verified transfers.

## Checks

- Lint, TypeScript and production build passed. All 12 focused workflow checks and all 10 scholarship checks passed.
- Twelve focused workflow checks: recovery with/without a saved method, monthly access, annual PKR 32,400 preservation, explicit staff confirmation and note, stale edits, online/provider-reference exclusion, concurrent approvals, duplicate references, existing receipt review, real WebP and invalid/oversized files.
- Broad workflow run: 89/92 pass. The three pre-existing personal-discount/rate-limit expectation failures are unchanged from main; no discount behaviour was edited to mask them. The additional historical missing-method awaiting-review case is included in the focused checks.
- Browser checks at 1350px and 390px: actual local multipart submissions for a 13,525,785-byte PNG reduced to a 3,036,058-byte request, WebP conversion and an image with empty MIME metadata. All saved exactly one receipt, remained AWAITING_REVIEW and credited no money. Staff approved two synthetic incomplete records through the actual dashboard, including explicit selection for an unset method. No horizontal page overflow in the admin checks.
- All financial fixtures used isolated local MySQL with external email disabled. No production student record, payment, upload or enrolment was changed for testing.

No migration or new environment setting is required. Merge and deployment remain subject to the owner's production instruction; a feature-branch push alone does not change the public site.
