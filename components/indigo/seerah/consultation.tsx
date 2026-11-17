"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { trackSeerah } from "@/components/seerah/analytics";
import { consultationForCountry, consultationForRegion } from "@/components/seerah/consultation-config";
import { Button } from "../button";
import s from "./seerah.module.css";

/* Same behaviour as components/seerah/consultation-action.tsx (live), restyled:
 * the WhatsApp destination comes from consultation-config; with a known
 * country it is Pakistan or overseas; otherwise the visitor picks a region
 * once and every "Ask" on the page follows it. Clicks are tracked with the
 * same event and fields. */

const Ctx = createContext<{ country?: string; region: string; select: (r: string) => void }>({
  region: "",
  select: () => {},
});

export function ConsultationProvider({
  country,
  regionChoice,
  onRegionChange,
  children,
}: {
  country?: string;
  regionChoice: string;
  onRegionChange: (r: string) => void;
  children: ReactNode;
}) {
  const region = country ? (country === "PK" ? "PK" : "OVERSEAS") : regionChoice;
  return <Ctx.Provider value={{ country, region, select: onRegionChange }}>{children}</Ctx.Provider>;
}

export function AskAction({ placement, variant = "ghost" }: { placement: string; variant?: "ghost" | "soft" }) {
  const { country, region, select } = useContext(Ctx);
  const [local, setLocal] = useState("");
  const chosen = country ? (country === "PK" ? "PK" : "OVERSEAS") : region || local;
  const url = country ? consultationForCountry(country) : consultationForRegion(chosen);

  return (
    <div className={s.ask}>
      {!country ? (
        <label className={s.region}>
          <span className={s.srOnly}>Sīrah consultation region ({placement})</span>
          <select
            value={chosen}
            onChange={(e) => {
              setLocal(e.target.value);
              select(e.target.value);
            }}
          >
            <option value="" disabled>
              Select your region
            </option>
            <option value="PK">Pakistan</option>
            <option value="OVERSEAS">Overseas</option>
          </select>
        </label>
      ) : null}
      {url ? (
        <Button
          href={url}
          variant={variant}
          onClick={() =>
            trackSeerah("seerah_whatsapp_click", {
              placement,
              intent: "course_consultation",
              country: country || chosen,
            })
          }
        >
          Ask about the course <span aria-hidden="true">↗</span>
        </Button>
      ) : (
        <Button variant={variant} disabled title="Choose your region first">
          Ask about the course <span aria-hidden="true">↗</span>
        </Button>
      )}
    </div>
  );
}
