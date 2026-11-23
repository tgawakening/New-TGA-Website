import type { Viewport } from "next";
import type { ReactNode } from "react";
import { indigoFontVariables } from "@/lib/fonts";
import { ViewerTimeZoneSync } from "@/components/viewer-time-zone-sync";

/* The student classroom (Indigo Geometry). Carries the Fraunces and Sora
 * variables for the classroom pages only; the rest of the site is unchanged.
 * ViewerTimeZoneSync reports the browser's time zone so class times render in
 * the viewer's own zone. */
export const viewport: Viewport = { themeColor: "#141d33" };

export default function ClassroomLayout({ children }: { children: ReactNode }) {
  return (
    <div className={indigoFontVariables}>
      <ViewerTimeZoneSync />
      {children}
    </div>
  );
}
