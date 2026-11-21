import type { Metadata, Viewport } from "next";
import { INDIGO_THEME_COLOR } from "@/components/indigo/indigo-root";
import FeeWaiverPage from "../free-warrior/page";
export const metadata: Metadata = {
  title: "Batch 4 Sīrah Scholarships | The Global Awakening",
  description: "Apply for one of ten Sīrah | Beyond Chronology Batch 4 scholarships. Selection considers learning, commitment, service and community contribution.",
};
export const dynamic = "force-dynamic";
export const viewport: Viewport = { themeColor: INDIGO_THEME_COLOR };
export default FeeWaiverPage;
