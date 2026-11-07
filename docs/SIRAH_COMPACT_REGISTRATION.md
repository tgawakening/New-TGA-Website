# Compact registration and mobile hero review

## Reused components

The repository already contained `components/sirah/registration-provider.tsx` and `registration-form.tsx`, plus a separate historical registration component. This change refines the existing native-dialog provider and shared current-course form; it does not replace the backend. The historical owned-order resume path remains intact.

Landing-page hero, header, fee, closing and sticky registration actions open the shared popup. Their links retain `/seerah/register` and validated country/plan preferences for direct entry or opening a new tab. The same form still runs at `/seerah/register`.

The desktop dialog is 670px wide with 28px padding, paired fields, 16px gaps and a maximum height of 90dvh. Mobile fields stack, inputs use at least 16px text, and the dialog scrolls internally. VisualViewport sizing keeps the popup within the visible area as the viewport contracts. Native modal behaviour provides Escape, focus containment and restoration; the close control stays visible while scrolling.

The form remains mounted after closing, retaining in-memory values and passwords on the same page. Only explicitly whitelisted non-password draft fields are saved to session storage for the current tab. Passwords are never placed in browser storage and do not survive a page reload/navigation. Explicitly choosing a different fee card updates its country/plan preference; reopening an unchanged hero action preserves corrected draft values.

## Phone, validation and prices

One phone control combines a flag, calling code and number. Its searchable country list opens only on demand and supports keyboard search/arrows/Enter/Escape. Changing the phone country never erases the entered number or changes billing country. Existing international normalization and calling-code validation remain authoritative on the server; the same schema supplies inline client errors. Native name/email/tel/password/country autofill attributes remain available.

The residence/billing country is independently editable. The compact fee summary calls the existing server pricing endpoint; neither the summary nor the browser can set a payable amount. Required consent, approved terms, receipt review, verification, ownership and payment-method gates remain in the existing post-registration flow. Duplicate submissions are blocked while a request is in flight. Registering an account does not mark payment or enrolment confirmed.

## Orientation groups

A compact Pakistan/Overseas selector sits beside the free-orientation action while the existing campaign is current. It routes to the previously approved public regional groups. A valid hosting country hint (`x-vercel-ip-country`) is used where available; otherwise a browser-locale suggestion is used. The visible selector allows correction. This is an approximate suggestion, not guaranteed IP/GPS geolocation. It does not determine billing, verified enrolment or protected paid-group access.

## Mobile hero

Commit `980ef97` supplied the portrait as `Golden Dawn at Dar al-Arqam.png`. The original is preserved; an identical copy is published as `public/Seerah new/seerah-hero-mobile.png` to match the requested name.

A responsive picture selects this portrait below 768px and keeps the original landscape banner at 768px and above. Mobile copy and registration actions sit in the dark upper area in normal document flow, so the hero grows with text. The artwork below crops excess dark space from the top, keeping the complete doorway/learner visible with bottom positioning. Landscape topic-card frames and 9:16 course films remain unchanged.

## Validation and limitations

- Build, lint, TypeScript and five campaign regression tests passed.
- Popup checks passed at 360, 390, 768, 1024 and 1440px: paired/stacked fields, price updates, field errors, retained drafts/passwords after closure, searchable phone selection, Escape and main dialog accessibility.
- Hero checks passed at 360, 390, 430, 767, 768 and 1440px: correct decoded source, breakpoint, no horizontal overflow and heading/main action above the artwork. Landscape cards and portrait videos are retained.
- Actual isolated HTTP/browser flows covered new account creation, duplicate-submit prevention, inline duplicate-email validation, existing-user login, manual evidence/admin approval and controlled card handoff. The handoff test intercepts a synthetic provider destination; it is not a real gateway sandbox charge.
- Native focus trapping/restoration and focused-input visibility in a shortened viewport were checked. Physical iOS/Android keyboards were not available for hardware testing.
- Hosting country hints are not supplied by every host; the manual orientation region selector remains available.
- Existing payment activation settings and paid-group runtime configuration are unchanged. No database migration is required.

Screenshots: [desktop popup](sirah-registration/compact-1440.png), [mobile popup](sirah-registration/compact-390.png), mobile hero at [360px](sirah-registration/mobile-hero-360.png), [390px](sirah-registration/mobile-hero-390.png), [430px](sirah-registration/mobile-hero-430.png).
