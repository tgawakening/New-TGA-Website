import { CONNECT_PHASES } from "@/components/home/connect-akhira-data";
import { SectionHeading } from "../section-heading";
import { CfaPath } from "./cfa-path";
import s from "./landing.module.css";

/* Connect for Akhirah: four stations on one path, live copy throughout. */
export function ConnectAkhirah() {
  return (
    <section id="connect-for-akhirah" className={`${s.section} ${s.patterned}`} aria-labelledby="cfa-title">
      <div className={s.wrap}>
        <SectionHeading id="cfa-title" eyebrow="Coming soon" title="Connect for Akhirah" />
        <CfaPath phases={CONNECT_PHASES} />
      </div>
    </section>
  );
}
