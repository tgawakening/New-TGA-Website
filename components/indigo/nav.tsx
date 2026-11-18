import Link from "next/link";
import { Button } from "./button";
import { EnrolLink, type EnrolAction } from "./enrol-link";
import styles from "./nav.module.css";
import { BrandLogo } from "@/components/brand-logo";
import { liveLinks, navLinksFor, type SiteLinks } from "./site-links";

export type NavLink = { label: string; href: string };

/** The live destinations (components/indigo/site-links.ts). */
export const defaultNavLinks: NavLink[] = navLinksFor(liveLinks);

/** The real TGA logo, pre-sized (components/brand-logo.tsx). */
export function Wordmark({ href = "/", size = "nav" }: { href?: string; size?: "nav" | "footer" }) {
  return (
    <Link href={href} className={`${styles.logo} ${size === "footer" ? styles.logoFooter : ""}`}>
      <BrandLogo
        alt="The Global Awakening"
        sizes={size === "footer" ? "150px" : "(min-width: 64rem) 160px, 112px"}
        priority={size === "nav"}
        className={styles.logoImg}
      />
    </Link>
  );
}

export function Nav({
  site = liveLinks,
  links: given,
  enrol,
  support = { href: site.support, label: "Support our mission" },
}: {
  /** Live routes by default; the /redesign preview passes its own. */
  site?: SiteLinks;
  links?: NavLink[];
  /** Replaces the default "Enrol now" link (signed-in visitors still get "Your dashboard"). */
  enrol?: EnrolAction;
  support?: { href: string; label: string };
}) {
  const links = given ?? navLinksFor(site);
  const homeHref = site.home;
  return (
    <header className={styles.header} data-nav="">
      <nav className={styles.bar} aria-label="Main">
        <Wordmark href={homeHref} />

        <ul className={styles.links}>
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className={styles.link}>
                {l.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className={styles.actions}>
          <Button href={support.href} variant="ghost" className={styles.support}>
            {support.label}
          </Button>
          <span className={styles.enrol}>
            <EnrolLink action={enrol} href={site.register} />
          </span>

          {/* Phone menu: a native disclosure (works before and without JavaScript,
           * announces its expanded state); the motion layer adds Escape, outside
           * tap and link tap to close. */}
          <details className={styles.menu} data-menu="">
            <summary className={styles.menuButton}>
              <span className={styles.srOnly}>Menu</span>
              <span className={styles.burger} aria-hidden="true" />
            </summary>
            <div className={styles.sheet}>
              <ul>
                {links.map((l, i) => (
                  <li key={l.href} style={{ "--i": i } as React.CSSProperties}>
                    <Link href={l.href}>{l.label}</Link>
                  </li>
                ))}
                <li style={{ "--i": links.length } as React.CSSProperties}>
                  <Link href={support.href}>{support.label}</Link>
                </li>
              </ul>
              <EnrolLink block action={enrol} href={site.register} />
            </div>
          </details>
        </div>
      </nav>
    </header>
  );
}
