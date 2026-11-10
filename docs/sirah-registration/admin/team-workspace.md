# Sīrah enrolments and scholarship team workspace

The existing `/admin/sirah` enrolment workspace now has a **Sīrah scholarships** tab at `/admin/sirah/scholarships`. The scholarship view is paginated and searchable, includes Batch 4 answers and private manual receipt links, and shows awarded places against the existing ten-place limit. Existing scholarship approval rules and payment verification are unchanged.

## Shared team login

The owner requested one shared team credential. Provision a dedicated `SIRAH_VIEWER` user, not a full admin or student account. The database-backed session lasts twelve hours; status/role and session expiry are checked on every scoped request. Suspension or password rotation revokes access. Staff login clears any existing full-admin cookie; logout clears both session types and deletes the staff database session.

The team can read current Sīrah enrolments, their CSV/detail/receipt views, and Batch 4 Sīrah scholarship applications/evidence. Scholarship results are filtered by both the Sīrah course slug and Batch 4 identifier on the server. Receipt access applies the same scope. Staff cannot read the general dashboard feed, unrelated fee waivers, global notifications or historical exports, and cannot approve/reject payments or scholarships, refund/cancel/reconcile providers, retry emails or edit cohort settings. These restrictions are checked server-side; hiding buttons is additional presentation only. The full administrator retains the wider dashboard and scholarship review workflow.

The login identifier is not an email mailbox. No login invitation or other email is sent by provisioning. The operator must hand the generated secret to the owner privately, outside Git and public PRs. Shared credentials do not identify individual readers; replace with separate accounts later if individual accountability is required.

## Rollout

1. Obtain the owner's production merge/deployment approval. Their standing instruction reserves those actions for explicit instruction.
2. Merge/deploy the reviewed branch and verify DigitalOcean's ACTIVE source commit and public admin login response.
3. Run `prisma migrate deploy` in the approved runtime to apply additive migration `202611100001_sirah_viewer`, which only adds an enum value to `User.role`; it does not change existing users or registrations. Do not provision the new role until the migration and new application release are active.
4. Run the trusted provisioning command against the approved production environment, with the output file outside the repository:

   ```sh
   node --conditions=react-server --import tsx scripts/provision-sirah-viewer.ts \
     --email '<team-login-email>' --name 'Sīrah Review Team' \
     --apply --credentials-file /private/path/sirah-team-login.txt
   ```

   Without `--apply`, the command only prints a preview. It refuses to overwrite an existing non-team account. Passwords are random and stored only as bcrypt hashes in the database. The plaintext output file is created with mode 0600 and is never printed to logs. Re-running the operator command intentionally rotates the password and revokes prior sessions; do not rerun merely to verify.
5. Verify sign-in, the two tabs, application answers and receipts, unrelated API rejection, no mutation controls, and logout/session invalidation. Do not create live student payments, scholarships, or test email deliveries. Give the owner the private login file after successful production verification.

A DigitalOcean `database:read` token permission issue from the separate PayPal configuration update is unrelated to this application feature; it must not cause payment approval flags to be changed here.

## Validation

All 99 isolated MySQL tests passed: 82 existing registration/payment workflow cases, ten scholarship cases and seven new access-control cases. The new cases cover password hashing, role limitations, login cookies, scoped results and private receipts, mutation/general-data rejection, expired/suspended/student/forged identities, rotation revocation and refusal to overwrite an existing student. Lint, TypeScript and production build passed. Browser checks passed at 1350px and 390px: team sign-in, both tabs, full answers, status filter, no page overflow or JavaScript errors, denial of unrelated APIs, overview redirection, logout/session invalidation, and preserved owner dashboard/scholarship review. The screenshots use synthetic local data only; production verification is required after deployment.
