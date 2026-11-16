import { Fraunces, Sora } from "next/font/google";

/* Same faces without <link rel=preload>: for areas where the new type is
 * switched on conditionally (the admin preview). A separate module from
 * lib/fonts.ts on purpose: next/font preloads every face a route imports,
 * so the preloaded instances must not ride along. */
export const frauncesOnDemand = Fraunces({
  subsets: ["latin"],
  weight: "variable",
  style: ["normal", "italic"],
  display: "swap",
  variable: "--display",
  preload: false,
  fallback: ["Georgia", "Times New Roman", "serif"],
});

export const soraOnDemand = Sora({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  variable: "--body",
  preload: false,
  fallback: ["ui-sans-serif", "system-ui", "Segoe UI", "sans-serif"],
});

export const indigoFontVariablesOnDemand = `${frauncesOnDemand.variable} ${soraOnDemand.variable}`;
