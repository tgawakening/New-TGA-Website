import Image from "next/image";
import Link from "next/link";
import { Button } from "./button";
import { EnrolLink } from "./enrol-link";
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

/** The real TGA logo (public/logo.webp, 640×246), served small by next/image. */
export function Wordmark({ href = "/", size = "nav" }: { href?: string; size?: "nav" | "footer" }) {
  return (
    <Link href={href} className={`${styles.logo} ${size === "footer" ? styles.logoFooter : ""}`}>
      <Image
        src="/logo.webp"
        alt="The Global Awakening"
        width={640}
        height={246}
        sizes={size === "footer" ? "160px" : "(min-width: 64rem) 160px, 112px"}
        priority={size === "nav"}
        className={styles.logoImg}
      />
    </Link>
  );
}

export function Nav({ links: given = defaultNavLinks, homeHref = "/" }: { links?: NavLink[]; homeHref?: string }) {
  const links = given.map((l) => (l.href === "/" ? { ...l, href: homeHref } : l));
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
          <Button href="/support-our-mission" variant="ghost" className={styles.support}>
            Support our mission
          </Button>
          <span className={styles.enrol}>
            <EnrolLink />
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
