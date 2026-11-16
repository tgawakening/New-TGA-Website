import { CONNECT_PHASES } from "@/components/home/connect-akhira-data";
import { SectionHeading } from "../section-heading";
import { WaitlistButton } from "./waitlist-button";
import s from "./landing.module.css";

const numerals = ["I", "II", "III", "IV"];

/* The four phases as one ordered path. Phones: a vertical line joins the
 * numbered seals. Desktop: two by two. All copy from the live timeline. */
export function ConnectAkhirah() {
  return (
    <section id="connect-for-akhirah" className={s.section} aria-labelledby="cfa-title">
      <div className={s.wrap}>
        <SectionHeading id="cfa-title" eyebrow="Coming soon" title="Connect for Akhirah" />
        <ol className={s.phases}>
          {CONNECT_PHASES.map((p, i) => (
            <li key={p.id} className={s.phase}>
              <span className={s.phaseSeal} aria-hidden="true">
                <svg viewBox="0 0 100 100">
                  <g fill="none" stroke="currentColor" strokeWidth="3">
                    <rect x="20" y="20" width="60" height="60" />
                    <rect x="20" y="20" width="60" height="60" transform="rotate(45 50 50)" />
                  </g>
                </svg>
                <span>{numerals[i]}</span>
              </span>
              <article className={s.phaseCard}>
                <header className={s.phaseHead}>
                  <span className={s.phaseLabel}>Phase {i + 1}</span>
                  <span className={`${s.badge} ${s.bGold}`}>{p.status}</span>
                </header>
                <p className={s.phaseArabic} lang="ar" dir="rtl">
                  {p.arabic}
                </p>
                <h3 className={s.phaseTitle}>{p.title}</h3>
                <p className={s.phaseSub}>{p.subtitle}</p>
                <p className={s.phaseBody}>{p.description}</p>
                <ul className={s.coursePoints}>
                  {p.points.map((pt) => (
                    <li key={pt}>{pt}</li>
                  ))}
                </ul>
                <dl className={s.phaseStats}>
                  {p.stats.map((st) => (
                    <div key={st.label}>
                      <dt>{st.label}</dt>
                      <dd>{st.value}</dd>
                    </div>
                  ))}
                </dl>
                <footer className={s.phaseFoot}>
                  <span className={s.phaseNext}>
                    Leads to <b>{p.leadsTo}</b>
                  </span>
                  {p.id === "divine-bonds" ? (
                    <WaitlistButton label={p.cta} />
                  ) : (
                    <span className={s.phaseSoon}>{p.cta}</span>
                  )}
                </footer>
              </article>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
