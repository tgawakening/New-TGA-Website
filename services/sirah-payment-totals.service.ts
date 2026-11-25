import "server-only";
import { prisma } from "@/lib/prisma";
import { minorToDecimal } from "@/lib/sirah/catalog";
import {
  sirahMethodLabel,
  sumSirahLedger,
  type SirahPaymentTotals,
} from "@/lib/sirah/payment-totals";
import {
  SIRAH_CSV_MAX_ROWS,
  SIRAH_LEDGER_KINDS,
  SIRAH_RECEIVED_KINDS,
  sirahAdminOrderWhere,
  sirahCsvCell,
  sirahMethodProviders,
  sirahPaidRange,
} from "./sirah-admin.service";

/**
 * READ-ONLY payment reconciliation for the Sīrah admin list. Nothing here
 * writes: it reads the payment ledger for the orders that match the list
 * filters and adds it up.
 *
 * - Only records counted in analytics (never excluded test / junk rows or the
 *   archive), whatever records view the list is showing.
 * - Only money that moved: verified payments received (FIRST / RENEWAL ledger
 *   events) and recorded refunds. Pending, awaiting-review, rejected, failed
 *   and unpaid registrations have no such event, so they add nothing.
 * - From / To applies to the date the payment was recorded.
 * - A Payment method filter also limits the ledger to that method, so an
 *   order that changed method only contributes the matching payments.
 */
const MAX_LEDGER_LINES = 50000;

async function sirahLedgerLines(search: URLSearchParams, take: number) {
  const { where } = await sirahAdminOrderWhere(search, "counted");
  const range = sirahPaidRange(search);
  const providers = sirahMethodProviders(search);
  const lines = await prisma.sirahPaymentEvent.findMany({
    where: {
      kind: { in: SIRAH_LEDGER_KINDS },
      ...(range ? { createdAt: range } : {}),
      ...(providers ? { provider: { in: providers } } : {}),
      order: where,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take,
    select: {
      id: true,
      orderId: true,
      provider: true,
      kind: true,
      amountMinor: true,
      currency: true,
      createdAt: true,
      order: {
        select: {
          reference: true,
          countryName: true,
          user: { select: { fullName: true, email: true } },
        },
      },
    },
  });
  return lines.sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id),
  );
}

export async function sirahPaymentTotals(
  search: URLSearchParams,
): Promise<SirahPaymentTotals> {
  const lines = await sirahLedgerLines(search, MAX_LEDGER_LINES + 1);
  const truncated = lines.length > MAX_LEDGER_LINES;
  return {
    ...sumSirahLedger(lines.slice(0, MAX_LEDGER_LINES), SIRAH_RECEIVED_KINDS),
    truncated,
    from: search.get("from") || null,
    to: search.get("to") || null,
  };
}

/** One line per payment (and per refund), oldest first, for matching against
 * JazzCash and bank statements. Amounts are plain decimals in the line's own
 * currency; refunds are listed with status "Refunded". */
export async function sirahPaymentsCsv(search: URLSearchParams) {
  const lines = await sirahLedgerLines(search, SIRAH_CSV_MAX_ROWS);
  return [
    [
      "Reference",
      "Customer name",
      "Email",
      "Country",
      "Payment method",
      "Currency",
      "Amount",
      "Status",
      "Date (UTC)",
    ].join(","),
    ...lines.map((line) =>
      [
        line.order.reference,
        line.order.user.fullName,
        line.order.user.email,
        line.order.countryName,
        sirahMethodLabel(line.provider),
        line.currency,
        minorToDecimal(line.amountMinor, line.currency),
        SIRAH_RECEIVED_KINDS.includes(line.kind) ? "Received" : line.kind === "REFUND_PENDING" ? "Refund pending" : "Refunded",
        line.createdAt.toISOString().slice(0, 16).replace("T", " "),
      ]
        .map(sirahCsvCell)
        .join(","),
    ),
  ].join("\r\n");
}
