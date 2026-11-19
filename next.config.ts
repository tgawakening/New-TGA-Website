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
    return [
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
