"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { VIEWER_TZ_COOKIE, cleanTimeZone } from "@/lib/time/viewer-zone";

/** Tells the server the browser's own time zone. When the cookie is missing or
 * stale (first visit, or the viewer travelled), it is rewritten and the page
 * re-renders once on the server so every time on it is in the viewer's zone. */
export function ViewerTimeZoneSync() {
  const router = useRouter();
  useEffect(() => {
    const zone = cleanTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    if (!zone) return;
    const current = document.cookie
      .split("; ")
      .find((part) => part.startsWith(`${VIEWER_TZ_COOKIE}=`))
      ?.slice(VIEWER_TZ_COOKIE.length + 1);
    if (current && decodeURIComponent(current) === zone) return;
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${VIEWER_TZ_COOKIE}=${encodeURIComponent(zone)}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
    router.refresh();
  }, [router]);
  return null;
}
