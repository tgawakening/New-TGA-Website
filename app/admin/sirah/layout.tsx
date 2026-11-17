import type { Metadata, Viewport } from "next";
import { SirahAppProvider } from "@/components/sirah/admin-app";
import styles from "@/components/sirah/admin-app.module.css";
import { indigoFontVariables } from "@/lib/fonts";
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
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#0f1729" };

/* The Sīrah admin always renders in the Indigo Geometry theme
 * (styles/admin-indigo.css, scoped by data-theme="indigo-admin"). Styling
 * only: access, data and behaviour are unchanged. */
export default function SirahAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${styles.root} ${indigoFontVariables}`} data-theme="indigo-admin">
      <SirahAppProvider>{children}</SirahAppProvider>
    </div>
  );
}
