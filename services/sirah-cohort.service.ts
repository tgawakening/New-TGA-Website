import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SIRAH_BATCH } from "@/lib/sirah/catalog";
import type { SirahTerms } from "@/lib/sirah/config";
import { serializable } from "./sirah-confirmation.service";
import { SirahError } from "./sirah-registration.service";

// Calendar dates, not invented lesson times. Refund protection is inclusive
// through the date fourteen days after commencement, in Pakistan's time zone.
import { courseStartRefundThrough } from "@/lib/sirah/cohort-dates";
export async function publicSirahCohort(
  db: Pick<Prisma.TransactionClient, "sirahCohort"> = prisma,
) {
  let row;
  let schemaAvailable = true;
  try {
    row = await db.sirahCohort.findUnique({
      where: { batchCode: SIRAH_BATCH },
    });
  } catch (error) {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== "P2021"
    )
      throw error;
    schemaAvailable = false;
  }
  const date =
    row?.confirmedAt && row.commencementAt
      ? row.commencementAt.toISOString().slice(0, 10)
      : null;
  return {
    batchCode: SIRAH_BATCH,
    schemaAvailable,
    confirmed: !!date,
    revision: row?.revision || 0,
    commencementDate: date,
    timeZone: "Asia/Karachi",
    courseStartFullRefundThrough: date ? courseStartRefundThrough(date) : null,
  };
}
export function cohortAllowsPayment(
  terms: SirahTerms | null,
  cohort: Awaited<ReturnType<typeof publicSirahCohort>>,
) {
  return !terms?.requiresConfirmedCommencement || cohort.confirmed;
}
export function snapshotSirahCohort(
  terms: SirahTerms | null,
  cohort: Awaited<ReturnType<typeof publicSirahCohort>>,
) {
  if (!terms || !cohortAllowsPayment(terms, cohort)) return null;
  return {
    ...terms,
    ...(cohort.confirmed
      ? {
          cohortCommencementDate: cohort.commencementDate!,
          cohortRevision: cohort.revision,
        }
      : {}),
  };
}
export async function updateSirahCohort(
  input: {
    revision: number;
    commencementDate: string | null;
    ownerConfirmed: boolean;
    sourceReference?: string;
    reason: string;
  },
  actor: string,
) {
  if (
    input.commencementDate &&
    (!input.ownerConfirmed || !input.sourceReference?.trim())
  )
    throw new SirahError(
      "Record the course owner's confirmation and reference before confirming a teaching date.",
    );
  if (
    input.commencementDate &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(input.commencementDate) ||
      !Number.isFinite(Date.parse(input.commencementDate)))
  )
    throw new SirahError("Choose a valid first teaching date.");
  await serializable(async (tx) => {
    const previous = await tx.sirahCohort.findUnique({
      where: { batchCode: SIRAH_BATCH },
    });
    if ((previous?.revision || 0) !== input.revision)
      throw new SirahError(
        "The cohort setting changed. Reload before saving.",
        409,
      );
    const at = new Date();
    const change = {
      at: at.toISOString(),
      actor,
      previousCommencementDate:
        previous?.commencementAt?.toISOString().slice(0, 10) || null,
      commencementDate: input.commencementDate,
      sourceReference: input.sourceReference || null,
      reason: input.reason,
    };
    const history = [
      ...(Array.isArray(previous?.history) ? previous.history : []),
      change,
    ] as Prisma.InputJsonValue;
    const data = {
      commencementAt: input.commencementDate
        ? new Date(`${input.commencementDate}T00:00:00.000Z`)
        : null,
      confirmedAt: input.commencementDate ? at : null,
      confirmedBy: input.commencementDate ? actor : null,
      sourceReference: input.commencementDate ? input.sourceReference : null,
      history,
      revision: input.revision + 1,
    };
    if (previous)
      await tx.sirahCohort.update({ where: { batchCode: SIRAH_BATCH }, data });
    else
      await tx.sirahCohort.create({
        data: { batchCode: SIRAH_BATCH, ...data },
      });
  });
  return publicSirahCohort();
}
