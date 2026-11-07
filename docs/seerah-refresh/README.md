# Sīrah hero, regional consultation and Pakistan fee refresh

## Artwork and layout

- Desktop: `public/Seerah new/Seerah desktop hero.png` — 1672 × 941.
- Mobile below 768 px: `public/Seerah new/Seerah mobile hero.png` — 1122 × 1402.
- `<picture>` selects the appropriate Next.js responsive image source. Browser network checks confirm mobile does not request the desktop hero. Both natural aspect ratios are retained, with full-width artwork and no parchment cropping.
- Mobile copy grows in normal flow above the image; the portrait's dark upper area overlaps that matching dark extension. A short blend is confined to the dark image edge, clear of the parchment.
- One H1 displays “Beyond Chronology” and has accessible name “Sīrah | Beyond Chronology”. Description and action labels use the supplied copy.
- Orientation time and country-label rows have equal columns and baselines. The existing campaign expiry controls the schedule and FAQ; no orientation WhatsApp action appears without a separately approved destination.
- The sticky registration bar includes safe-area padding. A ResizeObserver reserves its measured height below final content. The Sīrah route layout supplies `viewport-fit=cover`.

## Approved public consultation destinations

All public Sīrah consultation destinations are in `components/seerah/consultation-config.ts`.

| Visitor / selection | Destination |
| --- | --- |
| Pakistan | https://chat.whatsapp.com/Hhs5PieBzen7YvYnkLF9Fo |
| UK | https://chat.whatsapp.com/Ghr9XgXpncIIFYuWcs45oI — approved Overseas Sīrah group |
| Saudi Arabia | https://chat.whatsapp.com/Ghr9XgXpncIIFYuWcs45oI — approved Overseas Sīrah group |
| Other countries, including an unsupported pricing market such as Japan | Approved Overseas Sīrah group above |
| Failed geolocation with no saved residence | Compact Pakistan/Overseas picker; no WhatsApp link until a region is selected |

An explicit saved residence takes priority over detection. A consultation-region choice is shared across page actions; a later explicit residence choice takes priority. Pricing still falls back to Pakistan independently when detection fails. The location feature does not store visitor IPs.

There are no missing country links under the approved Pakistan/Overseas routing. No separately approved UK-only or Saudi-only consultation destination was supplied, so both use the approved Overseas destination. A standalone general Sīrah destination and a separate orientation destination are **not configured**; unknown visitors get the picker, and the old “Join Free Orientation” action is removed. Do not infer a new destination from the payment-evidence contact number.

The old Prophetic Strategies group URL has been removed from the Sīrah configuration. Hero, fees, FAQ, closing, course-enquiry and unavailable-registration consultation actions use the central configuration. Shared header/footer links were audited; the course navigation label is updated. The sticky bar opens registration, not WhatsApp. Payment-evidence support and paid-student invitations remain separate. Paid invitations retain the existing authenticated, verified-payment flow.

## Pakistan fee display and payable amounts

The landing page visually pairs struck-through **PKR 3,500** with prominent **PKR 3,000**, identified as the automatic-card monthly rate. An availability notice remains when automatic recurring payment is unverified/unavailable. No verification or live-approval flag is changed by this refresh.

The server's fixed catalogue remains authoritative:

- Automatic monthly card: PKR 3,000 due monthly, PKR 36,000 across 12 months.
- Manual monthly transfer/JazzCash: PKR 3,500 due monthly, PKR 42,000 across 12 months.
- Annual: PKR 32,400 once, compared with PKR 36,000 for twelve online monthly payments.

The payment-method selector shows the card/manual explanation only for Pakistan monthly orders. Other countries and annual orders do not receive that note. Before method selection, a PK manual-default quote is labelled “manual payment”. Manual receipt approval and amount acknowledgement remain required. Server-side tests verify both directions of the method switch and capture the PKR 3,000 amount passed into card Checkout. These are isolated synthetic-provider tests, not real Stripe sandbox charges.

## Changed source files

- `app/seerah/layout.tsx` — safe-area viewport metadata for Sīrah routes.
- `components/home/data.ts` — shared course navigation label.
- `components/seerah/course-config.ts` — exact new artwork paths and metadata.
- `components/seerah/consultation-config.ts` — approved public destinations and lookup helpers.
- `components/seerah/consultation-action.tsx` — shared consultation actions and unknown-region picker.
- `components/seerah/seerah-page.tsx` — hero, consultation placements, price comparison and sticky-height observation.
- `components/seerah/seerah.module.css` — artwork proportions, mobile copy, aligned orientation grid, contrast and safe-area clearance.
- `components/sirah/registration-form.tsx` — PK-only payment-method explanation and centrally routed course consultation when registration is unavailable.
- `lib/sirah/use-residence.ts` — distinguishes an actual selected/detected country from the PK pricing fallback.
- `scripts/test-seerah-config.mjs` and `scripts/test-sirah-workflow.ts` — artwork/routing and Pakistan server-price verification.

## Verification and limits

- Layout, selected image source, no desktop-hero request on mobile, preserved image ratio, text/artwork clearance, accessible H1, time/label alignment, price comparison and footer clearance: **320, 375, 390, 430, 768, 1024, 1440 px**.
- Country scenarios: PK, GB, SA, JP, missing geolocation; explicit choice overrides and registration handoff.
- Pakistan method note appears only for PK monthly orders; server manual amount remains PKR 3,500, and changing to GB removes that note.
- Expired orientation schedule/action suppression verified with an after-expiry client clock.
- A WhatsApp-style iPhone user agent and small viewport verify viewport metadata and sticky-bar clearance. **A physical-device WhatsApp in-app browser was not available**, so native toolbar/device validation remains a manual review item.
- Screenshots: `hero-*.png`, `orientation-390.png`, `fees-pk-1440.png`, `whatsapp-viewport-390.png`, `registration-pk-note.png`.
- Real-country IP detection depends on the existing deployment's GeoIP configuration. Missing detection deliberately invokes the picker for consultation and PK fallback for pricing.

Final checks passed: production build, lint, TypeScript, 28 isolated-MySQL workflow tests, six residence/pricing tests and six campaign/configuration tests (40 automated tests total). The optimized-build browser runs passed all seven widths and all five country/failure scenarios described above. No live-payment approvals or production credentials were changed.
