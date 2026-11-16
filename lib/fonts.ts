import { Fraunces, Sora } from "next/font/google";

/* Indigo Geometry type. next/font downloads these at build time and serves them
 * from our own origin (no Google request at runtime), subset to Latin, with
 * metric-matched fallbacks so there is no layout shift while they load.
 * The `variable` names are the design-system tokens themselves. */

export const fraunces = Fraunces({
  subsets: ["latin"],
  weight: "variable",
  style: ["normal", "italic"],
  display: "swap",
  variable: "--display",
  fallback: ["Georgia", "Times New Roman", "serif"],
});

export const sora = Sora({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  variable: "--body",
  fallback: ["ui-sans-serif", "system-ui", "Segoe UI", "sans-serif"],
});

/** Apply to the element that should carry the new type (route layout today, <html> at switch-over). */
export const indigoFontVariables = `${fraunces.variable} ${sora.variable}`;
