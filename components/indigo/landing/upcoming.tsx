import { upcomingCourses } from "@/components/home/data";
import { Button } from "../button";
import { SectionHeading } from "../section-heading";
import s from "./landing.module.css";

/* Same Google Form as the live "Register your interest" button. */
const registerHref = "https://forms.gle/qXhqNy1FF8bNbmfw7";

/* One restrained figure per card, drawn in the card's tone. No posters, no photos. */
const motifs = [
  // Community: two interlocking circles in a square
  <g key="m0">
    <rect x="18" y="18" width="64" height="64" />
    <circle cx="40" cy="50" r="18" />
    <circle cx="60" cy="50" r="18" />
  </g>,
  // Critical thinking: nested squares turning
  <g key="m1">
    <rect x="18" y="18" width="64" height="64" />
    <rect x="27" y="27" width="46" height="46" transform="rotate(15 50 50)" />
    <rect x="36" y="36" width="28" height="28" transform="rotate(30 50 50)" />
  </g>,
  // Emotional intelligence: rings around a star
  <g key="m2">
    <circle cx="50" cy="50" r="34" />
    <rect x="32" y="32" width="36" height="36" />
    <rect x="32" y="32" width="36" height="36" transform="rotate(45 50 50)" />
  </g>,
  // Ethics of debate: two triangles in balance
  <g key="m3">
    <path d="M50 16 82 72H18Z" />
    <path d="M50 84 18 28h64Z" />
    <circle cx="50" cy="50" r="8" />
  </g>,
];

const tones = [s.toneTeal, s.toneTerra, s.toneGold, s.toneTeal];

export function Upcoming() {
  return (
    <section id="projects" className={s.section} aria-labelledby="upcoming-title">
      <div className={s.wrap}>
        <SectionHeading id="upcoming-title" eyebrow="Next launches" title="Upcoming courses" />
        <ul className={s.upcoming}>
          {upcomingCourses.map((c, i) => (
            <li key={c.id} className={`${s.upCard} ${tones[i % tones.length]}`}>
              <svg className={s.upMotif} viewBox="0 0 100 100" aria-hidden="true">
                <g fill="none" stroke="currentColor" strokeWidth="2">
                  {motifs[i % motifs.length]}
                </g>
              </svg>
              <span className={s.upStatus}>{c.status}</span>
              <h3 className={s.upTitle}>{c.title}</h3>
              <p className={s.upTheme}>{c.theme}</p>
              <p className={s.upAudience}>
                <span>For</span> {c.audience}
              </p>
            </li>
          ))}
        </ul>
        <div className={s.stripCta}>
          <Button href={registerHref} arrow>
            Register your interest
          </Button>
        </div>
      </div>
    </section>
  );
}
