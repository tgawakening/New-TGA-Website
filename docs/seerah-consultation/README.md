# Course enquiry button

The public enquiry button below regional fees now has explicit padding, a 52 px tap target, 20 px separation from the description, a dark filled style and visible keyboard focus. It fills the available width on mobile; the unknown-country region selector stacks above it. Removed unused `.groupActions` styles that targeted a previous wrapper. Changes apply only to `.publicGroups`; routing and other consultation controls are unchanged.

Validation: `npm run check` passed (lint, TypeScript, production build). Chromium checks at 390, 768, 1350 and 1440 px confirmed padding, spacing, keyboard focus, no horizontal overflow, the unknown-region disabled state, and both approved regional destinations opening in a new tab. WhatsApp navigation was intercepted locally.

[Desktop](desktop.png) · [Mobile](mobile.png)
