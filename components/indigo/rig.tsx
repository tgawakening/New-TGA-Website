import s from "./rig.module.css";

/* The hero geometry: three stroke-only layers that turn at different speeds and
 * directions (CSS), mounted on wrappers the motion layer shifts by depth under
 * a fine pointer. Inline SVG, no requests. */
export function Rig({ className }: { className?: string }) {
  return (
    <div className={`${s.rig} ${className ?? ""}`} data-rig="" aria-hidden="true">
      <div className={s.glow} />
      {/* Outer rosette: twelve-fold, teal, slowest, clockwise */}
      <div className={s.layer} data-depth="0.35">
        <svg viewBox="0 0 200 200" className={`${s.spin} ${s.spinSlow}`}>
          <g fill="none" stroke="currentColor" strokeWidth="0.8" className={s.tTeal}>
            <circle cx="100" cy="100" r="96" opacity=".35" />
            <circle cx="100" cy="100" r="88" opacity=".2" />
            <rect x="34" y="34" width="132" height="132" />
            <rect x="34" y="34" width="132" height="132" transform="rotate(30 100 100)" />
            <rect x="34" y="34" width="132" height="132" transform="rotate(60 100 100)" />
          </g>
        </svg>
      </div>
      {/* Middle ring: rub el hizb with eight beads, terracotta, counter-clockwise */}
      <div className={s.layer} data-depth="0.8">
        <svg viewBox="0 0 200 200" className={`${s.spin} ${s.spinMid}`}>
          <g fill="none" stroke="currentColor" strokeWidth="1" className={s.tTerra}>
            <rect x="56" y="56" width="88" height="88" />
            <rect x="56" y="56" width="88" height="88" transform="rotate(45 100 100)" />
            <circle cx="100" cy="100" r="62" opacity=".45" />
          </g>
          <g className={s.tTerra} fill="currentColor">
            {Array.from({ length: 8 }, (_, k) => {
              const a = (k * Math.PI) / 4;
              return <circle key={k} cx={100 + 62 * Math.cos(a)} cy={100 + 62 * Math.sin(a)} r="1.8" />;
            })}
          </g>
        </svg>
      </div>
      {/* Inner star: teal, quickest, clockwise; a still gold centre */}
      <div className={s.layer} data-depth="1.3">
        <svg viewBox="0 0 200 200" className={`${s.spin} ${s.spinFast}`}>
          <g fill="none" stroke="currentColor" strokeWidth="1.2" className={s.tTealb}>
            <rect x="74" y="74" width="52" height="52" transform="rotate(15 100 100)" />
            <rect x="74" y="74" width="52" height="52" transform="rotate(60 100 100)" />
            <circle cx="100" cy="100" r="22" />
          </g>
        </svg>
      </div>
      <div className={s.layer} data-depth="1.6">
        <svg viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="6" className={s.tGold} fill="currentColor" />
        </svg>
      </div>
    </div>
  );
}
