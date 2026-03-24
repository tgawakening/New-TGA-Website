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
    icon: "/logo.webp",
    shortcut: "/logo.webp",
    apple: "/logo.webp",
  },
  alternates: {
    canonical: "/",
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
