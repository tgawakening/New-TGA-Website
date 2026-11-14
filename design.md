# Design: The Global Awakening · Sīrah classroom

The locked system for new Sīrah student screens. Studied from https://tga-awakening.com
(homepage + its four same-origin stylesheets, fetched 2026-11-15) and cross-checked
against the source that ships it: `app/globals.css` and `components/seerah/seerah.module.css`.
Derived from those files, not from memory. Change it on purpose; the file is the rule.

## What the site is made of

The site has two strands. New Sīrah screens use the second one.

- **Parent brand (TGA).** Night navy `#030a1f` ground, white ink, sky `#6db4ff`,
  warm `rgb(192 127 78)`. Serif throughout: Marko One display, Poltawski body
  (`--font-marko-one`, `--font-poltawski`, Georgia fallback).
- **Sīrah sub-brand (Beyond Chronology).** What a Sīrah student already knows from
  `/seerah`. Charcoal `#141611` and ivory `#f5efdf` bands, one gold `#d9ad4a`
  signal (deep gold `#735719` on ivory). Georgia display heads, regular weight,
  tight tracking; Montserrat body (`lib/sirah/font.ts`, local files). Square
  edges: buttons and panels carry no radius; rules are 1px hairlines.

## System
- Genre: editorial
- Shape: app screen (a signed-in classroom), long-document rhythm
- Theme: brand (Sīrah), no catalog theme dealt
- Posture: quiet. The live session is the one loud object on the page.

## Tokens
```css
:root {
  --color-paper: #f5efdf;      /* ivory ground */
  --color-paper-2: #ece4cf;    /* banded panel */
  --color-ink: #141611;        /* charcoal */
  --color-ink-2: #41463a;
  --color-muted: #53564c;
  --color-rule: #c6c9b6;
  --color-night: #141611;      /* the live-session band */
  --color-night-ink: #f5efdf;
  --color-night-muted: #c3c3b7;
  --color-accent: #d9ad4a;     /* gold: primary action, live state */
  --color-accent-hover: #e7c879;
  --color-accent-ink: #735719; /* gold text on ivory */
  --color-focus: #735719;
  --font-display: Georgia, "Times New Roman", serif;
  --font-body: var(--font-montserrat), Arial, sans-serif;
  --radius: 0;
  --rule-hair: 1px;
}
```

## Controls
- Primary: gold fill, charcoal text, square, 48px min height, 600 weight, sentence case.
- Secondary: text link with a hairline underline; gold on hover.
- Focus: 3px solid outline, 4px offset, instant.

## Type
- Display: Georgia 400, `clamp(32px, 4vw, 52px)`, letter-spacing -0.02em, one colour.
- Body: Montserrat 16px / 1.7. Labels a step smaller, sentence case, untracked.
- Figures that tick (the countdown) use tabular numerals.

## Motion
- Still. Disclosure opens without animation; no reveal on load.

## Rules carried from the floor
- No eyebrows or tracked capital labels (the marketing page uses them; new screens do not).
- No gradients, no stat tiles, no invented figures, no card inside a card.
- `overflow-x: clip`, never `hidden`.

## Admin screens
Workspace pages live inside the existing Sīrah admin shell (`components/sirah/admin-shell.tsx`)
and use its own light system (`.ga-admin-*` classes, `#173659` ink, `#dbe4ef` rules).

## Variants
- **Classroom editor** (`/admin/sirah/classroom`, 2026-11-16): the content area takes the Sīrah
  palette (ivory canvas, surface cards, gold primary, charcoal outlined secondary) inside the
  workspace shell, so the team edits in the same look students see. Same tokens, no fork.
- **Controls**: inputs and pickers are 44px, 1px `--color-rule-strong` border, a 2px control radius
  (`--radius-control`, the one exception to square edges, so controls read as controls), and a
  2px `--color-focus` outline. No native date, time or select widgets: `components/sirah/classroom-pickers.tsx`
  (listbox, calendar, date + start time) carry the brand.
- **Focus on the charcoal band** is gold (`--color-accent`), elsewhere deep gold (`--color-focus`),
  so every ring holds 3:1 against what is behind it.

## Exports
`app/seerah/classroom/tokens.css` declares these tokens on `[data-theme="sirah-classroom"]`;
student pages and the classroom editor both import it.
