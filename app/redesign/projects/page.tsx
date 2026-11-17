import type { Metadata } from "next";
import { ProjectsPage } from "@/components/indigo/projects/projects-page";

/* Hidden preview of the redesigned Gen-Mu'min project page. Not linked from
 * the live site; noindex here and in app/redesign/layout.tsx. The live
 * /projects/gen-mumin is unchanged. */
export const metadata: Metadata = {
  title: "Gen Mumin Project · preview",
  robots: { index: false, follow: false },
};

export default function RedesignProjectsPage() {
  return <ProjectsPage homeHref="/redesign" aboutHref="/redesign/about" projectsHref="/redesign/projects" />;
}
