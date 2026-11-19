/* Where the Indigo pages link to each other. Components default to
 * `liveLinks`; the `site` prop stays so a page can supply its own map.
 * Sign-in, dashboard and policy links are never remapped. */
export type SiteLinks = {
  home: string;
  about: string;
  seerah: string;
  projects: string;
  support: string;
  /** The Sīrah registration page (query parameters are added by callers). */
  register: string;
};

export const liveLinks: SiteLinks = {
  home: "/",
  about: "/about",
  seerah: "/seerah",
  projects: "/projects/gen-mumin",
  support: "/support-our-mission",
  register: "/seerah/register",
};

/** Main navigation. The live header's "Courses" and "Projects" are dropdowns
 * with one child each, so they link straight to that child. */
export const navLinksFor = (site: SiteLinks) => [
  { label: "Home", href: site.home },
  { label: "About", href: site.about },
  { label: "Courses", href: site.seerah },
  { label: "Projects", href: site.projects },
];
