import { Footer } from "../footer";
import { Experience } from "../motion/experience";
import { Nav } from "../nav";
import { CommunityCta } from "./community-cta";
import { ConnectAkhirah } from "./connect-akhirah";
import { stats, visionMission } from "./content";
import { Courses } from "./courses";
import { Flagship } from "./flagship";
import { GenMuminStrip } from "./gen-mumin-strip";
import { Hero } from "./hero";
import { Upcoming } from "./upcoming";
import { VisionMission } from "./vision-mission";
import s from "./landing.module.css";

/** `homeHref`: where "Home" and in-page footer anchors point. "/" after switch-over.
 * Section order follows the live home page. */
export function LandingPage({ homeHref = "/" }: { homeHref?: string }) {
  return (
    <div className={s.page} data-experience="">
      <span data-progress="" aria-hidden="true" />
      <a href="#main" className={s.skip}>
        Skip to content
      </a>
      <Nav homeHref={homeHref} />
      <main id="main">
        <Hero />
        <Flagship />
        <VisionMission panels={visionMission} stats={stats} />
        <ConnectAkhirah />
        <GenMuminStrip />
        <Courses />
        <Upcoming />
        <CommunityCta />
      </main>
      <Footer homeHref={homeHref} />
      <Experience />
    </div>
  );
}
