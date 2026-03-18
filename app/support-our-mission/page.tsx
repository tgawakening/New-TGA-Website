import { Suspense } from "react";
import MissionSupportPage from "@/components/support/mission-support-page";

export default function SupportOurMissionRoute() {
  return (
    <Suspense fallback={null}>
      <MissionSupportPage />
    </Suspense>
  );
}
