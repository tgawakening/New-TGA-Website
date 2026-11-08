import "server-only";
import type { Prisma } from "@prisma/client";
import type { SirahTerms } from "@/lib/sirah/config";
import type { SirahAccessConsents } from "@/lib/sirah/access-consent";
import type { z } from "zod";
import type { sirahManualSenderSchema } from "@/lib/sirah/registration-payment";
import { queueSirahNotice } from "./sirah-notifications.service";

export type SirahValidatedReceipt = {
  data: Uint8Array<ArrayBuffer>;
  filename: string;
  mime: string;
  sha256: string;
};
export type SirahInitialPayment = {
  acceptedTermsVersion: string;
  accessConsents: SirahAccessConsents;
  manual?: {
    receipt: SirahValidatedReceipt;
    details: z.infer<typeof sirahManualSenderSchema>;
  };
};

/** The receipt, evidence audit and review notice commit with the new registration. */
export async function recordInitialSirahEvidence(
  tx: Prisma.TransactionClient,
  order: {
    id: string;
    userId: string;
    revision: number;
    amountMinor: number;
    currency: string;
  },
  terms: SirahTerms,
  payment: SirahInitialPayment,
) {
  const manual = payment.manual!;
  await tx.sirahReceipt.create({
    data: { orderId: order.id, revision: order.revision, ...manual.receipt },
  });
  const detail = {
    termsVersion: terms.version,
    cohortCommencementDate: terms.cohortCommencementDate || null,
    cohortRevision: terms.cohortRevision ?? null,
    earlyServiceRequested:
      payment.accessConsents.earlyServiceRequested === true,
    digitalContentConsented:
      payment.accessConsents.digitalContentConsented === true,
    earlyServiceRequestText: terms.earlyServiceRequestText || null,
    digitalContentConsentText: terms.digitalContentConsentText || null,
    route: "UPLOAD",
    ...manual.details,
    claimedAmountMinor: order.amountMinor,
    currency: order.currency,
    receiptHash: manual.receipt.sha256,
  };
  await tx.sirahAudit.create({
    data: {
      orderId: order.id,
      actor: `student:${order.userId}`,
      action: "EVIDENCE_SUBMITTED",
      detail: JSON.parse(JSON.stringify(detail)),
    },
  });
  await queueSirahNotice(tx, order.id, "SUBMITTED", String(order.revision));
}
