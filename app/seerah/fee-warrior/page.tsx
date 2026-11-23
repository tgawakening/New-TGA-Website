import type { Viewport } from "next";
import { INDIGO_THEME_COLOR } from "@/components/indigo/indigo-root";

export { default } from "../free-warrior/page";
export const dynamic = "force-dynamic";
export const viewport: Viewport = { themeColor: INDIGO_THEME_COLOR };
