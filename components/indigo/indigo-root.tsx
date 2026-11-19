import type { ReactNode } from "react";
import { indigoFontVariables } from "@/lib/fonts";
import "@/styles/indigo-motion.css";

/* The Indigo Geometry page root: the Fraunces and Sora font variables and the
 * shared motion stylesheet. Each public page renders inside it. The font
 * variables stay off <html> so pages still outside the new design (sign-in
 * flows, dashboard, policies) do not download the new type. */
export const INDIGO_THEME_COLOR = "#141d33";

export function IndigoRoot({ children }: { children: ReactNode }) {
  return <div className={indigoFontVariables}>{children}</div>;
}
