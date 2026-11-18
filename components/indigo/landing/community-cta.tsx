import { Button } from "../button";
import { Card } from "../card";
import { Rosette } from "../ornaments";
import s from "./landing.module.css";

export function CommunityCta({ registerHref = "/seerah/register" }: { registerHref?: string }) {
  return (
    <section id="community" className={s.section} aria-labelledby="community-title">
      <div className={s.wrap}>
        <Card variant="feature" className={s.cta} data-reveal="">
          <Rosette className={s.ctaRosette} />
          <h2 id="community-title" className={s.ctaTitle}>
            Join our growing community
          </h2>
          <p className={s.ctaBody}>
            Be part of a global movement to unite Muslims through faith, knowledge, and compassion.
          </p>
          <div className={`${s.ctaRow} ${s.ctaCenter}`}>
            <Button href="#courses" arrow>
              Explore courses
            </Button>
            <Button href={registerHref} variant="ghost">
              Start your journey
            </Button>
          </div>
        </Card>
      </div>
    </section>
  );
}
