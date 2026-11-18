"use client";
import { createContext, useContext } from "react";

/* The registration form's class map. The live page
 * (components/sirah/registration-page.tsx) provides
 * registration.module.css, so /seerah/register renders exactly as before;
 * the /redesign/register preview provides the Indigo stylesheet (same class
 * names). The map is supplied by the page rather than imported here so the
 * preview never loads the live stylesheet (or the fonts bundled with it).
 * Presentation only: no logic reads this. Render the form inside one of the
 * two providers. */
export type RegistrationStyles = Readonly<Record<string, string>>;
const RegistrationStylesContext = createContext<RegistrationStyles>({});
export const RegistrationStylesProvider = RegistrationStylesContext.Provider;
export const useRegistrationStyles = () => useContext(RegistrationStylesContext);
