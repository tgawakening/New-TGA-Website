# Sīrah visual polish

The course film now uses a framed editorial presentation, a short visual title, language pills above the player, a prominent play control and a duration/language strip. It preserves click-to-play, the complete portrait frame, native playback controls, saved language preference and pause-on-language-switch. Explanatory language-selection copy has been removed.

The teaching method now uses connected icon steps with a shared, full-width content panel, a large step number and previous/next controls. The original full step names remain the accessible button names. Selected state is communicated by fill, outline, weight and a visible step number; the narrow five-column explanation layout is gone.

Spacing is increased across the middle sections (104px desktop, 80px tablet, 64px mobile), with matching generous pricing padding. Pricing uses a muted olive surface with ivory plan cards. The closing call to action is now its own full-width section outside the FAQ content container; the supplied texture covers the complete section edge to edge while its text remains aligned to the shared content width.

The topic gallery reuses the existing Swiper dependency for seamless looping slides, automatic advancement every 4.6 seconds and manual previous/next arrows, including wrap-around. Autoplay stops on hover, keyboard focus, expanded topic details, offscreen visibility and explicit pause. A play/pause control is provided; reduced-motion users get manual navigation without autoplay. The counter does not continuously announce automatic changes to screen readers. Existing topic artwork, questions and expanded detail content remain intact.

Validation: all five campaign/configuration tests, lint, TypeScript and production build passed. Browser checks passed at 360, 390, 768, 1024 and 1440px for overflow, full-width closing coverage, visual step selection, looping manual/keyboard navigation, video proportions/language switching and main-content WCAG A/AA scanning. Separate motion-enabled checks verified automatic advancement, hover pause/resume, keyboard-focus pause and persistent explicit pause.

Screenshots: [desktop](sirah-registration/visual-1440.png), [mobile](sirah-registration/visual-390.png).
