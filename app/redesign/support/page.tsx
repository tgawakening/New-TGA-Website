import type { Metadata } from "next";
import { SupportPage } from "@/components/indigo/support/support-page";
import { donationCountries, manualDonationAccounts } from "@/lib/mission-payment-options";
import { getMissionSupportConfig } from "@/lib/mission-support-config";

/* Hidden preview of the redesigned Support Our Mission page. Not linked from
 * the live site; noindex here and in app/redesign/layout.tsx. The live
 * /support-our-mission is unchanged. Same server config and the same
 * checkout, confirmation and billing APIs. Stripe and PayPal still return
 * donors to the live /support-our-mission (set server-side), which is right
 * for a preview. */
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Support Our Mission · preview",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

const pick = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function RedesignSupportPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  return (
    <SupportPage
      config={getMissionSupportConfig()}
      // Built here so the country dataset never ships to the browser.
      countries={donationCountries}
      accounts={manualDonationAccounts}
      params={{
        payment: pick(q.payment),
        provider: pick(q.provider),
        token: pick(q.token),
        donationId: pick(q.donationId),
        session_id: pick(q.session_id),
        manage: pick(q.manage),
      }}
      homeHref="/redesign"
      aboutHref="/redesign/about"
      projectsHref="/redesign/projects"
      seerahHref="/redesign/seerah"
    />
  );
}
