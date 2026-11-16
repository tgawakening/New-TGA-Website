import { Button } from "../button";
import { Card } from "../card";
import { Rosette } from "../ornaments";
import { Eyebrow } from "../section-heading";
import { flagship } from "./content";
import s from "./landing.module.css";

const numerals = ["I", "II", "III", "IV"];

export function Flagship() {
  return (
    <section id="sirah" className={s.section} aria-labelledby="flagship-title">
      <div className={s.wrap}>
        <Card variant="feature" className={s.flagship}>
          <div className={s.flagGlow} aria-hidden="true" />
          <div className={s.flagGrid}>
            <div>
              <Eyebrow>{flagship.eyebrow}</Eyebrow>
              <h2 id="flagship-title" className={s.flagTitle}>
                {flagship.title}
              </h2>
              <p className={s.flagSub}>{flagship.pillars.map((p) => p.replace("The ", "")).join(" · ")}</p>
              <p className={s.flagBody}>{flagship.body}</p>

              <ul className={s.pillars}>
                {flagship.pillars.map((p, i) => (
                  <li key={p} className={s.pillar}>
                    <span className={s.pillarN}>{numerals[i]}</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>

              <ul className={s.essentials} aria-label="Course format">
                {flagship.essentials.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>

              <Button href={flagship.href} arrow>
                Explore the Sīrah course
              </Button>
            </div>
            <div className={s.flagArt} aria-hidden="true">
              <Rosette className={s.flagRosette} accentClassName={s.rosetteAccentGold} />
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
