# Sīrah landing hero review

Base: `main` at `86eea7c09ab799b3ad7baad9edad88be96cc4a45`.
Only the course landing hero's markup and final CSS rules change.

## Layout

Before editing, Chromium computed a 759.77 px hero and picture height at a 1,350 px viewport. The final relative, full-width picture's `1672 / 941` aspect ratio sized the grid row; the centred copy wrapper was only 408.36 px high. Earlier rules included mobile `display: none` on the image, different padding, and a negative picture margin. The final hero rules now explicitly resolve those overrides.

The desktop picture is absolute, right aligned, and retains its native ratio without sizing the section. Copy and equal vertical padding set the height. The existing image is sufficient: its parchment and lettering remain visible without a new asset. Horizontal and vertical fades blend the image edges into the dark background. At tablet widths, only the empty left edge extends outside the section.

One visible H1 contains a small “SĪRAH” line and the larger “Beyond Chronology” title. The introduction is shortened. Both existing action components are reused.

Below 768 px the portrait remains in normal flow after the copy. Its empty upper surface is cropped using a bottom-aligned image; no negative margin pulls the parchment behind the controls. The expanded region selector and consultation action end 16 px before the artwork box, followed by a short fade into the image.

## Verification

- `npm run check`: lint, TypeScript and production build passed.
- `npm run test:seerah`: all six configuration checks passed.
- Headless Chromium checks at 390, 768, 1,350 and 1,440 px: no horizontal overflow; one accessible H1 with the full course name; correct desktop/portrait source.
- Hero heights with the unknown-country region selector visible: 666.38 px (390), 493.09 px (768), 511.36 px (1,350), 527.22 px (1,440). At 1,350 px the top and bottom padding are both 87.75 px.
- At every width, Register for the Course opens the existing registration dialog and its close control works. Both Pakistan and Overseas consultation selections produce the approved public group URLs; each link opens a new tab. WhatsApp navigation was intercepted locally to verify destinations without contacting the service.
- Forcing the desktop copy to 300 px wide grows the hero to 653.72 px and keeps the actions inside the section.
- No registration submission, payment, database migration or production deployment was performed.

Screenshots show the expanded consultation controls with Overseas selected:

- [390 px mobile](hero-390.png)
- [768 px tablet](hero-768.png)
- [1,350 px desktop](hero-1350.png)
- [1,440 px desktop](hero-1440.png)

No reference screenshot was available in this thread; the implementation follows the supplied layout requirements and existing approved artwork.
