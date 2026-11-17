"use client";

import { useEffect, useState } from "react";
import { Button } from "./button";

export type EnrolAction = { href: string; label: string; onClick?: () => void };

/* Same rule as the live header: signed-in students go to their dashboard.
 * `action` replaces the default link (the Sīrah page passes its register
 * link with the visitor's country preselected, as the live header does). */
export function EnrolLink({ block = false, action }: { block?: boolean; action?: EnrolAction }) {
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
    <Button href={action?.href ?? "/seerah/register"} arrow block={block} onClick={action?.onClick}>
      {action?.label ?? "Enrol now"}
    </Button>
  );
}
