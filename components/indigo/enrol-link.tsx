"use client";

import { useEffect, useState } from "react";
import { Button } from "./button";

/* Same rule as the live header: signed-in students go to their dashboard. */
export function EnrolLink({ block = false }: { block?: boolean }) {
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    const sync = () => setHasSession(document.cookie.includes("ga_session="));
    sync();
    window.addEventListener("focus", sync);
    return () => window.removeEventListener("focus", sync);
  }, []);

  return hasSession ? (
    <Button href="/dashboard" block={block}>
      Your dashboard
    </Button>
  ) : (
    <Button href="/seerah/register" arrow block={block}>
      Enrol now
    </Button>
  );
}
