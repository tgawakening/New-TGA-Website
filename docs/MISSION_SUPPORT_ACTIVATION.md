# DigitalOcean contribution settings

The Contribution & Donation Policy is published by this release at:

`https://www.tga-awakening.com/policies/contribution-terms`

It reflects the supplied decisions: funding preferences with flexibility for related delivery/operating costs, email notice of redirection, cancellation of future monthly payments, normally final contributions and review of evidenced duplicate/mistaken payments. Separately accepted written restrictions remain binding. No unexplained 30/70 allocation model is asserted. Course refund terms remain separate.

In DigitalOcean, open **tga-app → Settings → new-tga-website → Environment Variables → Edit**. Add these separate key/value rows with runtime availability. Paste values without wrapping quotation marks:

| Key | Value | Encrypt |
| --- | --- | --- |
| `MISSION_SUPPORT_POLICY_URL` | `https://www.tga-awakening.com/policies/contribution-terms` | No |
| `MISSION_SUPPORT_ALLOCATION_NOTICE` | Copy the paragraph below | No |
| `MISSION_SUPPORT_MANAGEMENT_SECRET` | Copy the generated secret from ignored `.env.local` directly into DigitalOcean | Yes |
| `MISSION_SUPPORT_PAYMENTS_ENABLED` | `true` | No |
| `MISSION_SUPPORT_LIVE_APPROVED` | `true` | No |

Allocation notice:

> Your selected purpose guides allocation. Contributions may support TGA’s programmes, scholarships, teaching, enrolment support, administration and payment-processing costs. TGA may redirect funds when needs change, with an email notice. Specific restrictions require written agreement before payment.

Keep the management secret private and stable: replacing it invalidates existing donor management links. If creating a new secret elsewhere, generate 32 random bytes locally, for example with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`, and copy the result directly to the encrypted variable.

Confirm the published policy URL loads before enabling the flags. Save the variables and redeploy. Existing valid live Stripe, webhook, database, email and application-origin settings remain necessary; the policy settings alone cannot validate these services.

The Stripe webhook must include checkout, invoice, subscription and refund events described in `MISSION_SUPPORT_SETUP.md`, and the Billing Portal must allow subscription cancellation. Verify an authorised payment, donor/admin email, cancellation and refund before treating the complete flow as operationally tested.

Allocation-change emails require an organisational workflow: the team must identify affected donor records and send the promised notice. The application currently sends payment acknowledgments; it does not automatically detect a funding decision or send a reallocation campaign. No such campaign is sent by this release.

Refund approval requires verifying the payment and evidence. The existing admin refund action submits a refund to the original payment method, with ledger confirmation coming from Stripe's refund webhook. A policy refund decision and a confirmed provider refund are distinct steps.
