"use client";

import { useState } from "react";
import { DivineBondsWaitlist } from "@/components/home/divine-bonds-waitlist";
import { Button } from "../button";

/* Opens the existing Divine Bonds waitlist dialog (same form, same API). */
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
