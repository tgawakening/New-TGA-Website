import Link from "next/link";
import { Wordmark } from "./nav";
import styles from "./footer.module.css";

/* Same destinations as the live footer (components/home/sections/footer.tsx).
 * `homeHref` lets the preview route keep in-page anchors on itself. */
function groups(home: string) {
  return [
    {
      title: "Explore",
      links: [
        { label: "Home", href: home },
        { label: "About us", href: "/about" },
        { label: "Our mission", href: `${home}#mission` },
        { label: "Support us", href: "/support-our-mission" },
      ],
    },
    {
      title: "Programs",
      links: [
        { label: "All courses", href: `${home}#courses` },
        { label: "Sīrah course", href: "/seerah" },
        { label: "Gen-Mu'min", href: "/projects/gen-mumin" },
        { label: "Future projects", href: `${home}#projects` },
      ],
    },
    {
      title: "Policies",
      links: [
        { label: "Terms & conditions", href: "/policies/terms-and-conditions" },
        { label: "Terms of service", href: "/policies/terms-of-service" },
        { label: "Code of conduct", href: "/policies/code-of-conduct" },
        { label: "Refund policy", href: "/policies/refund-policy" },
      ],
    },
  ];
}

const social = [
  { label: "Facebook", href: "https://www.facebook.com/profile.php?id=61563366532245" },
  { label: "YouTube", href: "https://www.youtube.com/@Globalawakeningchannel" },
  { label: "Instagram", href: "https://www.instagram.com/global_awakening_channel/" },
];

export function Footer({ homeHref = "/", legalName = "Global Awakening Ltd" }: { homeHref?: string; legalName?: string }) {
  return (
    <footer className={styles.footer}>
      <div className={styles.wrap}>
        <div className={styles.cols}>
          <div className={styles.brand}>
            <Wordmark href={homeHref} />
            <p>Uniting minds, inspiring change. A global Muslim community grounded in the timeless wisdom of the Qur&apos;an.</p>
          </div>
          {groups(homeHref).map((g) => (
            <div key={g.title} className={styles.col}>
              <h2>{g.title}</h2>
              <ul>
                {g.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href}>{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className={styles.contact}>
          <a href="tel:+447886398150">+44 7886 398150</a>
          <a href="mailto:admin@tgaawakening.com">admin@tgaawakening.com</a>
        </div>

        <div className={styles.bottom}>
          <p>
            © {new Date().getFullYear()} {legalName}. All rights reserved.
          </p>
          <ul className={styles.social} aria-label="Global Awakening on social media">
            {social.map((s) => (
              <li key={s.label}>
                <a href={s.href} target="_blank" rel="noreferrer">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
