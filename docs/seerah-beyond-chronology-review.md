> Historical initial review notes. The current campaign artwork and registration behaviour are documented in [SEERAH_CAMPAIGN_ASSETS.md](SEERAH_CAMPAIGN_ASSETS.md) and [SIRAH_REGISTRATION_WORKFLOW.md](SIRAH_REGISTRATION_WORKFLOW.md). Asset-related pending items below have since been resolved.

# Sīrah | Beyond Chronology — review version

The `/seerah` route replaces the previous campaign content while reusing the shared Header and Footer. It has six sections, scoped charcoal/ivory/gold styling, locally hosted Montserrat (OFL licence included), a manual/swipe/keyboard topic gallery, inline topic details, native curriculum/FAQ expanders, editable country selection and a mobile action bar.

## Content sources

- User's supplied rebuild brief, 6 November 2026: campaign copy, orientation, outcomes, topics and teaching approach.
- Client's `SIRAH_Website_Pricing_Team_Guide.pdf`, dated 2 November 2026: fixed prices, live teaching, discussion/Q&A and a 12-month programme. The private guide is not published in the repository.
- Existing `/seerah`: WhatsApp orientation group and fee-support route. The course destination is reused for fee enquiries under the user’s latest instruction.

## Configuration

Edit `components/seerah/course-config.ts` for campaign mode, orientation, artwork, approved videos, essentials, curriculum, instructor, features, FAQ and destinations. Edit `regional-fees.ts` for fixed market prices and approved payment links. Prices use major currency units, including three decimal places for BHD and KWD; no live FX is used.

The five prominent country choices are Pakistan, India, UK, USA and Saudi Arabia. The selector includes every market listed by the guide plus a GBP fallback for other countries. Browser locale may suggest a market, but visitors can always change it; no IP geolocation is claimed.

Orientation ends at `2026-11-07T16:00:00Z` (4 PM UK, after the one-hour session). The server renders the current campaign mode and the client checks every 30 seconds. All campaign primary actions share that mode. After expiry they use WhatsApp enquiries while checkout is disabled. Once checkout is explicitly enabled, the approved enrolment destination can be used. Fee cards link to the same course WhatsApp group with “Enquire on WhatsApp”. Enquiry clicks are recorded as WhatsApp events, never checkout starts.

## Items still needed before launch

1. Original second banner file. The images were visible in chat but were not delivered as downloadable image attachments. `hero` and `socialImage` are null, so a typographic fallback appears without broken images. Once supplied, set the path, dimensions and descriptive alternative. Desktop shows the full background; mobile places the copy first and a separate right-focused crop below.
2. Approved new promotional video, thumbnail and caption file. The old video refers to the previous course and is deliberately not presented as the new campaign. Each configured player loads its video source only on click and preserves its supplied aspect ratio.
3. Campaign posters, exact Seerah Doubts subtitles and approved references/quotations. Topic image slots are null, using numbered typographic frames. Portrait posters use `object-fit: contain`; forthcoming clean artwork can set `clean: true` for a 1200 × 750 ratio. No old poster is reassigned to an unrelated topic. Expanded copy uses source-examination questions without invented quotations or citations.
4. Approved curriculum, instructor name/portrait/biography, language, weekly class schedule, recording/resource/access arrangements and reference books. These are hidden until supplied. The curriculum renderer opens its first approved panel by default. Only confirmed FAQ answers are shown.
5. Final cancellation/refund/access policy and tax treatment. The guide explicitly flags the existing instalment-versus-cancellable-subscription conflict. No policy decision has been invented. All checkout links remain null and `checkoutEnabled` is false. Checkout requires the explicit switch, a destination and market terms. Cancellation and refund terms stay unpublished. Monthly cards show the monthly price without a 12-payment total or claims about cancellability or a binding commitment.
6. Verified regional payment routes. The existing registration/payment backend still contains the previous course's prices; the landing page does not direct visitors into that checkout. Backend pricing and provider setup must be aligned and tested before enabling payment destinations. Annual buyers must receive one charge and no recurring subscription.
7. Pakistan recurring verification: the configured online fee is PKR 3,000/month, but `onlineRecurringVerified` is false, so it stays hidden as required by the guide. Visitors see PKR 3,500/month manual, alongside PKR 32,400 annual upfront. Once recurring billing is verified, enable the flag to show online monthly plus the separate manual monthly option. No unsupported annual manual price is invented.

No live deployment, payment, subscription or database migration is performed by this change. The shared header accepts an optional enrolment action. On /seerah its enrolment link becomes the course WhatsApp enquiry while checkout is disabled; other pages keep their existing header behaviour. Shared navigation styling and the footer are preserved.

## Analytics

Distinct events go to `dataLayer`, the existing Meta pixel (`trackCustom`, when loaded), and DOM CustomEvents:

- `seerah_whatsapp_click`: opening the campaign orientation group.
- `seerah_country_select`: explicit visitor selection; locale suggestion is not counted.
- `seerah_checkout_start`: an enabled enrolment/plan action; never a payment success.
- `seerah_enrolment_confirmed`: emitted from authenticated dashboard props only for an active/paid Seerah registration with a server-confirmed payment. Requires a recent landing-page checkout attribution and a registration created after that attribution; deduplicated per registration in browser storage. Does not trust payment URL parameters, count historical enrolments, or transmit registration IDs.

Confirmed events require the site's own registration/dashboard return flow; an external payment destination requires a verified confirmation integration. No successful payment is simulated. Complete end-to-end gateway verification with approved test credentials before activation.

## Validation

Use `npm ci`, `npm run lint`, `npm run test:seerah`, `npm run typecheck`, `npm run build` and `npm run dev` to review locally. Open `/seerah`.

Browser verification covers 1440 px desktop, 820 px tablet and 390 px mobile: no page overflow; three desktop topic cards and a peek of the next mobile card; gallery forward/backward boundary navigation; inline expansion; FAQ expansion; country buttons/selector synchronization; WhatsApp fee-enquiry links with no active checkout; unpublished pending policies; fixed price display and currency precision; orientation expiry; reduced motion and runtime errors. Accessibility scans cover the rebuilt main content. Visual checks inspect the generated screenshots. Actual campaign artwork cropping, new video playback and real gateway destinations remain untestable until the missing files/destinations arrive.

GitHub write access was restored on 7 November 2026. The implementation is pushed to `codex/seerah-beyond-chronology` for review. Artwork, content and payment launch requirements above remain pending.

## Current registration update

The registration workflow supersedes the initial WhatsApp-only primary action. Hero, fees, closing and mobile actions now open the shared current-course registration form, with the orientation remaining separate while current. See [SIRAH_REGISTRATION_WORKFLOW.md](SIRAH_REGISTRATION_WORKFLOW.md) for authoritative server pricing, private receipts, admin review, historical-order compatibility, configuration gates and migration requirements. Campaign artwork/video work remains pending separately.


The supplied campaign assets are now integrated; see [campaign artwork and delivery verification](SEERAH_CAMPAIGN_ASSETS.md). Registration actions now link to the shared registration route, as requested in the latest asset brief.
