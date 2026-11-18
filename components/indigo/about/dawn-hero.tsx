import type { CSSProperties } from "react";
import { Eyebrow } from "../section-heading";
import { aboutHero, stats } from "./content";
import s from "./about.module.css";

const i = (n: number) => ({ "--i": n }) as CSSProperties;

/* All art shares one 400-unit square centred on the horizon (200, 200), so only
 * its upper half is ever sky. */
const onArc = (r: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return `${(200 + r * Math.cos(a)).toFixed(2)} ${(200 - r * Math.sin(a)).toFixed(2)}`;
};
const arc = (r: number) => `M${200 - r} 200A${r} ${r} 0 0 1 ${200 + r} 200`;

/* A sundial's ticks along the outer arc: every 5°, longer every 15°. */
const ticks = Array.from({ length: 35 }, (_, k) => {
  const deg = (k + 1) * 5;
  return `M${onArc(197, deg)}L${onArc((k + 1) % 3 ? 192 : 187, deg)}`;
}).join("");

/** A rub el hizb standing on the horizon, where an arc comes to rest. */
function Node({ x, r }: { x: number; r: number }) {
  return (
    <g transform={`translate(${x} 200)`}>
      <rect x={-r} y={-r} width={r * 2} height={r * 2} />
      <rect x={-r} y={-r} width={r * 2} height={r * 2} transform="rotate(45)" />
    </g>
  );
}

/* The sunrise. Everything that moves lives in the sky clip, so the horizon is
 * the one hard edge in the picture and the sun is plainly behind it: it clears
 * the line, its orbiting stars rise and set there. The arcs stay outside the
 * clip and come to rest on the line at gold nodes, so the geometry ends on
 * purpose. CSS only (transform and opacity); no client JavaScript. */
function Sunrise() {
  return (
    <div className={s.stage} aria-hidden="true">
      <div className={s.firstLight} />
      <div className={s.skyClip}>
        <div className={s.sunBox}>
          <div className={s.halo}>
            <div className={s.corona} />
          </div>
          {/* Held still with a point straight up, so the half above the line
            * is symmetrical. The stars carry the motion. */}
          <div className={s.geometry}>
            <svg viewBox="0 0 400 400">
              <g fill="none" stroke="var(--teal)" strokeWidth="1">
                <rect x="75.5" y="75.5" width="249" height="249" transform="rotate(15 200 200)" />
                <rect x="75.5" y="75.5" width="249" height="249" transform="rotate(45 200 200)" />
                <rect x="75.5" y="75.5" width="249" height="249" transform="rotate(75 200 200)" />
              </g>
              <g fill="none" stroke="var(--terrab)" strokeWidth="1">
                <rect x="125" y="125" width="150" height="150" />
                <rect x="125" y="125" width="150" height="150" transform="rotate(45 200 200)" />
              </g>
            </svg>
          </div>
          <div className={`${s.orbit} ${s.orbitOuter}`}>
            <i className={s.star} />
          </div>
          <div className={`${s.orbit} ${s.orbitInner}`}>
            <i className={s.star} />
          </div>
          <div className={s.sunRise}>
            <div className={s.disc} />
          </div>
        </div>
      </div>

      <svg viewBox="0 0 400 400" className={s.arcs}>
        <g fill="none" stroke="#f2c66b">
          <path d={arc(197)} strokeWidth="1" opacity=".6" />
          <path d={ticks} strokeWidth="1" opacity=".42" />
          <path d={arc(120)} strokeWidth="1" opacity=".34" />
        </g>
        <g fill="#f2c66b">
          <Node x={3} r={3.4} />
          <Node x={397} r={3.4} />
          <Node x={80} r={2.4} />
          <Node x={320} r={2.4} />
        </g>
      </svg>

      <span className={s.flare} />
      <span className={s.horizon} />
    </div>
  );
}

/* Signature moment one: the dawn. "Awakening" taken literally, and the horizon
 * becomes the ground the community's numbers stand on. */
export function DawnHero() {
  return (
    <section className={s.hero} aria-labelledby="about-title">
      <div className={s.stars} aria-hidden="true" />

      <div className={`${s.wrap} ${s.heroCopy}`}>
        <div data-rise="" style={i(0)}>
          <Eyebrow>{aboutHero.eyebrow}</Eyebrow>
        </div>
        <h1 id="about-title" className={s.heroTitle} data-rise="" style={i(1)}>
          {aboutHero.titleA} <em>{aboutHero.titleB}</em>
        </h1>
        <p className={s.heroLede} data-rise="" style={i(2)}>
          {aboutHero.lede}
        </p>
      </div>

      <Sunrise />

      <div className={s.ground}>
        <div className={s.wrap}>
          <dl className={s.stats} aria-label="Global Awakening in numbers">
            {stats.map((st, k) => (
              <div key={st.label} className={s.stat} data-rise="" style={i(4 + k * 0.5)}>
                <dt>{st.label}</dt>
                <dd>
                  <span data-count={st.value}>{st.n}</span>
                  <span data-suffix="">{st.suffix}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
