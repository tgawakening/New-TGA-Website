"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { SirahPlan } from "@/lib/sirah/catalog";
import type { CheckoutSummaryData } from "@/components/sirah/registration-form";
import { RegistrationStylesProvider } from "@/components/sirah/registration-styles";
import { Wordmark } from "../nav";
import { liveLinks, type SiteLinks } from "../site-links";
import { OrderSummary } from "./order-summary";
import form from "./register-form.module.css";
import s from "./register.module.css";

/* The live registration form, loaded client only as /seerah/register loads it.
 * The Indigo class map and the order summary below switch it to the split
 * checkout layout; the wrapper applies the page's country order. */
const SirahRegistrationForm = dynamic(
  () =>
    import("@/components/sirah/residence-first-registration-form").then(
      (m) => m.ResidenceFirstRegistrationForm,
    ),
  {
    ssr: false,
    loading: () => (
      <p className={s.loading} role="status">
        Loading registration…
      </p>
    ),
  },
);

const renderSummary = (summary: CheckoutSummaryData) => <OrderSummary summary={summary} />;

/** /seerah/register in Indigo Geometry: a compact header, then the checkout.
 * The live page's three props, plus the server-detected country; `site` maps
 * the header links and tells the form which page it is on. */
export function RegisterPage({
  initialCountry,
  initialPlan,
  requireBillingCountry,
  detectedCountry,
  site = liveLinks,
}: {
  initialCountry?: string;
  initialPlan?: SirahPlan;
  requireBillingCountry?: boolean;
  detectedCountry?: string;
  site?: SiteLinks;
}) {
  return (
    <div className={s.page}>
      <header className={s.header}>
        <Wordmark href={site.home} />
        <Link href={site.seerah} className={s.back}>
          <span aria-hidden="true">←</span> Back to course
        </Link>
      </header>
      <main className={s.main}>
        <RegistrationStylesProvider value={form}>
          <SirahRegistrationForm
            initialCountry={initialCountry}
            initialPlan={initialPlan}
            requireBillingCountry={requireBillingCountry}
            detectedCountry={detectedCountry}
            registerPath={site.register}
            checkoutSummary={renderSummary}
          />
        </RegistrationStylesProvider>
      </main>
    </div>
  );
}
