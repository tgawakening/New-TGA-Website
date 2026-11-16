import Link from "next/link";
import { Button } from "./button";
import { EnrolLink } from "./enrol-link";
import { SealMark } from "./ornaments";
import styles from "./nav.module.css";

export type NavLink = { label: string; href: string };

/* Real destinations. The live header's "Courses" and "Projects" are dropdowns
 * with one child each, so they link straight to that child. */
export const defaultNavLinks: NavLink[] = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Courses", href: "/seerah" },
  { label: "Projects", href: "/projects/gen-mumin" },
];

export function Wordmark({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className={styles.logo} aria-label="The Global Awakening, home">
      <SealMark className={styles.mark} />
      <span className={styles.words}>
        <b>The Global Awakening</b>
        <span>Uniting minds · inspiring change</span>
      </span>
    </Link>
  );
}

export function Nav({ links: given = defaultNavLinks, homeHref = "/" }: { links?: NavLink[]; homeHref?: string }) {
  const links = given.map((l) => (l.href === "/" ? { ...l, href: homeHref } : l));
  return (
    <header className={styles.header}>
      <nav className={styles.bar} aria-label="Main">
        <Wordmark href={homeHref} />

        <ul className={styles.links}>
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href}>{l.label}</Link>
            </li>
          ))}
        </ul>

        <div className={styles.actions}>
          <Button href="/support-our-mission" variant="ghost" className={styles.support}>
            Support our mission
          </Button>
          <span className={styles.enrol}>
            <EnrolLink />
          </span>

          {/* Phone menu: native disclosure, works before (and without) JavaScript. */}
          <details className={styles.menu}>
            <summary className={styles.menuButton} aria-label="Menu">
              <span className={styles.burger} aria-hidden="true" />
            </summary>
            <div className={styles.sheet}>
              <ul>
                {links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href}>{l.label}</Link>
                  </li>
                ))}
                <li>
                  <Link href="/support-our-mission">Support our mission</Link>
                </li>
              </ul>
              <EnrolLink block />
            </div>
          </details>
        </div>
      </nav>
    </header>
  );
}
