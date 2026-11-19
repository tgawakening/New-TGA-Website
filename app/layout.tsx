import type { Metadata } from "next";
import Script from "next/script";
import { ConfirmDialogHost } from "@/components/confirm-dialog";
import { indigoFontVariables } from "@/lib/fonts";
import "@/styles/tokens.css";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://example.com";

function getMetadataBase() {
  try {
    return new URL(siteUrl);
  } catch {
    return new URL("https://example.com");
  }
}

export const metadata: Metadata = {
  title: "Global Awakening",
  description: "Global Awakening learning platform homepage",
  metadataBase: getMetadataBase(),
  // The tab icon is app/favicon.ico (64×64, 3 KB, the same logo). Pointing
  // icons at the 31 KB /logo.webp made every page download the logo twice.
  icons: {
    apple: [{ url: "/brand/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Global Awakening",
    description: "Global Awakening learning platform homepage",
    url: siteUrl,
    siteName: "Global Awakening",
    images: [
      {
        url: "/logo.webp",
        width: 512,
        height: 512,
        alt: "Global Awakening",
      },
    ],
    locale: "en_GB",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Global Awakening",
    description: "Global Awakening learning platform homepage",
    images: ["/logo.webp"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {/* Meta Pixel, off the critical path. The standard snippet in two parts:
         * 1. A tiny inline stub (no network) defines fbq and queues init and
         *    PageView straight away, so every visit is counted (bounces too) and
         *    early fbq() calls (components/seerah/analytics.ts) are kept.
         * 2. fbevents.js (~205 KB with its config) loads lazyOnload: after the
         *    window load event, in browser idle time. On arrival it replays
         *    the queue, which sends the PageView. Not gated on interaction. */}
        <Script id="meta-pixel" strategy="afterInteractive">
          {`
            !function(f,n){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[]}(window);
            fbq('init', '1003346972858250');
            fbq('track', 'PageView');
          `}
        </Script>
        <Script id="meta-pixel-lib" src="https://connect.facebook.net/en_US/fbevents.js" strategy="lazyOnload" />
        <noscript>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            height="1"
            width="1"
            style={{ display: "none" }}
            src="https://www.facebook.com/tr?id=1003346972858250&ev=PageView&noscript=1"
            alt=""
          />
        </noscript>
        {children}
        {/* Branded confirm / prompt dialog for the whole site (replaces the
         * browser's native confirm and prompt). Renders nothing until asked. */}
        <ConfirmDialogHost className={indigoFontVariables} />
      </body>
    </html>
  );
}
