import { Footer } from "../footer";
import { Nav } from "../nav";
import { CommunityCta } from "./community-cta";
import { stats, visionMission } from "./content";
import { Courses } from "./courses";
import { Flagship } from "./flagship";
import { GenMuminStrip } from "./gen-mumin-strip";
import { Hero } from "./hero";
import { VisionMission } from "./vision-mission";
import s from "./landing.module.css";

/** `homeHref`: where "Home" and in-page footer anchors point. "/" after switch-over. */
export function LandingPage({ homeHref = "/" }: { homeHref?: string }) {
  return (
    <div className={s.page}>
      <a href="#main" className={s.skip}>
        Skip to content
      </a>
      <Nav homeHref={homeHref} />
      <main id="main">
        <Hero />
        <Flagship />
        <VisionMission panels={visionMission} stats={stats} />
        <Courses />
        <GenMuminStrip />
        <CommunityCta />
      </main>
      <Footer homeHref={homeHref} />
    </div>
  );
}
