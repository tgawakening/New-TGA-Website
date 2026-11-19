import type { Metadata, Viewport } from "next";
import { IndigoRoot, INDIGO_THEME_COLOR } from "@/components/indigo/indigo-root";
import { ProjectsPage } from "@/components/indigo/projects/projects-page";

export const metadata: Metadata = {
  title: "Gen-Mumin Project | Global Awakening",
  description: "Explore the Gen-Mumin project overview, program path, and future learning journey for young Muslims.",
};

export const viewport: Viewport = { themeColor: INDIGO_THEME_COLOR };

export default function GenMuminRoute() {
  return (
    <IndigoRoot>
      <ProjectsPage />
    </IndigoRoot>
  );
}
