import type { Metadata } from "next";
import { indigoFontVariables } from "@/lib/fonts";
import "@/styles/admin-indigo.css";

/* Every admin page (the Sīrah workspace, the main dashboard and both sign-in
 * screens) renders in the light admin theme (styles/admin-indigo.css, scoped
 * by data-theme="indigo-admin") with the brand type, Fraunces and Sora.
 * Styling only: access checks, data and behaviour live in the pages. */
export const metadata: Metadata = {
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "64x64" },
      { url: "/brand/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/brand/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/brand/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
  },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`ga-admin-theme ${indigoFontVariables}`} data-theme="indigo-admin">
      {children}
    </div>
  );
}
