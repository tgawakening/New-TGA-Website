import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { SirahAppProvider } from "@/components/sirah/admin-app";
import styles from "@/components/sirah/admin-app.module.css";
import { indigoFontVariablesOnDemand } from "@/lib/fonts-on-demand";
import { INDIGO_PREVIEW_COOKIE, INDIGO_PREVIEW_VALUE } from "@/lib/indigo-preview";
import "@/styles/admin-indigo.css";

export const metadata: Metadata = {
  title: "Sīrah Admin | TGA",
  applicationName: "TGA Sīrah Admin",
  description: "The TGA Sīrah team workspace for enrolments, scholarships and authorised course tools.",
  manifest: "/admin/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Sīrah Admin", statusBarStyle: "default" },
  other: { "apple-mobile-web-app-capable": "yes" },
  icons: {
    icon: [{ url: "/admin-app/icon-192.png", type: "image/png", sizes: "192x192" }, { url: "/admin-app/icon-512.png", type: "image/png", sizes: "512x512" }],
    apple: [{ url: "/admin-app/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
  },
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#1d5b8f" };

export default async function SirahAdminLayout({ children }: { children: React.ReactNode }) {
  // Indigo Geometry preview: styling only, opt-in per browser via /redesign/admin.
  const preview = (await cookies()).get(INDIGO_PREVIEW_COOKIE)?.value === INDIGO_PREVIEW_VALUE;
  if (!preview) {
    return <div className={styles.root}><SirahAppProvider>{children}</SirahAppProvider></div>;
  }
  return (
    <div className={`${styles.root} ${indigoFontVariablesOnDemand}`} data-theme="indigo-admin">
      <SirahAppProvider>{children}</SirahAppProvider>
      <p className="indigo-preview-flag">
        Preview · <b>Indigo Geometry</b>
        <a href="/redesign/admin/exit">Exit preview</a>
      </p>
    </div>
  );
}
