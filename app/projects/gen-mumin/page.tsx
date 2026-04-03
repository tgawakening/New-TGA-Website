import type { Metadata } from "next";
import GenMuminPage from "@/components/gen-mumin/gen-mumin-page";

export const metadata: Metadata = {
  title: "Gen-Mumin Project | Global Awakening",
  description: "Explore the Gen-Mumin project overview, program path, and future learning journey for young Muslims.",
};

export default function GenMuminRoute() {
  return <GenMuminPage />;
}
