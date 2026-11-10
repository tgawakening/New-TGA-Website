"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import {
  consultationForCountry,
  consultationForRegion,
} from "./consultation-config";
import { trackSeerah } from "./analytics";
import styles from "./seerah.module.css";
const ConsultationContext = createContext<{
  country?: string;
  region: string;
  select: (region: string) => void;
}>({ region: "", select: () => {} });
export function ConsultationProvider({
  country,
  children,
  regionChoice,
  onRegionChange,
}: {
  country?: string;
  children: ReactNode;
  regionChoice?: string;
  onRegionChange?: (region: string) => void;
}) {
  const [internalChoice, setInternalChoice] = useState("");
  const choice = regionChoice ?? internalChoice;
  const select = (value: string) => {
    setInternalChoice(value);
    onRegionChange?.(value);
  };
  const region = country ? (country === "PK" ? "PK" : "OVERSEAS") : choice;
  return (
    <ConsultationContext.Provider value={{ country, region, select }}>
      {children}
    </ConsultationContext.Provider>
  );
}
export function ConsultationAction({
  className,
  placement,
  countryOverride,
}: {
  className: string;
  placement: string;
  countryOverride?: string;
}) {
  const context = useContext(ConsultationContext);
  const [localRegion, setLocalRegion] = useState("");
  const country = countryOverride || context.country;
  const region = country
    ? country === "PK"
      ? "PK"
      : "OVERSEAS"
    : context.region || localRegion;
  const url = country
    ? consultationForCountry(country)
    : consultationForRegion(region);
  const select = (value: string) => {
    setLocalRegion(value);
    context.select(value);
  };
  return (
    <div className={styles.consultationAction}>
      {!country && (
        <select
          aria-label={`Sīrah consultation region (${placement})`}
          value={region}
          onChange={(event) => select(event.target.value)}
        >
          <option value="" disabled>
            Select your region
          </option>
          <option value="PK">Pakistan</option>
          <option value="OVERSEAS">Overseas</option>
        </select>
      )}
      {url ? (
        <a
          className={className}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() =>
            trackSeerah("seerah_whatsapp_click", {
              placement,
              intent: "course_consultation",
              country: country || region,
            })
          }
        >
          Ask about the Course <span aria-hidden>↗</span>
        </a>
      ) : (
        <button type="button" className={className} disabled>
          Ask about the Course <span aria-hidden>↗</span>
        </button>
      )}
    </div>
  );
}
