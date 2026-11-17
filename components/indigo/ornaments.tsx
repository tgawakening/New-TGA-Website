/* Indigo Geometry ornaments. Inline SVG, stroke-only, coloured by currentColor
 * so they take a token colour from their parent. Decorative unless titled. */

type OrnamentProps = {
  className?: string;
  /** Give a title only when the ornament carries meaning (e.g. the logo link has its own label, so it does not). */
  title?: string;
};

function a11y(title?: string) {
  return title ? { role: "img" as const, "aria-label": title } : { "aria-hidden": true as const };
}

/** Rub el hizb: two squares at 45°, a filled centre. The logo mark. */
export function SealMark({ className, title }: OrnamentProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} focusable="false" {...a11y(title)}>
      <g fill="none" stroke="currentColor" strokeWidth="4">
        <rect x="22" y="22" width="56" height="56" />
        <rect x="22" y="22" width="56" height="56" transform="rotate(45 50 50)" />
      </g>
      <circle cx="50" cy="50" r="7" fill="currentColor" />
    </svg>
  );
}

/** Eight-point star outline: the small accent glyph (kickers, program tiles). */
export function Star8({ className, title }: OrnamentProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} focusable="false" {...a11y(title)}>
      <g fill="none" stroke="currentColor" strokeWidth="5">
        <rect x="18" y="18" width="64" height="64" />
        <rect x="18" y="18" width="64" height="64" transform="rotate(45 50 50)" />
      </g>
    </svg>
  );
}

/**
 * Rosette: three squares at 30° (outer) and three at 15° offsets (inner) inside two rings.
 * The inner set takes `accentClassName` so it can be tinted terracotta.
 */
export function Rosette({
  className,
  title,
  accentClassName,
}: OrnamentProps & { accentClassName?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} focusable="false" {...a11y(title)}>
      <g fill="none" strokeWidth="1.4" stroke="currentColor">
        <circle cx="100" cy="100" r="92" opacity=".5" />
        <circle cx="100" cy="100" r="70" opacity=".35" />
        <rect x="38" y="38" width="124" height="124" />
        <rect x="38" y="38" width="124" height="124" transform="rotate(30 100 100)" />
        <rect x="38" y="38" width="124" height="124" transform="rotate(60 100 100)" />
        <g className={accentClassName}>
          <rect x="58" y="58" width="84" height="84" transform="rotate(15 100 100)" />
          <rect x="58" y="58" width="84" height="84" transform="rotate(45 100 100)" />
          <rect x="58" y="58" width="84" height="84" transform="rotate(75 100 100)" />
        </g>
        <circle cx="100" cy="100" r="30" />
      </g>
      <circle cx="100" cy="100" r="9" fill="currentColor" />
    </svg>
  );
}

export function ArrowRight({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
