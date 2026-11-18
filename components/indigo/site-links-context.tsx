"use client";
import { createContext, useContext } from "react";
import { liveLinks, type SiteLinks } from "./site-links";

/* For client components deep in a page (the Sīrah register buttons). Live by
 * default; a preview page provides its own map. */
const SiteLinksContext = createContext<SiteLinks>(liveLinks);
export const SiteLinksProvider = SiteLinksContext.Provider;
export const useSiteLinks = () => useContext(SiteLinksContext);
