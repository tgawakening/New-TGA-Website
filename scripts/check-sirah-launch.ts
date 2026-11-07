/** Read-only App Platform preflight. Never activates a route or creates a payment. */
import "server-only";
import { prisma } from "../lib/prisma";
import {
  publicSirahCohort,
  cohortAllowsPayment,
} from "../services/sirah-cohort.service";
import { spawnSync } from "node:child_process";
import { manualAccounts, methodAvailable, termsFor } from "../lib/sirah/config";

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--providers"))
    throw Error("Only --providers is supported; this command is read-only.");
  if (!process.env.DATABASE_URL)
    throw Error(
      "Run inside the existing App Platform service console; do not copy production credentials into chat.",
    );
  const cohort = await publicSirahCohort();
  const annual = termsFor("ANNUAL");
  console.log(
    JSON.stringify(
      {
        cohort,
        sourceCommitBinding: /^[a-f0-9]{40}$/.test(
          process.env.TGA_SOURCE_COMMIT || "",
        )
          ? process.env.TGA_SOURCE_COMMIT
          : null,
        annualTermsConfigured: !!annual,
        annualTermsVersion: annual?.version || null,
        explicitAccessConsentConfigured:
          !!annual?.earlyServiceRequestText &&
          !!annual?.digitalContentConsentText,
        verifiedReceivingMethods: manualAccounts().map(
          (account) => account.method,
        ),
        routes: ["BANK_TRANSFER", "JAZZCASH"].flatMap((method) =>
          ["ANNUAL", "MONTHLY"].map((plan) => ({
            method,
            plan,
            country: "PK",
            currency: "PKR",
            enabled:
              cohortAllowsPayment(
                termsFor(plan as "ANNUAL" | "MONTHLY"),
                cohort,
              ) &&
              methodAvailable(
                method as "BANK_TRANSFER" | "JAZZCASH",
                "PK",
                "PKR",
                plan as "ANNUAL" | "MONTHLY",
              ),
          })),
        ),
        stripeKeyPresent: !!process.env.SIRAH_STRIPE_SECRET_KEY,
        paypalCredentialsPresent:
          !!process.env.PAYPAL_CLIENT_ID && !!process.env.PAYPAL_CLIENT_SECRET,
        liveChargePerformed: false,
        approvalsEstablishedByThisCheck: false,
      },
      null,
      2,
    ),
  );
  let failed = false;
  const run = (
    label: string,
    file: string,
    arguments_: string[] = [],
    typescript = false,
  ) => {
    console.log(`\n${label}`);
    const result = spawnSync(
      process.execPath,
      [
        ...(typescript ? ["--conditions=react-server", "--import", "tsx"] : []),
        file,
        ...arguments_,
      ],
      {
        stdio: "inherit",
        env: { ...process.env, SIRAH_OPERATIONS_SEND_EMAIL: "false" },
      },
    );
    if (result.error || result.status !== 0) {
      failed = true;
      console.log(`${label}: verification incomplete`);
    }
  };
  run("Read-only migration history", "node_modules/prisma/build/index.js", [
    "migrate",
    "status",
  ]);
  run(
    "Existing registration, receiving-account and notification checks",
    "scripts/check-sirah-production.ts",
    [],
    true,
  );
  if (args.includes("--providers")) {
    run(
      "Existing dedicated Stripe account check",
      "scripts/check-sirah-stripe.ts",
      [],
      true,
    );
    run(
      "Existing PayPal product/plan inventory — no creation",
      "scripts/provision-sirah-paypal-plans.ts",
      [],
      true,
    );
  }
  process.exitCode = failed ? 1 : 0;
}
main()
  .catch(() => {
    console.error("Runtime preflight incomplete; no secrets printed.");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
