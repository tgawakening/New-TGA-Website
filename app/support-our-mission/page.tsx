import type { Metadata, Viewport } from "next";
import { IndigoRoot, INDIGO_THEME_COLOR } from "@/components/indigo/indigo-root";
import { SupportPage } from "@/components/indigo/support/support-page";
import { donationCountries, manualDonationAccounts } from "@/lib/mission-payment-options";
import { getMissionSupportConfig } from "@/lib/mission-support-config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  referrer: "no-referrer",
  title: "Support Our Mission | The Global Awakening",
  description: "Support The Global Awakening's educational mission. Help expand access to Islamic learning, strengthen programmes, and support future community initiatives.",
  alternates: { canonical: "/support-our-mission" },
};

export const viewport: Viewport = { themeColor: INDIGO_THEME_COLOR };

const pick = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function SupportOurMissionRoute({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  return (
    <IndigoRoot>
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
      />
    </IndigoRoot>
  );
}
