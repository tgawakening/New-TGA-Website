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

/* The live registration form, loaded exactly as /seerah/register loads it
 * (client only, same props). The Indigo class map and the order summary below
 * are what switch it to the split checkout layout. */
const SirahRegistrationForm = dynamic(
  () => import("@/components/sirah/registration-form").then((m) => m.SirahRegistrationForm),
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
 * Same three props as the live page; `site` maps the header links and tells
 * the form which page it is on. */
export function RegisterPage({
  initialCountry,
  initialPlan,
  requireBillingCountry,
  site = liveLinks,
}: {
  initialCountry?: string;
  initialPlan?: SirahPlan;
  requireBillingCountry?: boolean;
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
            registerPath={site.register}
            checkoutSummary={renderSummary}
          />
        </RegistrationStylesProvider>
      </main>
    </div>
  );
}
