# Scoped Sīrah scholarship approval

The owner requested scholarship approval on the Sīrah team dashboard, in addition to enrolment and application viewing. Add an **Approve scholarship** action for pending Batch 4 applications, with a confirmation dialog and optional review note. Approved/rejected applications cannot be approved again. The saved application records its approving account and review time.

## Permissions

`SIRAH_VIEWER` stays read-only. The new `SIRAH_REVIEWER` role may read the same Sīrah records and approve current Batch 4 Sīrah scholarships through `/api/admin/sirah/scholarships` only. Enrolment/payment mutations, provider reconciliation, refunds, rejections, settings, global notifications, unrelated fee waivers and historical exports remain restricted to the full administrator. A reviewer is not a full administrator. The UI labels this account **Scholarship approver**.

The approval API checks same-origin requests, the active database session and approval capability. It accepts only an approval payload, and independently constrains the application to both the current Sīrah course and Batch 4. It reuses `reviewFreeWarriorApplication`, including the course-row transaction lock, ten-award cap, pending-state guard, paid-registration protection, account/enrolment processing and existing student/admin notifications. Full scholarships activate scholarship access. A partial-contribution approval remains manual review / payment under review / enrolment pending until the main administrator verifies payment. Approving a scholarship never verifies Stripe/PayPal or manual receipts.

The approving account is saved in nullable `FreeWarriorApplication.reviewedBy`; existing historical reviews are not backfilled or attributed to a guessed person. A shared account identifies the team login, not the individual team member.

## Deployment and the existing shared login

The earlier approval covered PR #51's read-only workspace. Obtain explicit approval for this new production merge/deployment before changing the shared account's rights. The additive migration `202611100002_sirah_scholarship_approver` adds the enum value and nullable audit column; it does not itself upgrade any user. The configured DigitalOcean pre-deploy migration job applies it.

After the new release is ACTIVE and its commit is confirmed publicly, grant only the already-authorised shared team account:

```sh
node --conditions=react-server --import tsx scripts/grant-sirah-scholarship-approval.ts \
  --email '<existing-shared-team-email>' --apply
```

Without `--apply`, the command prints a preview. The grant is idempotent and refuses student/full-admin/suspended accounts. It changes only the existing team user's role and preserves its password, sessions and records. No credentials or payment flags are changed. The owner can continue using the same login; refresh the dashboard to load the new controls. Future password rotation preserves a reviewer's scoped role and revokes prior sessions.

Verify production sign-in, the role badge, pending application controls and read-only payment/other-admin restrictions. **Do not approve a real applicant merely to test deployment.** Use the isolated database tests and local browser approval for the positive write path; in production use read checks and empty/invalid payloads to verify permissions without making any scholarship decision. Real approvals are for the authorised team after reviewing eligibility.

## Validation

All 106 isolated MySQL tests passed, including seven new approval tests. These cover viewer denial, explicit reviewer grants without password changes, wrong-course/old-batch rejection, denial of rejection/payment/general-admin actions, untrusted origins, successful full scholarship/enrolment with an approver audit, duplicate approval without duplicate records/emails, partial contributions remaining unverified, the ten-place limit, password rotation preserving scoped rights, and refusal to promote students/suspended users. The existing 99 registration/scholarship/access tests remain passing. Lint, TypeScript and production build passed. Browser verification passed at 1350px and 390px using synthetic local applications and no email/provider credentials: reviewer login, approval confirmation, successful approval, recorded approver/note, removal of repeat-approval controls, no page overflow/JavaScript errors, and rejection of payment/general-admin writes. No production permission or scholarship record was changed.
