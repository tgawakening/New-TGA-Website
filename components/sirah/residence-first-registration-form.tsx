"use client";
import { useState, type ComponentProps } from "react";
import { savedResidence } from "@/lib/sirah/use-residence";
import { SirahRegistrationForm } from "./registration-form";

/** The registration form with the register page's country order: a saved
 * residence, then ?country=, then the detected country, then Pakistan. The form
 * already ranks saved over detected over Pakistan, so a saved choice only has
 * to set the link's country aside. Load this client-only, like the form. */
export function ResidenceFirstRegistrationForm({
  initialCountry,
  requireBillingCountry,
  ...form
}: NonNullable<ComponentProps<typeof SirahRegistrationForm>>) {
  const [saved] = useState(savedResidence);
  return (
    <SirahRegistrationForm
      {...form}
      initialCountry={saved ? undefined : initialCountry}
      requireBillingCountry={saved ? false : requireBillingCountry}
    />
  );
}
