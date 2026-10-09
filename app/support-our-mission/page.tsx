import { Suspense } from "react";
import type { Metadata } from "next";
import MissionSupportPage from "@/components/support/mission-support-page";
import { getMissionSupportConfig } from "@/lib/mission-support-config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  referrer: "no-referrer",
  title: "Support Our Mission | The Global Awakening",
  description: "Support The Global Awakening's educational mission. Help expand access to Islamic learning, strengthen programmes, and support future community initiatives.",
  alternates: { canonical: "/support-our-mission" },
};

export default function SupportOurMissionRoute() {
  return (
    <Suspense fallback={null}>
      <MissionSupportPage config={getMissionSupportConfig()} />
    </Suspense>
  );
}
