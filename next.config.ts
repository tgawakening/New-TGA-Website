import type { NextConfig } from "next";
import { execFileSync } from "node:child_process";

function buildRevision() {
  const supplied =
    process.env.TGA_SOURCE_COMMIT || process.env.VERCEL_GIT_COMMIT_SHA;
  if (supplied && /^[a-f0-9]{40}$/.test(supplied)) return supplied;
  try {
    const revision = execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return /^[a-f0-9]{40}$/.test(revision) ? revision : "unknown";
  } catch {
    return "unknown";
  }
}

const nextConfig: NextConfig = {
  env: { TGA_BUILD_REVISION: buildRevision() },
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  images: {
    // AVIF first (smaller at the same quality), WebP fallback, chosen per
    // browser by the Accept header. Applies only to next/image.
    formats: ["image/avif", "image/webp"],
    // Keep optimised images (and the browser's copy) for 30 days instead of
    // Next's 4-hour default, matching the public/ image policy below, so the
    // slower AVIF encode is not repeated every few hours.
    minimumCacheTTL: 2592000,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "flagcdn.com",
      },
      {
        protocol: "https",
        hostname: "img.youtube.com",
      },
    ],
  },
  // The Indigo redesign was previewed under /redesign; it now serves the live
  // paths. Old preview links land on the live page. Temporary (307), so a
  // restore of the old design is not fighting cached redirects.
  async redirects() {
    return [
      ["/redesign", "/"],
      ["/redesign/about", "/about"],
      ["/redesign/seerah", "/seerah"],
      ["/redesign/projects", "/projects/gen-mumin"],
      ["/redesign/support", "/support-our-mission"],
      ["/redesign/register", "/seerah/register"],
    ].map(([source, destination]) => ({ source, destination, permanent: false }));
  },
  async headers() {
    // Files in public/ are not content-hashed, and Next serves them with
    // "max-age=0" (so Cloudflare bypasses them too). Hashed /_next/static
    // assets already get "max-age=31536000, immutable" from Next itself.
    // Fonts never change in place: one year. Images/video: 30 days, then
    // revalidated in the background, so a file replaced under the same name
    // is picked up within a month (rename it, or purge Cloudflare, to be
    // instant).
    const longCache = "public, max-age=31536000, immutable";
    const mediaCache = "public, max-age=2592000, stale-while-revalidate=86400";
    const cache = (source: string, value: string) => ({ source, headers: [{ key: "Cache-Control", value }] });
    return [
      cache("/fonts/:path*", longCache),
      cache("/brand/:path*", mediaCache),
      cache("/redesign/:path*", mediaCache),
      cache("/images/:path*", mediaCache),
      cache("/videos/:path*", mediaCache),
      // Image files at the top level of public/ (one path segment only).
      cache("/:file([^/]+\\.(?:webp|png|jpe?g|svg|avif|gif))", mediaCache),
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "off",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Origin-Agent-Cluster",
            value: "?1",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
