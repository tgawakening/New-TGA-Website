import type { Metadata, Viewport } from "next";
import { IndigoRoot, INDIGO_THEME_COLOR } from "@/components/indigo/indigo-root";
import { AboutPage } from "@/components/indigo/about/about-page";

export const metadata: Metadata = {
  title: "About Global Awakening",
  description:
    "Learn about Global Awakening, a faith-driven education platform raising Akhira-ready leaders through revelation-grounded learning, projects, and community.",
};

export const viewport: Viewport = { themeColor: INDIGO_THEME_COLOR };

export default function AboutRoute() {
  return (
    <IndigoRoot>
      <AboutPage />
    </IndigoRoot>
  );
}
