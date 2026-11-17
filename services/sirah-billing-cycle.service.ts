import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SIRAH_BATCH } from "@/lib/sirah/catalog";
import { DEFAULT_SIRAH_CYCLE, validCycle, type BillingCycle } from "@/lib/sirah/billing-cycle";
import { SirahError } from "./sirah-registration.service";

/**
 * The cohort's monthly billing cycle (renewal day, grace day). Falls back to
 * the current cohort's agreed 7th / 15th only when the cohort row does not
 * exist yet; a row with an invalid setting is an error, never a guess.
 */
export async function sirahBillingCycle(
  db: Pick<Prisma.TransactionClient, "sirahCohort"> = prisma,
): Promise<BillingCycle> {
  const row = await db.sirahCohort.findUnique({
    where: { batchCode: SIRAH_BATCH },
    select: { billingDay: true, graceDay: true },
  });
  if (!row) return DEFAULT_SIRAH_CYCLE;
  const cycle = { billingDay: row.billingDay, graceDay: row.graceDay };
  if (!validCycle(cycle))
    throw new SirahError("The cohort billing cycle is misconfigured (billing day 1–28, grace day after it, at most 28).", 500);
  return cycle;
}
