import type { Viewport } from "next";
import { IndigoRoot, INDIGO_THEME_COLOR } from "@/components/indigo/indigo-root";
import { LandingPage } from "@/components/indigo/landing/landing-page";

export const viewport: Viewport = { themeColor: INDIGO_THEME_COLOR };

export default function Home() {
  return (
    <IndigoRoot>
      <LandingPage />
    </IndigoRoot>
  );
}
