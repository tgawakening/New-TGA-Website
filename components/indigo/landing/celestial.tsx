import c from "./celestial.module.css";

/* Celestial variant of the hero geometry, for comparison on /redesign. It adds
 * to the existing Rig instead of replacing it: the rings keep their rotation
 * and read as orbits, and each body shares its ring's parallax depth so it stays
 * on that ring. Server-rendered, no client JavaScript. Hidden layers are
 * display:none, so they cost nothing until selected. */

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
      {/* Centered variant only: recesses the rings, leaving the sun above it */}
      <div className={c.ringVeil} />
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

/** Preview-only control. Remove it, and the unchosen variants, once a hero is picked. */
export function GeometrySwitch() {
  return (
    <div className={c.switch} role="radiogroup" aria-label="Hero geometry, preview only">
      <span className={c.switchTag}>Dev preview</span>
      <label className={c.option}>
        <input className={c.pick} type="radio" name="hero-geometry" value="current" defaultChecked />
        <span>Current</span>
      </label>
      <label className={c.option}>
        <input className={`${c.pick} ${c.pickCelestial}`} type="radio" name="hero-geometry" value="celestial" />
        <span>Celestial</span>
      </label>
      <label className={c.option}>
        <input
          className={`${c.pick} ${c.pickCelestial} ${c.pickCentered}`}
          type="radio"
          name="hero-geometry"
          value="centered"
        />
        <span>Centered</span>
      </label>
    </div>
  );
}
