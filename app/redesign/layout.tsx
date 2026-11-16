import type { Metadata, Viewport } from "next";
import { indigoFontVariables } from "@/lib/fonts";

/* Preview of the Indigo Geometry redesign. Kept off search engines and out of
 * the sitemap until switch-over. The font variables are applied here, not on
 * <html>, so live pages do not start downloading Fraunces and Sora early. */
export const metadata: Metadata = {
  title: "Global Awakening · Redesign preview",
  robots: { index: false, follow: false },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = {
  themeColor: "#141d33",
};

export default function RedesignLayout({ children }: { children: React.ReactNode }) {
  return <div className={indigoFontVariables}>{children}</div>;
}
