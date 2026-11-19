import type { Metadata, Viewport } from "next";
import { SirahAppProvider } from "@/components/sirah/admin-app";
import styles from "@/components/sirah/admin-app.module.css";

export const metadata: Metadata = {
  title: "Sīrah Admin | TGA",
  applicationName: "TGA Sīrah Admin",
  description: "The TGA Sīrah team workspace for enrolments, scholarships and authorised course tools.",
  manifest: "/admin/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Sīrah Admin", statusBarStyle: "default" },
  other: { "apple-mobile-web-app-capable": "yes" },
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#ffffff" };

/* The theme, brand type and icons come from app/admin/layout.tsx, which wraps
 * every admin page. This layout adds the installable-app provider and the
 * app root (safe-area insets). Styling only: access, data and behaviour are
 * unchanged. */
export default function SirahAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.root}>
      <SirahAppProvider>{children}</SirahAppProvider>
    </div>
  );
}
