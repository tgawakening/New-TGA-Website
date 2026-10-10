# Support Our Mission refinement

## Audit and structure

The previous implementation had ten content sections, repeated Gen-Mumin and Seerah promotional posters, overlapping programme explanations, nine FAQs and repeated closing invitations. Its existing Stripe integration, GBP validation, purpose metadata, saved selections and verified confirmation flow were retained.

The refined page has six sections at the existing `/support-our-mission` URL:

1. Hero and contribution form.
2. Why support matters: knowledge, character and responsible leadership.
3. Three funding preferences: Educational Access, Seerah & Leadership Education, Learning Resources & Delivery.
4. Connected contribution journey: contribution → planning/resources → teachers/delivery → learner opportunities.
5. Trust and transparency, with CIC information and genuine company/policy links.
6. Closing invitation and five essential FAQs.

## Assets and implementation

Five original SVG assets replace every promotional image on the page. They share navy linework, warm paper, sage and copper, and total approximately 7 KB before compression. They contain no external images, fonts, scripts or documentary claims:

- `learning-journey.svg`: open book, learning steps, growing plant and a warm architectural setting.
- `learning-values.svg`: learning represented by an open book growing into a branching tree.
- `educational-access.svg`: a doorway, open book and connected learning screen.
- `seerah-leadership.svg`: manuscript, planning map and compass; no historical figures depicted.
- `learning-resources.svg`: lesson planning, books and teaching materials.

Regenerate with `node scripts/create-mission-art.mjs`. Assets render with explicit dimensions; the hero loads eagerly and below-the-fold visuals use Next Image's default lazy loading. The contribution infographic uses inline SVG icons and a CSS connecting line, horizontal on desktop and vertical on phones.

Section content is in `components/support/mission-support-content.ts`; interaction and the existing form remain in `mission-support-experience.tsx`, with scoped styles in `mission-support.css`. Existing typography, shared header and footer are reused. An optional footer legal-name prop corrects the entity on this page while retaining the shared footer's default behavior elsewhere.

IntersectionObserver handles one-time reveals and contribution-line progress; no animation dependency was added. Reduced-motion users receive visible content without transitions. Funding actions set a visible preference, retain amount/frequency, focus the form and respect reduced motion. The payment API receives the actual preference identifier; new identifiers do not require a schema migration because the stored purpose is a string. Legacy identifiers retain their original labels and meaning.

## Validation and limits

Chrome checks covered desktop, tablet, 390px and 320px layouts, six sections, three funding categories, absence of promotional images, selection/focus feedback, persistence after reload, custom GBP boundaries, journey controls, five native FAQ disclosures, form labels, touch targets, mobile sticky action, vertical pathway, reduced motion and protection against a forged success URL. Screenshots were visually reviewed. No horizontal overflow or browser runtime exceptions were found. The default form retains the original £1–£10,000 range and two-decimal validation.

The six primary text/background combinations were checked numerically against the WCAG normal-text contrast threshold of 4.5:1; results ranged from 4.72:1 to 10.27:1. Native buttons, labels and disclosures preserve keyboard operation, and visible focus indicators are defined for links, buttons and form controls. These checks are not a full independent WCAG conformance audit.

The payment test suite uses a fake provider and in-memory persistence. Its 19 passing tests include checkout retry handling, monthly invoices, deduplication, failure recovery, cancellation, refund confirmation, signatures, and the new preference identifiers' propagation into provider metadata. These tests do not charge a card, send email or write to the live database.

Payment activation is governed by the existing environment settings. Approved contribution terms/allocation wording and remaining production settings are still required; the public page showed checkout unavailable during the audit. No policy was invented and no provider settings were changed. Real Stripe payment, email delivery, portal and refund checks remain deployment responsibilities described in `MISSION_SUPPORT_SETUP.md`.

There are no verified impact metrics or approved classroom photographs in this implementation. No numerical impact claims, beneficiary testimonials, registered-charity claims or Gift Aid benefit are displayed. This refinement does not modify authentication, course checkout, navigation behavior or unrelated page content.
