import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    id: "/admin/sirah",
    name: "TGA Sīrah Admin",
    short_name: "Sīrah Admin",
    description: "TGA Sīrah enrolments, scholarships and authorised team tools.",
    start_url: "/admin/sirah",
    scope: "/admin/",
    display: "standalone",
    background_color: "#f3f7fc",
    theme_color: "#1d5b8f",
    lang: "en",
    icons: [
      { src: "/admin-app/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/admin-app/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
    ],
  }, { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" } });
}
