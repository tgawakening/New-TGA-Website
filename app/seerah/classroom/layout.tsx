import type { Viewport } from "next";
import type { ReactNode } from "react";
import { indigoFontVariables } from "@/lib/fonts";

/* The student classroom (Indigo Geometry). Carries the Fraunces and Sora
 * variables for the classroom pages only; the rest of the site is unchanged. */
export const viewport: Viewport = { themeColor: "#141d33" };

export default function ClassroomLayout({ children }: { children: ReactNode }) {
  return <div className={indigoFontVariables}>{children}</div>;
}
