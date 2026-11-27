/**
 * READ-ONLY. Explains why an admin "approve" of a manual Sīrah payment is
 * rejected because its payment event id collides with an existing event.
 *
 *   node --env-file=.env.local --conditions=react-server --import tsx \
 *     scripts/diagnose-sirah-approval.ts <userId | orderId> [transactionReference]
 *
 * Mirrors the event id built in actOnSirahOrder (services/sirah-admin.service.ts):
 *   manual:<method>:sha256(reference)
 * where reference = admin-entered reference || latest submitted evidence
 * reference || TGA-REVIEW-<orderId>-<revision>. Issues SELECTs only.
 */
import { createHash } from "node:crypto";
import { prisma } from "../lib/prisma";

async function main() {
  const [id, adminReference] = process.argv.slice(2);
  if (!id) throw new Error("Pass a user id or Sīrah order id.");
  const orders = await prisma.sirahOrder.findMany({
    where: { OR: [{ id }, { userId: id }] },
    select: {
      id: true, reference: true, batchCode: true, method: true, plan: true,
      amountMinor: true, currency: true, paymentState: true, enrolmentState: true,
      paidCount: true, revision: true, archivedAt: true,
      events: { select: { id: true, amountMinor: true, currency: true, kind: true, createdAt: true } },
    },
  });
  if (!orders.length) return console.log("No Sīrah order found for", id);
  for (const order of orders) {
    const evidence = await prisma.sirahAudit.findFirst({
      where: { orderId: order.id, action: "EVIDENCE_SUBMITTED" },
      orderBy: { createdAt: "desc" },
      select: { detail: true, createdAt: true },
    });
    const submitted = (evidence?.detail as { transactionReference?: unknown } | null)?.transactionReference;
    const submittedReference = typeof submitted === "string" ? submitted.trim() : "";
    const reference = adminReference?.trim() || submittedReference || `TGA-REVIEW-${order.id}-${order.revision}`;
    const eventId = order.method
      ? `manual:${order.method}:${createHash("sha256").update(reference).digest("hex")}`
      : null;
    const seen = eventId
      ? await prisma.sirahPaymentEvent.findUnique({
          where: { id: eventId },
          select: {
            orderId: true, amountMinor: true, currency: true, kind: true, createdAt: true,
            order: { select: { reference: true, batchCode: true, paymentState: true } },
          },
        })
      : null;
    console.log(JSON.stringify({
      order: { ...order, events: undefined },
      existingEventsOnThisOrder: order.events,
      latestEvidenceAt: evidence?.createdAt ?? null,
      approvalReference: reference,
      referenceSource: adminReference?.trim() ? "admin" : submittedReference ? "student-submitted" : "internal-review",
      eventId,
      collision: seen
        ? {
            ...seen,
            sameOrder: seen.orderId === order.id,
            amountMatches: seen.amountMinor === order.amountMinor,
            currencyMatches: seen.currency === order.currency,
          }
        : null,
    }, null, 2));
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
