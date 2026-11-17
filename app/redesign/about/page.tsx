import type { Metadata } from "next";
import { previewLinks } from "@/components/indigo/site-links";
import { AboutPage } from "@/components/indigo/about/about-page";

/* Hidden preview of the redesigned About page. Not linked from the live site;
 * noindex here and in app/redesign/layout.tsx. The live /about is unchanged. */
export const metadata: Metadata = {
  title: "About Global Awakening · preview",
  robots: { index: false, follow: false },
};

export default function RedesignAboutPage() {
  return <AboutPage site={previewLinks} />;
}
