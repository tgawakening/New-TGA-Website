import "server-only";
import { sirahAccessConsentsComplete, type SirahAccessConsents } from "@/lib/sirah/access-consent";
import type { SirahTerms } from "@/lib/sirah/config";
import { createHash } from "node:crypto";
import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import { decimalToMinor } from "@/lib/sirah/catalog";

import { sirahEvidenceSchema } from "@/lib/sirah/validation";
import { z } from "zod";
import {
  ownedSirahOrder,
  auditSirah,
  SirahError,
} from "./sirah-registration.service";
import { serializable } from "./sirah-confirmation.service";
import {
  queueSirahNotice,
  dispatchSirahNotifications,
} from "./sirah-notifications.service";
export const MAX_SIRAH_RECEIPT_BYTES = 4 * 1024 * 1024;
export async function validateSirahReceipt(data: Uint8Array, filename: string) {
  if (!data.byteLength || data.byteLength > MAX_SIRAH_RECEIPT_BYTES)
    throw new SirahError("Upload a JPG, PNG or PDF up to 4 MB.");
  const type = await fileTypeFromBuffer(data);
  if (
    !type ||
    !["image/jpeg", "image/png", "application/pdf"].includes(type.mime)
  )
    throw new SirahError("The file contents must be a JPG, PNG or PDF.");
  try {
    if (type.mime === "application/pdf") {
      const document = await PDFDocument.load(data, {
        ignoreEncryption: false,
      });
      if (!document.getPageCount() || document.getPageCount() > 100)
        throw Error();
    } else {
      await sharp(data, { limitInputPixels: 20000000 }).raw().toBuffer();
    }
  } catch {
    throw new SirahError(
      "The receipt is damaged, encrypted, or has unsupported content.",
    );
  }
  return {
    data: Buffer.from(data),
    filename:
      filename.replace(/[^a-zA-Z0-9_. -]/g, "_").slice(0, 100) ||
      `receipt.${type.ext}`,
    mime: type.mime,
    sha256: createHash("sha256").update(data).digest("hex"),
  };
}
export async function submitSirahEvidence(
  orderId: string,
  userId: string,
  input: z.infer<typeof sirahEvidenceSchema>,
  file: { data: Uint8Array; name: string } | null,
  acceptedTermsVersion: string,
  accessConsents: SirahAccessConsents = {},
) {
  const order = await ownedSirahOrder(orderId, userId);
  if (order.method !== input.method)
    throw new SirahError(
      "The evidence method does not match your locked order.",
    );
  const terms = order.terms as SirahTerms | null;
  if (!terms?.version || terms.version !== acceptedTermsVersion)
    throw new SirahError(
      "Review and accept your locked payment terms before submitting evidence.",
    );
  if (terms.requiresConfirmedCommencement &&
      (!terms.cohortCommencementDate || !Number.isFinite(Date.parse(terms.cohortCommencementDate))))
    throw new SirahError("A confirmed course commencement date is required before a new payment submission. Contact support if you already transferred.");
  if (!sirahAccessConsentsComplete(terms, accessConsents))
    throw new SirahError("Please make the separate service-start and recording-access choices before submitting payment evidence.");
  if (input.route === "UPLOAD" && !file)
    throw new SirahError(
      "Choose a receipt file, or select the WhatsApp submission route.",
    );
  const receipt = file
    ? await validateSirahReceipt(file.data, file.name)
    : null;
  const claimedAmount = input.amount
    ? decimalToMinor(input.amount, order.currency)
    : null;
  await serializable(async (tx) => {
    const updated = await tx.sirahOrder.updateMany({
      where: {
        id: orderId,
        userId,
        revision: input.revision,
        paymentState: { in: ["UNPAID", "REJECTED", "FAILED"] },
        enrolmentState: { in: ["PENDING", "ACTIVE"] },
      },
      data: { paymentState: "AWAITING_REVIEW", revision: { increment: 1 } },
    });
    if (updated.count !== 1)
      throw new SirahError(
        "This submission has changed or is already being reviewed. Reload before resubmitting.",
        409,
      );
    if (receipt)
      await tx.sirahReceipt.create({
        data: { orderId, revision: input.revision + 1, ...receipt },
      });
    await auditSirah(tx, orderId, `student:${userId}`, "EVIDENCE_SUBMITTED", {
      termsVersion: terms.version,
      cohortCommencementDate: terms.cohortCommencementDate || null,
      cohortRevision: terms.cohortRevision ?? null,
      earlyServiceRequested: accessConsents.earlyServiceRequested === true,
      digitalContentConsented: accessConsents.digitalContentConsented === true,
      earlyServiceRequestText: terms.earlyServiceRequestText || null,
      digitalContentConsentText: terms.digitalContentConsentText || null,
      route: input.route,
      payerName: input.payerName || null,
      transactionReference: input.transactionReference || null,
      paymentDate: input.paymentDate || null,
      claimedAmountMinor: claimedAmount,
      currency: order.currency,
      note: input.note || null,
      receiptHash: receipt?.sha256 || null,
    });
    await queueSirahNotice(
      tx,
      orderId,
      "SUBMITTED",
      String(input.revision + 1),
    );
  });
  await dispatchSirahNotifications(orderId).catch(() => {});
  return {
    message:
      "Your payment submission has been received. Enrolment confirmation follows admin approval.",
  };
}
export async function readSirahReceipt(
  id: string,
  userId: string | null,
  admin: boolean,
) {
  const receipt = await prisma.sirahReceipt.findUnique({
    where: { id },
    include: { order: { select: { userId: true } } },
  });
  if (!receipt || (!admin && receipt.order.userId !== userId))
    throw new SirahError("Receipt not found.", 404);
  return receipt;
}
