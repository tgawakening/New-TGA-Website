"use client";

import { trackSeerah } from "@/components/seerah/analytics";
import { Button } from "../button";
import { useSiteLinks } from "../site-links-context";

/** Same URL rule as PrimaryAction in components/seerah/seerah-page.tsx:
 * a known country is carried through; an unknown one opens registration
 * asking for it (never a silent fallback to Pakistan pricing). */
export function registerHref({
  country,
  plan,
  requireBillingCountry,
  base = "/seerah/register",
}: {
  country?: string;
  plan?: "MONTHLY" | "ANNUAL";
  requireBillingCountry?: boolean;
  /** The registration page. */
  base?: string;
}) {
  const params = new URLSearchParams();
  if (country) params.set("country", country);
  else if (requireBillingCountry) params.set("country", "OVERSEAS");
  if (plan) params.set("plan", plan);
  const q = params.toString();
  return `${base}${q ? `?${q}` : ""}`;
}

/** A normal link to the registration page; the click is only tracked. */
export function RegisterButton({
  placement,
  block,
  ...target
}: {
  placement: string;
  block?: boolean;
  country?: string;
  plan?: "MONTHLY" | "ANNUAL";
  requireBillingCountry?: boolean;
}) {
  const site = useSiteLinks();
  return (
    <Button
      href={registerHref({ ...target, base: site.register })}
      arrow
      block={block}
      prefetch={false}
      onClick={() => trackSeerah("seerah_registration_open", { placement })}
    >
      Register for the course
    </Button>
  );
}
