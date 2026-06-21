import type { MetadataRoute } from "next";
import { policies } from "@/components/policies/policy-content";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://example.com";

function getBaseUrl() {
  try {
    return new URL(siteUrl).toString().replace(/\/$/, "");
  } catch {
    return "https://example.com";
  }
}

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getBaseUrl();

  return [
    {
      url: `${baseUrl}/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/seerah`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/projects/gen-mumin`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.65,
    },
    {
      url: `${baseUrl}/support-our-mission`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    ...policies.map((policy) => ({
      url: `${baseUrl}/policies/${policy.slug}`,
      lastModified: new Date(),
      changeFrequency: "yearly" as const,
      priority: 0.45,
    })),
  ];
}
