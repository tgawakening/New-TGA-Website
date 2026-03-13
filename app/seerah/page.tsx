import type { Metadata } from "next";
import SeerahPage from "@/components/seerah/seerah-page";

export const metadata: Metadata = {
  title: "Seerah | Prophetic Strategies",
  description: "Prophetic Strategies and Planning course landing page.",
};

export default function SeerahRoute() {
  return <SeerahPage />;
}
