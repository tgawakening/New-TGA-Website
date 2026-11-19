"use client";
import { createContext, useContext } from "react";

/* The registration form's class map. /seerah/register
 * (components/indigo/register/register-page.tsx) provides the Indigo
 * stylesheet. The map is supplied by the page rather than imported here so
 * the form carries no stylesheet of its own. Presentation only: no logic
 * reads this. Render the form inside the provider. */
export type RegistrationStyles = Readonly<Record<string, string>>;
const RegistrationStylesContext = createContext<RegistrationStyles>({});
export const RegistrationStylesProvider = RegistrationStylesContext.Provider;
export const useRegistrationStyles = () => useContext(RegistrationStylesContext);
