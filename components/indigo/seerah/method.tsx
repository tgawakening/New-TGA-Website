"use client";

import { useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { approach, methodSteps } from "./content";
import s from "./seerah.module.css";

/* Five rings, widest first: the report, then each step reads closer. */
const radii = [92, 74, 56, 38, 20];

/* Signature moment two: a closer reading. The course's source-reading method
 * as an aperture. Each step narrows the focus by one ring, from the whole
 * report to the gold point where conclusions are drawn, and the rings already
 * passed stay lit, because every step keeps the earlier ones in view. The
 * reader drives it (buttons, arrow keys); nothing auto-advances. Same steps,
 * labels and copy as the live TeachingApproach. Transform/opacity only. */
export function Method() {
  const [step, setStep] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const go = (k: number, focus = false) => {
    const n = (k + methodSteps.length) % methodSteps.length;
    setStep(n);
    if (focus) buttons.current[n]?.focus();
  };
  const onKey = (e: KeyboardEvent) => {
    const dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!dir) return;
    e.preventDefault();
    go(step + dir, true);
  };
  const current = methodSteps[step];

  return (
    <div className={s.method}>
      <div className={s.aperture} data-step={step} aria-hidden="true">
        <svg viewBox="0 0 200 200">
          {radii.map((r, k) => (
            <g key={r} className={s.ring} data-lit={k <= step ? "" : undefined} data-now={k === step ? "" : undefined}>
              {/* A dim base and a teal copy that fades in: opacity only, no colour transitions. */}
              <circle cx="100" cy="100" r={r} className={s.ringBase} />
              <circle cx="100" cy="100" r={r} className={s.ringLit} />
              {/* a bead on each ring marks where that step sits */}
              <circle cx={100 + r * Math.cos(-Math.PI / 4)} cy={100 + r * Math.sin(-Math.PI / 4)} r="2.4" className={s.bead} />
            </g>
          ))}
          <circle cx="100" cy="100" r="5" className={s.apertureCore} data-lit={step === 4 ? "" : undefined} />
        </svg>
        <span className={s.apertureNum}>0{step + 1}</span>
      </div>

      <div className={s.methodBody}>
        <ol className={s.methodRail} aria-label="Source-reading method">
          {methodSteps.map((m, k) => (
            <li key={m.label}>
              <button
                ref={(el) => {
                  buttons.current[k] = el;
                }}
                type="button"
                aria-pressed={k === step}
                aria-controls="method-panel"
                aria-label={approach[k]}
                className={s.methodStep}
                style={{ "--k": k } as CSSProperties}
                onClick={() => go(k)}
                onKeyDown={onKey}
              >
                <span className={s.methodNo}>0{k + 1}</span>
                <span>{m.label}</span>
              </button>
            </li>
          ))}
        </ol>

        <div id="method-panel" className={s.methodPanel} aria-live="polite" aria-atomic="true">
          <p className={s.methodCount}>A closer reading · 0{step + 1} / 05</p>
          {/* Keyed so the text rises in again on each step */}
          <div key={step} className={s.methodSwap}>
            <h3 className={s.methodTitle}>{current.title}</h3>
            <p className={s.methodText}>{current.text}</p>
          </div>
          <div className={s.methodNav}>
            <button type="button" aria-label="Previous reading step" onClick={() => go(step - 1)}>
              ←
            </button>
            <button type="button" aria-label="Next reading step" onClick={() => go(step + 1)}>
              →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
