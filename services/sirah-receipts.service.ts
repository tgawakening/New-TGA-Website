import "server-only";
import {
  sirahAccessConsentsComplete,
  type SirahAccessConsents,
} from "@/lib/sirah/access-consent";
import type { SirahTerms } from "@/lib/sirah/config";
import { createHash } from "node:crypto";
import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";
import { inspectPdf, type PdfOpenAccess } from "@/lib/sirah/pdf-encryption";
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
import { MAX_SIRAH_RECEIPT_BYTES } from "@/lib/sirah/registration-payment";
import { readDirectUpload, verifyDirectUpload } from "@/lib/sirah/direct-upload";
import { ADMIN_EVIDENCE_TYPES, ADMIN_RECEIPT_UPLOADED, UPLOAD_MAX_BYTES } from "@/lib/sirah/direct-upload-policy";
export { MAX_SIRAH_RECEIPT_BYTES };
export async function validateSirahReceipt(data: Uint8Array, filename: string, maxBytes = MAX_SIRAH_RECEIPT_BYTES) {
  if (!data.byteLength || data.byteLength > maxBytes)
    throw new SirahError("Upload a JPG, PNG, WebP or PDF up to 4 MB.");
  const type = await fileTypeFromBuffer(data);
  if (
    !type ||
    !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(type.mime)
  )
    throw new SirahError("The file contents must be a JPG, PNG, WebP or PDF.");
  let pdfAccess: PdfOpenAccess = "NONE";
  try {
    if (type.mime === "application/pdf") {
      // Bank e-receipts are often encrypted only to restrict printing/copying;
      // they still open without a password. Load the structure regardless,
      // then decide from the security handler whether it opens freely.
      const pdf = await inspectPdf(data);
      pdfAccess = pdf.access;
      if (pdf.pages !== null && (!pdf.pages || pdf.pages > 100)) throw Error();
    } else {
      await sharp(data, { limitInputPixels: 20000000 }).raw().toBuffer();
    }
  } catch {
    throw new SirahError(
      "The receipt is damaged or has unsupported content. Upload a screenshot (JPG or PNG) instead.",
    );
  }
  if (pdfAccess === "PASSWORD_REQUIRED")
    throw new SirahError(
      "This PDF needs a password to open. Upload a screenshot of the receipt (JPG or PNG), or a copy saved without a password.",
    );
  if (pdfAccess === "UNSUPPORTED")
    throw new SirahError(
      "This PDF uses protection we can't open. Upload a screenshot of the receipt (JPG or PNG) instead.",
    );
  return {
    data: Buffer.from(data),
    filename:
      filename.replace(/[^a-zA-Z0-9_. -]/g, "_").slice(0, 100) ||
      `receipt.${type.ext}`,
    mime: type.mime,
    sha256: createHash("sha256").update(data).digest("hex"),
  };
}
/** A receipt staff received outside the site (WhatsApp, email): PNG, JPG or PDF up to 5 MB. */
export async function validateAdminSirahReceipt(data: Uint8Array, filename: string) {
  const maxBytes = UPLOAD_MAX_BYTES["admin-evidence"];
  if (!data.byteLength || data.byteLength > maxBytes)
    throw new SirahError(`Upload a PNG, JPG or PDF up to ${maxBytes / 1024 / 1024} MB.`);
  const receipt = await validateSirahReceipt(data, filename, maxBytes);
  if (!ADMIN_EVIDENCE_TYPES.includes(receipt.mime))
    throw new SirahError("The file contents must be a PNG, JPG or PDF.");
  return receipt;
}

/**
 * Staff attach a receipt the student sent outside the site. Stored exactly as
 * a student receipt (same table, same private storage, same protected link);
 * evidence only: payment and enrolment state are not changed. The order's
 * revision moves to the receipt's revision so receipt versions stay unique
 * and any open stale form reloads before acting.
 */
export async function attachAdminSirahReceipt(
  orderId: string,
  token: string,
  actor: string,
  note?: string,
) {
  const uploaded = await verifyDirectUpload(token, "admin-evidence", orderId, actor);
  const validated = await validateAdminSirahReceipt(
    await readDirectUpload(uploaded.key),
    uploaded.filename,
  );
  return serializable(async (tx) => {
    const order = await tx.sirahOrder.findUnique({
      where: { id: orderId },
      select: {
        revision: true,
        archivedAt: true,
        receipts: { select: { revision: true }, orderBy: { revision: "desc" }, take: 1 },
      },
    });
    if (!order) throw new SirahError("Registration not found.", 404);
    if (order.archivedAt) throw new SirahError("Restore this registration before attaching a receipt.", 409);
    if (await tx.sirahReceipt.findUnique({ where: { storageKey: uploaded.key }, select: { id: true } }))
      throw new SirahError("This receipt is already attached.", 409);
    const revision = Math.max(order.revision, order.receipts[0]?.revision ?? 0) + 1;
    const updated = await tx.sirahOrder.updateMany({
      where: { id: orderId, revision: order.revision },
      data: { revision },
    });
    if (updated.count !== 1)
      throw new SirahError("This registration has just changed. Reload and try again.", 409);
    const receipt = await tx.sirahReceipt.create({
      data: {
        orderId,
        revision,
        filename: validated.filename,
        mime: validated.mime,
        sha256: validated.sha256,
        storageKey: uploaded.key,
        data: new Uint8Array(0),
      },
      select: { id: true },
    });
    await auditSirah(tx, orderId, actor, ADMIN_RECEIPT_UPLOADED, {
      receiptId: receipt.id,
      revision,
      filename: validated.filename,
      mime: validated.mime,
      sizeBytes: validated.data.byteLength,
      receiptHash: validated.sha256,
      note: note?.trim() || null,
    });
    return { id: receipt.id, revision };
  });
}

export async function submitSirahEvidence(
  orderId: string,
  userId: string,
  input: z.infer<typeof sirahEvidenceSchema>,
  file: { data: Uint8Array; name: string } | import("./sirah-manual-submission.service").SirahValidatedReceipt | null,
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
  if (
    terms.requiresConfirmedCommencement &&
    (!terms.cohortCommencementDate ||
      !Number.isFinite(Date.parse(terms.cohortCommencementDate)))
  )
    throw new SirahError(
      "A confirmed course commencement date is required before a new payment submission. Contact support if you already transferred.",
    );
  if (!sirahAccessConsentsComplete(terms, accessConsents))
    throw new SirahError(
      "Please make the separate service-start and recording-access choices before submitting payment evidence.",
    );
  if (input.route === "UPLOAD" && !file)
    throw new SirahError(
      "Choose a receipt file, or select the WhatsApp submission route.",
    );
  const receipt = file
    ? ("name" in file ? await validateSirahReceipt(file.data, file.name) : file)
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
      senderAccount:
        "senderAccount" in input ? input.senderAccount || null : null,
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
