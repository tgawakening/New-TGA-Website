import { Footer } from "../footer";
import { Experience } from "../motion/experience";
import { Nav } from "../nav";
import { liveLinks, type SiteLinks } from "../site-links";
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

/** `site`: live routes by default.
 * Section order follows the live home page. */
export function LandingPage({ site = liveLinks }: { site?: SiteLinks }) {
  return (
    <div className={s.page} data-experience="">
      <span data-progress="" aria-hidden="true" />
      <a href="#main" className={s.skip}>
        Skip to content
      </a>
      <Nav site={site} />
      <main id="main">
        <Hero seerahHref={site.seerah} />
        <Flagship seerahHref={site.seerah} />
        <VisionMission panels={visionMission} stats={stats} />
        <ConnectAkhirah />
        <GenMuminStrip projectsHref={site.projects} />
        <Courses seerahHref={site.seerah} />
        <Upcoming />
        <CommunityCta registerHref={site.register} />
      </main>
      <Footer site={site} />
      <Experience />
    </div>
  );
}
