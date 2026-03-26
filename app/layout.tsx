import type { Metadata } from "next";
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
  icons: {
    icon: [{ url: "/logo.webp", type: "image/webp", sizes: "512x512" }],
    shortcut: [{ url: "/logo.webp", type: "image/webp" }],
    apple: [{ url: "/logo.webp", type: "image/webp", sizes: "180x180" }],
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
      <body className="antialiased">{children}</body>
    </html>
  );
}
