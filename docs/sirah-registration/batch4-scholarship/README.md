# Batch 4 scholarship form

The existing `/seerah/fee-waiver` and `/seerah/free-warrior` links now render the
updated application; `/seerah/scholarship` is a descriptive alias for the same form.
These URLs show the new version only after this change is merged and deployed.

The original form card, sections, responsive layout, full/partial contribution
choices, receipt details, submission emails and manual review process are retained.
New structured responses cover prior Sīrah learning and practical reflection,
Arabic, Islamic foundations, community service, mission support, skills/resources,
a concrete action plan and realistic weekly time commitment. Selection prioritises
sustained learning and practical service towards a strong global Sīrah community.

Applicants without relevant skills must identify a needed skill and provide a
learning plan with a first step. This is validated on the server, alongside an
explicit skills-learning commitment. Starting Arabic learners may describe their
current level honestly; suitability is assessed by staff, not an automatic test.

Only ten **awards** are allowed for Batch 4, not ten submissions. A course-row lock
serializes concurrent approvals; the eleventh cannot be awarded. Historical
applications are preserved with null batch/details and do not consume Batch 4
places. Duplicate pending/approved Batch 4 applications are rejected. Admins see
all new answers and the current award count in the existing Fee Warriors workspace
(`/admin?workspace=overview`). Existing paid/current Sīrah registrations are never
overwritten by an award; staff must review the existing payment record separately.

## Release order

1. Apply `202611090001_sirah_batch4_scholarship` using `prisma migrate deploy` in
   the authorised production runtime **before** starting the new release. It adds
   two nullable columns and an index only; it does not rewrite applications or payments.
2. Deploy the reviewed commit from main.
3. Check the three public URLs and the authenticated admin workspace. Do not send
   production test applications or emails without an agreed real test recipient.

Verification: five isolated MySQL scholarship tests, including competing approvals
for the last place, structured persistence, historical compatibility, required
learning plans and paid-registration protection; 78 existing Sīrah workflow tests;
lint, TypeScript and production build. Browser checks at 390, 768 and 1,350 px cover
layout, required inputs, conditional learning plan, a real local submission and
staff viewing the saved answers. No production applications or emails were created.
