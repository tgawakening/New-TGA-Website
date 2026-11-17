import { Button } from "../button";
import { Card } from "../card";
import { SectionHeading } from "../section-heading";
import { courseCards } from "./content";
import s from "./landing.module.css";

const toneClass = { teal: s.bTeal, gold: s.bGold, terra: s.bTerra };

export function Courses() {
  return (
    <section id="courses" className={s.section} aria-labelledby="courses-title">
      <div className={s.wrap}>
        <SectionHeading
          id="courses-title"
          eyebrow="Live & active learning"
          title="Our courses"
          lede="Join our growing community of learners with live sessions and expert instructors."
        />
        <ul className={s.courses}>
          {courseCards.map((c, k) => (
            <li key={c.id} data-reveal="" style={{ "--i": k % 3 } as React.CSSProperties}>
              <Card as="article" accentEdge interactive className={s.course}>
                <span className={`${s.badge} ${toneClass[c.tone]}`}>{c.badge}</span>
                <h3 className={s.courseTitle}>{c.title}</h3>
                <p className={s.courseSub}>{c.subtitle}</p>
                {c.mentor ? <p className={s.courseMentor}>with {c.mentor}</p> : null}
                <ul className={s.coursePoints}>
                  {c.points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
                <p className={s.courseMeta}>
                  {c.meta.map((m) => (
                    <span key={m}>{m}</span>
                  ))}
                  {c.rating ? (
                    <span className={s.rating} aria-label={`Rated ${c.rating} out of 5`}>
                      ★ {c.rating}
                    </span>
                  ) : null}
                </p>
                <Button href={c.action.href} variant="soft" block arrow>
                  {c.action.label}
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
