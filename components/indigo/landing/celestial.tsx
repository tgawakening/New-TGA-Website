import c from "./celestial.module.css";

/* The hero's celestial layer. It adds to the Rig instead of replacing it: the
 * rings keep their rotation and read as orbits, and each body shares its ring's
 * parallax depth so it stays on that ring. Server-rendered, no client JavaScript. */

/* r is the ring radius in the Rig's 200-unit viewBox, set in the stylesheet. */
const orbits = [
  { depth: "0.35", className: c.outer },
  { depth: "0.8", className: c.mid },
  { depth: "1.3", className: c.inner },
];

/** Deep sky behind the hero. Static: the existing starfield already twinkles. */
export function CelestialSky() {
  return <div className={c.sky} aria-hidden="true" />;
}

/** Sun and orbiting stars, mounted inside the Rig so they inherit its tilt. */
export function CelestialBodies() {
  return (
    <>
      {orbits.map(({ depth, className }) => (
        <div key={depth} className={c.layer} data-depth={depth}>
          <div className={`${c.orbit} ${className}`}>
            <i className={c.star} />
          </div>
        </div>
      ))}
      {/* Same depth as the Rig's gold centre, which the sun sits over */}
      <div className={`${c.layer} ${c.sun}`} data-depth="1.6">
        <div className={c.corona} />
        <svg viewBox="0 0 200 200" className={c.seal}>
          <g fill="none" stroke="currentColor" strokeWidth="0.8">
            <rect x="87" y="87" width="26" height="26" />
            <rect x="87" y="87" width="26" height="26" transform="rotate(45 100 100)" />
          </g>
        </svg>
        <div className={c.core} />
      </div>
    </>
  );
}
