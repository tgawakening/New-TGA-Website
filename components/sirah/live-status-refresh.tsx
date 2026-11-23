"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

const EVERY_MS = 60_000;

/** While a class is not yet joinable, re-render the server component once a
 * minute (only while the tab is visible), so Join turns into a link as soon
 * as the host starts the meeting early and Zoom reports it LIVE. */
export function LiveStatusRefresh() {
  const router = useRouter();
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, EVERY_MS);
    return () => window.clearInterval(id);
  }, [router]);
  return null;
}
