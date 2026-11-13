"use client";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import type { SirahPlan } from "@/lib/sirah/catalog";
import styles from "./registration.module.css";

// Same client-only form the course page's dialog renders; no logic changes.
const SirahRegistrationForm = dynamic(
  () =>
    import("./registration-form").then(
      (module) => module.SirahRegistrationForm,
    ),
  {
    ssr: false,
    loading: () => (
      <p className={styles.registerLoading} role="status">
        Loading registration…
      </p>
    ),
  },
);

/** /seerah/register as a dedicated page: compact header, then the form. */
export function SirahRegistrationPage({
  initialCountry,
  initialPlan,
  requireBillingCountry,
}: {
  initialCountry?: string;
  initialPlan?: SirahPlan;
  requireBillingCountry?: boolean;
}) {
  return (
    <div className={styles.registerPage}>
      <header className={styles.registerHeader}>
        <Link href="/" aria-label="The Global Awakening home">
          <Image
            src="/logo.webp"
            alt="The Global Awakening"
            width={220}
            height={74}
            className={styles.registerLogo}
            priority
          />
        </Link>
        <Link href="/seerah" className={styles.registerBack}>
          <span aria-hidden="true">←</span> Back to course
        </Link>
      </header>
      <main className={styles.registerMain}>
        <SirahRegistrationForm
          initialCountry={initialCountry}
          initialPlan={initialPlan}
          requireBillingCountry={requireBillingCountry}
        />
      </main>
    </div>
  );
}
