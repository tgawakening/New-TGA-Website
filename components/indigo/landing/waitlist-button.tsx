"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Button } from "../button";

/* The existing Divine Bonds waitlist dialog (same form, same API), loaded only
 * when someone opens it so its country picker and styles stay off first load. */
const DivineBondsWaitlist = dynamic(
  () => import("@/components/home/divine-bonds-waitlist").then((m) => m.DivineBondsWaitlist),
  { ssr: false },
);

export function WaitlistButton({ label }: { label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="soft" onClick={() => setOpen(true)} aria-haspopup="dialog">
        {label}
      </Button>
      {open ? <DivineBondsWaitlist onClose={() => setOpen(false)} /> : null}
    </>
  );
}
