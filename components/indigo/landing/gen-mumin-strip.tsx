import Link from "next/link";
import { genMuminPrograms } from "@/components/gen-mumin/programs";
import { ProgramIcon } from "@/components/gen-mumin/program-icon";
import { Button } from "../button";
import { SectionHeading } from "../section-heading";
import { genMumin } from "./content";
import s from "./landing.module.css";

/* Phones: a swipeable row (scroll-snap, no JS, no carousel library).
 * Desktop: five equal tiles. */
export function GenMuminStrip() {
  return (
    <section id="gen-mumin" className={s.section} aria-labelledby="gm-title">
      <div className={s.wrap}>
        <SectionHeading id="gm-title" eyebrow={genMumin.eyebrow} title={genMumin.title} lede={genMumin.lede} rule={false} />
        <ol className={s.progs}>
          {genMuminPrograms.map((p, i) => (
            <li key={p.id}>
              <Link href={`${genMumin.href}#gen-mumin-programs`} className={s.prog}>
                <span className={s.progTop}>
                  <span className={s.progIcon}>
                    <ProgramIcon program={p.id} />
                  </span>
                  <span className={s.progN}>{String(i + 1).padStart(2, "0")}</span>
                </span>
                <span className={s.progTitle}>{p.title}</span>
                <span className={s.progSub}>{p.subtitle}</span>
              </Link>
            </li>
          ))}
        </ol>
        <div className={s.stripCta}>
          <Button href={genMumin.href} variant="ghost" arrow>
            Explore Gen-Mu&apos;min
          </Button>
        </div>
      </div>
    </section>
  );
}
