# Sīrah paid-period and independent activation recovery

This continuation starts from main `63665e992f017c85ed9dc3f263690473706915fe`.
PRs 20–22 and 24 are already merged. PR 23 remains a separate, unapproved
policy/publication review. No unpublished independent-gate work was found in the
available worktree, branches, reflogs or project files; only the missing work was
reproduced. No old-batch credentials, prices, registrations or policies change.

## Manual paid access

A verified manual monthly receipt sets `accessEndsAt` to the corresponding
calendar month of the original programme schedule, clamped for short months.
The first payment buys one month; each distinct verified receipt increments the
paid count once, up to twelve. Annual payment retains its twelve-month entitlement.
Duplicate approval is idempotent. Terminal/cancelled/refunded orders keep their
existing access boundary and never reactivate from a late settlement.

Entitlement checking also caps pre-fix manual rows whose access date is null or
too late, without depending on an hourly job. Maintenance changes an unpaid
manual renewal to pending/unpaid rather than terminal programme completion, so
private evidence and staff verification can resume the same registration. It
preserves awaiting-review receipts. No migration or financial-ledger rewrite is
needed. The paid-period starting point remains first verified payment, subject
to the outstanding owner policy decision; no catch-up/arrears policy is invented.

## Independent activation

Every live provider/plan/country/currency route requires its own certificate:
`SIRAH_<METHOD>_<PLAN>_VERIFIED_ROUTES`, containing exact pairs such as `GB:GBP`.
An empty value closes the route. A verified Stripe annual route no longer depends
on the global Stripe sandbox boolean or monthly verification. Neither PayPal
monthly evidence nor online verification blocks manual annual activation.

All existing controls remain: approved plan terms (including tax disclosure),
independently verified receiving accounts, online live-payment business approval,
provider credentials/expected merchant/webhook configuration, online plan-specific
country and currency allowlists, compatible reusable PayPal monthly plan and
Pakistan online recurring verification. Pakistan PayPal stays disabled.

For the first Pakistan annual launch, after authorised terms/tax and workflow
acceptance, set only the applicable manual annual verified route to `PK:PKR` in
App Platform. Keep manual monthly certificates blank until accepted. This does
not require changing online live flags or introducing new accounts. Certificate
values attest recorded verification, not an instruction to pretend a test passed.

`SIRAH_STRIPE_SANDBOX_VERIFIED` is retained in the environment as historical
metadata but no longer activates any live route. Do not set it true as a substitute
for per-route evidence. Do not populate certificates without the evidence below.

## Closed provider verification

Existing owned registration/reprice/checkout APIs support a server-configured
exception to the route-certificate requirement for one exact saved order and
amount. Public quotes remain closed. There is no new unauthenticated endpoint,
client-controlled bypass flag, merchant bypass or test-only settlement path.

`SIRAH_CLOSED_VERIFICATION_CHECKOUTS` defaults to `[]`. A grant has this shape:

```json
[{"orderId":"APPROVED_CONTROLLED_ORDER_ID","method":"STRIPE","plan":"ANNUAL","country":"GB","currency":"GBP","amountMinor":32389,"expiresAt":"EXPLICIT_FUTURE_ISO_TIME"}]
```

The operator must first have explicit charge authorisation for that exact amount
and payment instrument, approved contractual/tax treatment, the online business
approval, and the plan's country/currency allowlists. Configure the short-lived
grant securely in App Platform. The owner of that existing order uses the normal
same-origin authenticated quote endpoint to select the method, then the normal
checkout endpoint accepting the approved terms version. Use the existing APIs
with that session; do not put cookies, resume tokens or provider secrets in docs.
The existing form does not advertise this closed route to general applicants.
Never alter catalogue prices to manufacture a cheaper live test.

Authenticate the actual merchant, pay through the provider, then verify completed
settlement, signed webhook, exact amount/currency/payee, one payment event,
confirmed enrolment and student/admin notifications. Replays must not add payment
or access. Browser return/approval, ACTIVE plans and mocked tests are not proof
of payment. Remove the grant after verification. Enable only the evidenced exact
route certificate; other plans/countries/currencies remain closed. Monthly needs
first payment, renewal, failure/recovery and cancellation evidence separately.
Closed verification does not automatically publish or approve provisional terms.

## Production acceptance and limitations

No credentials or App Platform configuration are available to this executor.
The connected DigitalOcean tools provide Droplet/account APIs, not App Platform.
Do not repeat credential setup: the credentials already exist in App Platform.
The operational runbook and provider checks in `production-handoff` are reused.
Private migrations, current deployment commit, real notifications and provider
inventories must be inspected through an authorised App Platform runtime.

The user reports eleven reusable PayPal plans; the latest accessible committed
inventory reports no new plans, and an incompatible older GBP plan. This conflict
is unresolved without provider runtime access. Do not create replacements or
claim eleven verified IDs. Use the existing provisioning script in read-only
inventory mode and check product association and full plan compatibility.

The session endpoint returns `X-Sirah-Checkout-Version: paid-period-routes-v1`
when this code is deployed; this confirms this change is served, not an exact
Git commit or private migration status. Production's anonymous session/schema
readiness, regional quotes, denied private APIs, invalid webhooks and public
registration can be checked without creating synthetic production students.
No migrations are introduced. Production database status must still be inspected
with `npm run sirah:database:status` / `prisma migrate status` in its runtime.

Do not call any route live until an independent real workflow has been checked.
Receiving-account approval is already supplied; terms publication and the first
Pakistan annual merchant-specific tax determination remain the narrow external
approvals. The separate policy draft is not published by this code deployment.

## Acceptance evidence for this change

56 isolated MySQL workflow tests and seven configuration/browser-state tests
pass, along with lint, TypeScript and the production build. All nine migrations
are applied in the isolated test database. Desktop/mobile browser checks on the
built app cover saved private proof, scoped resume ownership, upload/rejection/
replacement, awaiting-review without access, duplicate staff approval and a
single paid month. Student/admin notices are persisted in the isolated workflow;
no actual new production payment email is claimed delivered.

Public checks at 390 and 1350 px confirm the pending-save entry point and correct
GBP 323.89 annual summary. Twelve regional quotes across PK, GB, US, FR, BH and SA
return 200, with no unapproved methods/instructions; private APIs and malformed
webhooks deny access. Screenshots and redacted result JSON are alongside this file.
These are pre-deployment observations; the post-merge marker must be checked
separately. They do not prove private production migration history.

The owner subsequently confirmed the commercial direction and preserved the
additional fourteen-day full-refund protection from course commencement. The
separate policy draft/decision record now reflect that direction, prospective
publication and PKR 32,400 final student-facing price. Engineering checked the
contract-date cancellation clock (regulation 30), reimbursement deadline (34),
early-service request (36) and digital-content consent (37) against the primary
2013 regulations. The statutory deadline takes priority over the twenty-day
operational target; the contractual course-start window is additional and cannot
be reduced to unused months. This is a statutory-alignment check, not completed
independent review of the actual mixed supply, overseas rights or final consent
flow. The owner requires that review before authorised publication. No policy is
published and no accountant approval is inferred from the commercial decision.
