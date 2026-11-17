/* Where the redesigned pages link to each other. Live pages use the live
 * routes (the default everywhere); the hidden /redesign preview passes
 * `previewLinks`, so the whole new site is clickable as one preview.
 * Registration, sign-in, dashboard and policy links are never remapped:
 * they are the real flows, with no preview copy. */
export type SiteLinks = {
  home: string;
  about: string;
  seerah: string;
  projects: string;
  support: string;
};

export const liveLinks: SiteLinks = {
  home: "/",
  about: "/about",
  seerah: "/seerah",
  projects: "/projects/gen-mumin",
  support: "/support-our-mission",
};

export const previewLinks: SiteLinks = {
  home: "/redesign",
  about: "/redesign/about",
  seerah: "/redesign/seerah",
  projects: "/redesign/projects",
  support: "/redesign/support",
};

/** Main navigation. The live header's "Courses" and "Projects" are dropdowns
 * with one child each, so they link straight to that child. */
export const navLinksFor = (site: SiteLinks) => [
  { label: "Home", href: site.home },
  { label: "About", href: site.about },
  { label: "Courses", href: site.seerah },
  { label: "Projects", href: site.projects },
];
