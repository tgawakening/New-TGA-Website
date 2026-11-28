import {
  ARCHIVED_ORDERS,
  EXCLUDED_ORDERS,
  INCLUDED_ORDERS,
  sirahArchivePurgeAt,
  sirahDeletionRefusal,
} from "@/lib/sirah/admin-records";
import { canCompleteSirahGatewayManually, canRecoverSirahManualPayment } from "@/lib/sirah/manual-review";
import { ADMIN_RECEIPT_UPLOADED } from "@/lib/sirah/direct-upload-policy";
import "server-only";
import { calculateSirahAnnualUnusedMonths } from "@/lib/sirah/annual-refund";
import { quoteSirahAnnualRefund } from "./sirah-refunds.service";
import { paidSirahPeriodEnd } from "@/lib/sirah/subscription-access";
import { dueAfterPayments, orderCycle } from "@/lib/sirah/billing-cycle";
import { createHash } from "node:crypto";
import { countries } from "countries-list";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  SIRAH_SLUG,
  SIRAH_TITLE,
  decimalToMinor,
  formatSirahMoney,
  priceFor,
  type SirahPlan,
} from "@/lib/sirah/catalog";
import { getGroupInvitation, type SirahTerms } from "@/lib/sirah/config";
import { sirahAdminActionSchema } from "@/lib/sirah/validation";
import { sirahDisplayPaymentState, sirahNetReceivedMinor, sirahPendingRefundMinor } from "@/lib/sirah/refund-display";
import {
  ADMIN_CUSTOM_PRICING_VERSION,
  adminCustomSnapshot,
  isAdminCustomOrder,
} from "@/lib/sirah/admin-custom";
import { auditSirah, SirahError } from "./sirah-registration.service";
import {
  confirmSirahPayment,
  confirmSirahPaymentInTransaction,
  afterSirahPaymentConfirmed,
  addMonthsClamped,
  serializable,
} from "./sirah-confirmation.service";
import {
  queueSirahNotice,
  dispatchSirahNotifications,
  queuePendingInvitations,
} from "./sirah-notifications.service";
import {
  stripeClient,
  paypalRequest,
  paypalDecimal,
  verifySirahStripeSession,
  verifySirahPaypal,
  confirmSirahGatewayUnsettled,
} from "./sirah-online.service";
import { pakistanCalendarDate } from "@/lib/sirah/cohort-dates";
import { SCHOLARSHIP_ORDER_VERSION } from "@/lib/sirah/scholarship-application";
/** Payment-ledger kinds that move money: a verified payment received (first or
 * renewal) and a recorded refund. FAILED events carry no money. */
export const SIRAH_RECEIVED_KINDS = ["FIRST", "RENEWAL"];
export const SIRAH_LEDGER_KINDS = [...SIRAH_RECEIVED_KINDS, "REFUND", "REFUND_PENDING"];

const DATE_PARAM = /^\d{4}-\d{2}-\d{2}$/;
function dateParam(value: string | null, label: string) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!DATE_PARAM.test(value) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value)
    throw new SirahError(`Choose a valid ${label} date.`);
  return parsed;
}
/** The optional From / To filter (YYYY-MM-DD, whole UTC days, both inclusive),
 * applied to the date a payment or refund was recorded in the ledger. */
export function sirahPaidRange(search: URLSearchParams) {
  const from = dateParam(search.get("from"), "From");
  const to = dateParam(search.get("to"), "To");
  if (from && to && from > to)
    throw new SirahError("The From date must be on or before the To date.");
  if (!from && !to) return null;
  return {
    ...(from ? { gte: from } : {}),
    ...(to ? { lt: new Date(to.getTime() + 24 * 60 * 60 * 1000) } : {}),
  };
}

/** Ledger providers that correspond to a Payment method filter, or null when
 * the filter does not name a provider (no filter, custom link, unselected). */
export function sirahMethodProviders(search: URLSearchParams) {
  const method = (search.get("method") || "").trim().toUpperCase();
  if (method === "MANUAL") return ["BANK_TRANSFER", "JAZZCASH"];
  return ["STRIPE", "PAYPAL", "BANK_TRANSFER", "JAZZCASH"].includes(method)
    ? [method]
    : null;
}

/**
 * The Prisma filter behind the admin Students / Payments list. Shared by the
 * list, both CSV exports and the payment totals so they always agree.
 * `scope: "counted"` forces the records counted in analytics (no excluded
 * test / junk rows, no archive) whatever records view was requested.
 */
export async function sirahAdminOrderWhere(
  search: URLSearchParams,
  scope: "view" | "counted" = "view",
) {
  // Test / junk records a super admin excluded stay out of the lists and CSV
  // unless the (super-admin only) excluded view is requested. Archived
  // (soft-deleted) records appear only in the (super-admin only) archive view.
  const archivedView = scope === "view" && search.get("archived") === "only";
  const excludedView =
    scope === "view" && !archivedView && search.get("excluded") === "only";
  const q = (search.get("q") || "").slice(0, 150);
  const payment = search.get("payment") || "";
  const enrolment = search.get("enrolment") || "";
  const batch = search.get("batch") || "";
  const country = (search.get("country") || "").trim().toUpperCase();
  const method = (search.get("method") || "").trim().toUpperCase();
  const group = (search.get("group") || "").trim().toUpperCase();
  if (group && !["ADDED", "NOT_ADDED"].includes(group))
    throw new SirahError("Choose a valid group status.");
  if (country && !(country in countries))
    throw new SirahError("Choose a valid country.");
  if (
    method &&
    ![
      "STRIPE",
      "PAYPAL",
      "BANK_TRANSFER",
      "JAZZCASH",
      "MANUAL",
      "UNSELECTED",
      "CUSTOM_LINK",
    ].includes(method)
  )
    throw new SirahError("Choose a valid payment method.");
  const where: Prisma.SirahOrderWhereInput = {
    course: { slug: SIRAH_SLUG },
    ...(archivedView
      ? ARCHIVED_ORDERS
      : excludedView
        ? EXCLUDED_ORDERS
        : INCLUDED_ORDERS),
    ...(payment === "NEEDS_ATTENTION"
      ? { paymentState: { in: ["AWAITING_REVIEW", "PROCESSING", "FAILED"] } }
      : payment
        ? { paymentState: payment }
        : {}),
    ...(group === "ADDED"
      ? { groupAddedAt: { not: null } }
      : group === "NOT_ADDED"
        ? { groupAddedAt: null }
        : {}),
    ...(enrolment ? { enrolmentState: enrolment } : {}),
    ...(batch ? { batchCode: batch } : {}),
    ...(country ? { countryCode: country } : {}),
    ...(method === "CUSTOM_LINK"
      ? { pricingVersion: ADMIN_CUSTOM_PRICING_VERSION }
      : method === "MANUAL"
      ? { method: { in: ["BANK_TRANSFER", "JAZZCASH"] } }
      : method === "UNSELECTED"
        ? { method: null }
        : method
          ? { method }
          : {}),
    ...(q
      ? {
          OR: [
            { reference: { contains: q } },
            { id: q },
            { user: { email: { contains: q } } },
            { user: { fullName: { contains: q } } },
            { phoneE164: { contains: q } },
          ],
        }
      : {}),
  };
  // From / To: only orders with a payment or refund recorded in that period.
  const range = sirahPaidRange(search);
  if (range) {
    const inRange = await prisma.sirahPaymentEvent.findMany({
      where: { kind: { in: SIRAH_LEDGER_KINDS }, createdAt: range },
      select: { orderId: true },
    });
    where.id = { in: [...new Set(inRange.map((event) => event.orderId))] };
  }
  return { where, archivedView, excludedView };
}

export async function listSirahAdmin(search: URLSearchParams) {
  const { where, archivedView, excludedView } = await sirahAdminOrderWhere(search);
  const page = Math.max(1, Math.min(10000, Number(search.get("page")) || 1));
  const pageSize = 25;
  const [total, rows] = await Promise.all([
    prisma.sirahOrder.count({ where }),
    prisma.sirahOrder.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: archivedView ? { archivedAt: "desc" } : { createdAt: "desc" },
      select: {
        id: true,
        reference: true,
        batchCode: true,
        countryCode: true,
        countryName: true,
        phoneE164: true,
        marketCode: true,
        plan: true,
        method: true,
        currency: true,
        amountMinor: true,
        ledgerFeeMinor: true,
        ledgerFeeCurrency: true,
        paidMinor: true,
        refundedMinor: true,
        pricingVersion: true,
        discount: true,
        revision: true,
        paymentState: true,
        enrolmentState: true,
        programmeStart: true,
        programmeEnd: true,
        nextBillingAt: true,
        cancelledAt: true,
        accessEndsAt: true,
        paidCount: true,
        groupAddedAt: true,
        groupAddedBy: true,
        excludedAt: true,
        excludedBy: true,
        archivedAt: true,
        registrationId: true,
        providerOrderId: true,
        providerSubscriptionId: true,
        createdAt: true,
        user: { select: { fullName: true, email: true } },
        receipts: {
          select: { id: true, filename: true, revision: true },
          orderBy: { revision: "desc" },
        },
        audits: {
          select: { actor: true, action: true, detail: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        events: {
          select: {
            id: true,
            kind: true,
            amountMinor: true,
            currency: true,
            provider: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
        notifications: {
          select: {
            id: true,
            kind: true,
            state: true,
            error: true,
            attempts: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
  ]);
  const ids = rows.map(row => row.id);
  const [ledgerOrders, planOrders, receiptUploads] = ids.length ? await Promise.all([
    prisma.sirahLedgerPayment.findMany({ where: { orderId: { in: ids } }, select: { orderId: true }, distinct: ["orderId"] }),
    prisma.sirahPaymentPlan.findMany({ where: { orderId: { in: ids } }, select: { orderId: true } }),
    // Receipts staff attached on the student's behalf (audit trail, not a column).
    prisma.sirahAudit.findMany({ where: { orderId: { in: ids }, action: ADMIN_RECEIPT_UPLOADED }, select: { actor: true, detail: true, createdAt: true } }),
  ]) : [[], [], []];
  const ledgerIds = new Set(ledgerOrders.map(entry => entry.orderId));
  const planIds = new Set(planOrders.map(entry => entry.orderId));
  const adminUploads = new Map<string, { actor: string; at: Date }>();
  for (const entry of receiptUploads) {
    const receiptId = (entry.detail as { receiptId?: unknown } | null)?.receiptId;
    if (typeof receiptId === "string") adminUploads.set(receiptId, { actor: entry.actor, at: entry.createdAt });
  }
  return {
    courseTitle: SIRAH_TITLE,
    total,
    page,
    pageSize,
    excludedView,
    archivedView,
    rows: rows.map(({ discount, registrationId, providerOrderId, providerSubscriptionId, ...row }) => {
      const custom = adminCustomSnapshot({ discount });
      // Whether a super admin may delete it permanently (payment-free junk only).
      const deleteRefusal = sirahDeletionRefusal(
        { ...row, registrationId, providerOrderId, providerSubscriptionId },
        { paymentEvents: row.events.length, receipts: row.receipts.length, ledgerPayments: Number(ledgerIds.has(row.id)), paymentPlans: Number(planIds.has(row.id)) },
      );
      return {
        ...row,
        receipts: row.receipts.map(receipt => ({ ...receipt, adminUpload: adminUploads.get(receipt.id) ?? null })),
        hasMonthlyPlan: planIds.has(row.id),
        deleteRefusal,
        // Archive view: when the maintenance job will delete it for good.
        purgeAt: row.archivedAt ? sirahArchivePurgeAt(row.archivedAt) : null,
        // Admin custom payment link: catalog vs agreed price, sponsor, creator.
        customLink: custom
          ? {
              catalogAmountMinor: custom.catalogAmountMinor,
              catalogCurrency: custom.catalogCurrency,
              amountMinor: custom.amountMinor,
              sponsorLabel: custom.sponsorLabel,
              createdBy: custom.createdBy,
              createdAt: custom.createdAt,
            }
          : null,
      };
    }),
  };
}
export async function cancelSirahProvider(
  order: {
    id: string;
    method: string | null;
    providerSubscriptionId: string | null;
    providerPlanId?: string | null;
  },
  timing: "IMMEDIATE" | "PERIOD_END",
  stripeOverride?: ReturnType<typeof stripeClient>,
) {
  if (!order.providerSubscriptionId) return;
  if (order.method === "STRIPE") {
    const stripe = stripeOverride || stripeClient();
    if (
      (await stripe.accounts.retrieve()).id !==
      process.env.SIRAH_STRIPE_ACCOUNT_ID
    )
      throw new SirahError("Stripe merchant identity mismatch.");
    const current = await stripe.subscriptions.retrieve(
      order.providerSubscriptionId,
    );
    if (current.metadata.sirahOrderId !== order.id)
      throw new SirahError("Subscription ownership mismatch.");
    if (current.status === "canceled") return;
    if (timing === "PERIOD_END")
      await stripe.subscriptions.update(order.providerSubscriptionId, {
        cancel_at_period_end: true,
      });
    else
      await stripe.subscriptions.cancel(order.providerSubscriptionId, {
        invoice_now: false,
        prorate: false,
      });
    const verified = await stripe.subscriptions.retrieve(
      order.providerSubscriptionId,
    );
    if (
      verified.metadata.sirahOrderId !== order.id ||
      (verified.status !== "canceled" &&
        !(timing === "PERIOD_END" && verified.cancel_at_period_end))
    )
      throw new SirahError(
        "Stripe has not confirmed cancellation; retry or contact support.",
        409,
      );
  } else if (order.method === "PAYPAL") {
    const path = `/v1/billing/subscriptions/${order.providerSubscriptionId}`;
    const owns = (sub: { custom_id?: string; plan_id?: string }) =>
      sub.custom_id === order.id &&
      (!order.providerPlanId || sub.plan_id === order.providerPlanId);
    const sub = await paypalRequest(path);
    if (!owns(sub)) throw new SirahError("Subscription ownership mismatch.");
    if (!["CANCELLED", "EXPIRED"].includes(sub.status))
      await paypalRequest(
        `${path}/cancel`,
        "POST",
        { reason: "Student cancelled future voluntary renewals" },
        `cancel-${order.id}`,
      );
    // PayPal stops billing now; the application's paid-period boundary controls access.
    const verified = await paypalRequest(path);
    if (!owns(verified) || !["CANCELLED", "EXPIRED"].includes(verified.status))
      throw new SirahError(
        "PayPal has not confirmed cancellation; retry or contact support.",
        409,
      );
  }
}

/** Pending refunds are separate ledger entries, so settlement and access state remain unchanged. */
export async function reflectPendingSirahRefund(orderId: string, refundId: string, amountMinor: number, currency: string, pending: boolean) {
  await serializable(async (tx) => {
    const previous = await tx.sirahPaymentEvent.findUnique({ where: { id: refundId } });
    if (previous && (previous.orderId !== orderId || previous.amountMinor !== amountMinor || previous.currency !== currency || previous.provider !== "STRIPE")) throw new SirahError("Refund identity mismatch.");
    if (previous?.kind === "REFUND" || previous?.kind === (pending ? "REFUND_PENDING" : "REFUND_FAILED")) return;
    if (previous && !["REFUND_PENDING", "REFUND_FAILED"].includes(previous.kind)) throw new SirahError("Refund identity mismatch.");
    const order = await tx.sirahOrder.findUniqueOrThrow({ where: { id: orderId } });
    if (order.currency !== currency || amountMinor <= 0) throw new SirahError("Refund amount or currency does not match recorded payments.");
    if (pending) {
      const pendingRows = await tx.sirahPaymentEvent.findMany({ where: { orderId, kind: "REFUND_PENDING" } });
      const otherPending = pendingRows.filter((row) => row.id !== refundId).reduce((sum, row) => sum + row.amountMinor, 0);
      if (amountMinor + otherPending > order.paidMinor - order.refundedMinor) throw new SirahError("Refund exceeds recorded payments.");
    }
    if (previous) await tx.sirahPaymentEvent.update({ where: { id: refundId }, data: { kind: pending ? "REFUND_PENDING" : "REFUND_FAILED" } });
    else if (pending) await tx.sirahPaymentEvent.create({ data: { id: refundId, orderId, provider: "STRIPE", amountMinor, currency, kind: "REFUND_PENDING" } });
    if (previous || pending) await tx.sirahOrder.update({ where: { id: orderId }, data: { revision: { increment: 1 } } });
  });
}

export async function recordSirahRefund(
  orderId: string,
  refundId: string,
  amountMinor: number,
  currency: string,
  actor: string,
  note: string,
) {
  const outcome = await serializable(async (tx) => {
    const previous = await tx.sirahPaymentEvent.findUnique({
      where: { id: refundId },
    });
    if (previous) {
      if (previous.orderId !== orderId || previous.amountMinor !== amountMinor || previous.currency !== currency)
        throw new SirahError("Refund identity mismatch.");
      if (previous.kind === "REFUND") return;
      if (!["REFUND_PENDING", "REFUND_FAILED"].includes(previous.kind)) throw new SirahError("Refund identity mismatch.");
    }
    const order = await tx.sirahOrder.findUniqueOrThrow({
      where: { id: orderId },
    });
    if (
      order.currency !== currency ||
      amountMinor <= 0 ||
      amountMinor > order.paidMinor - order.refundedMinor
    )
      throw new SirahError(
        "Refund amount or currency does not match recorded payments.",
      );
    if (previous) await tx.sirahPaymentEvent.update({ where: { id: refundId }, data: { kind: "REFUND" } });
    else await tx.sirahPaymentEvent.create({
      data: { id: refundId, orderId, provider: order.method!, amountMinor, currency, kind: "REFUND" },
    });
    const all = order.refundedMinor + amountMinor === order.paidMinor;
    const terms = order.terms as SirahTerms | null;
    const releaseHold =
      order.paymentState === "REFUND_PENDING" &&
      terms?.refundAccess === "KEEP" &&
      !order.cancelledAt &&
      !["CANCELLED", "COMPLETED"].includes(order.enrolmentState);
    const refundEnd =
      terms?.refundAccessTiming === "CURRENT_MONTH_END" &&
      order.plan === "ANNUAL" &&
      terms.annualRefundBasis === "FULL_UNUSED_MONTHS" &&
      order.programmeStart
        ? order.accessEndsAt ||
          calculateSirahAnnualUnusedMonths(
            order.programmeStart,
            order.cancelledAt || new Date(),
          ).paidThrough
        : null;
    await tx.sirahOrder.update({
      where: { id: orderId },
      data: {
        refundedMinor: { increment: amountMinor },
        paymentState: all ? "REFUNDED" : "PAID",
        ...(terms?.refundAccess === "REVOKE"
          ? all &&
            order.plan === "ANNUAL" &&
            terms.requiresConfirmedCommencement
            ? {
                enrolmentState: "CANCELLED",
                cancelledAt: order.cancelledAt || new Date(),
                accessEndsAt: new Date(),
              }
            : refundEnd
              ? {
                  cancelledAt: order.cancelledAt || new Date(),
                  accessEndsAt: refundEnd,
                  ...(refundEnd <= new Date()
                    ? { enrolmentState: "CANCELLED" }
                    : {}),
                }
              : { enrolmentState: "CANCELLED" }
          : releaseHold
            ? {
                enrolmentState: "ACTIVE",
                invitationState:
                  order.invitationState === "SENT"
                    ? "SENT"
                    : getGroupInvitation(order.countryCode)
                      ? "QUEUED"
                      : "PENDING",
                nextBillingAt:
                  order.plan === "MONTHLY" && order.paidCount < 12
                    ? orderCycle(order)
                      ? dueAfterPayments(order, order.paidCount)
                      : order.programmeStart
                        ? addMonthsClamped(order.programmeStart, order.paidCount)
                        : null
                    : null,
              }
            : {}),
        revision: { increment: 1 },
      },
    });
    if (releaseHold && !all) {
      await queueSirahNotice(
        tx,
        orderId,
        "CONFIRMED",
        `reconciled:${refundId}`,
      );
    }
    await auditSirah(tx, orderId, actor, "REFUND_VERIFIED", {
      refundId,
      amountMinor,
      currency,
      note,
    });
    await queueSirahNotice(tx, orderId, "REFUNDED", refundId, note);
    return {
      cancelBilling:
        !!order.providerSubscriptionId && terms?.refundBilling === "CANCEL",
      order,
    };
  });
  if (outcome?.cancelBilling) {
    try {
      await cancelSirahProvider(outcome.order, "IMMEDIATE");
      await prisma.$transaction(async (tx) => {
        await tx.sirahOrder.update({
          where: { id: orderId },
          data: { cancelledAt: new Date(), nextBillingAt: null },
        });
        await auditSirah(tx, orderId, actor, "REFUND_BILLING_CANCELLED", {
          refundId,
        });
      });
    } catch {
      await prisma.$transaction((tx) =>
        queueSirahNotice(tx, orderId, "BILLING_REVIEW", refundId),
      );
    }
  }
}
/** The ledger event id of a manual (bank / JazzCash) payment: one transfer
 * reference may credit one registration, once. */
function manualPaymentEventId(method: string, reference: string) {
  return `manual:${method}:${createHash("sha256").update(reference).digest("hex")}`;
}
/** Explain a reused transfer reference in staff terms before the transactional
 * guard (which still enforces it in confirmSirahPaymentInTransaction) rejects it. */
async function assertManualReferenceUnused(
  eventId: string,
  reference: string,
  orderId: string,
  amount: number,
  currency: string,
  adminEntered: boolean,
) {
  const seen = await prisma.sirahPaymentEvent.findUnique({
    where: { id: eventId },
    select: { orderId: true, amountMinor: true, currency: true, order: { select: { reference: true } } },
  });
  if (seen && (seen.orderId !== orderId || seen.amountMinor !== amount || seen.currency !== currency))
    throw new SirahError(
      `${adminEntered ? "The transaction reference you entered" : "The student's submitted transaction reference"} ("${reference}") has already been used to verify ${formatSirahMoney(seen.amountMinor, seen.currency)} on ${seen.orderId === orderId ? "this registration" : `registration ${seen.order.reference}`}, so it cannot verify this payment as well. Check the bank statement: if this is a separate transfer, enter its own reference under "Transfer transaction reference" and approve again; if it is the same transfer, do not approve. Reconcile it with that registration instead.`,
      422,
    );
}
/** Staff complete a Stripe / PayPal registration whose online payment never
 * completed, because the student paid by bank transfer / JazzCash instead.
 * 1. The provider itself must confirm the online attempt did not and can no
 *    longer collect money (an open checkout is closed). If it did succeed, that
 *    payment is recorded and manual completion is refused.
 * 2. In one serializable transaction the order switches to the verified manual
 *    method (clearing the dead provider references) and the payment is
 *    confirmed through the same path as approving a manual registration, with
 *    the same one-reference-one-payment guard. Receipts, ledger payments and
 *    the agreement are left untouched. */
async function completeSirahGatewayOrderManually(
  order: Prisma.SirahOrderGetPayload<{ include: { events: true } }>,
  input: z.infer<typeof sirahAdminActionSchema>,
  actor: string,
) {
  if (order.revision !== input.revision)
    throw new SirahError("Another admin or student changed this record. Reload first.", 409);
  if (order.events.length || !canCompleteSirahGatewayManually(order))
    throw new SirahError(
      "Only an unpaid, still-pending Stripe or PayPal registration can be completed manually.",
      409,
    );
  const method = input.manualMethod;
  const reference = input.transactionReference?.trim();
  const note = input.note?.trim();
  if (!method || !reference || !note || !input.receivedDate || input.verifiedTransfer !== true)
    throw new SirahError(
      "Select the verified method, enter the transfer reference, payment date and how the funds were verified, and confirm they were received.",
    );
  const receivedAt = new Date(`${input.receivedDate}T12:00:00.000Z`);
  if (
    !Number.isFinite(receivedAt.getTime()) ||
    receivedAt.toISOString().slice(0, 10) !== input.receivedDate ||
    input.receivedDate > pakistanCalendarDate(new Date())
  )
    throw new SirahError("Choose a valid payment date that is not in the future.");
  const currency = input.currency?.toUpperCase() || order.currency;
  if (currency !== order.currency)
    throw new SirahError(
      `This registration is priced in ${order.currency}; record the payment in ${order.currency}.`,
    );
  let amount: number;
  try {
    amount = input.verifiedAmount ? decimalToMinor(input.verifiedAmount, currency) : order.amountMinor;
  } catch {
    throw new SirahError("Enter a valid received amount.");
  }
  // The online quote can differ from the manual rate (e.g. Pakistan's bank /
  // JazzCash fee). A self-registered order without a discount may take the
  // catalog manual quote; any other amount must equal the locked fee.
  const manualQuote = priceFor(order.countryCode, order.plan as SirahPlan, method);
  const mayReprice =
    !isAdminCustomOrder(order) &&
    order.pricingVersion !== SCHOLARSHIP_ORDER_VERSION &&
    !order.discount &&
    manualQuote.currency === order.currency &&
    manualQuote.amountMinor !== order.amountMinor;
  const reprice = mayReprice && amount !== order.amountMinor && amount === manualQuote.amountMinor;
  if (amount !== order.amountMinor && !reprice)
    throw new SirahError(
      `The received amount must equal this registration's fee of ${formatSirahMoney(order.amountMinor, order.currency)}${
        mayReprice
          ? ` (or the ${method === "JAZZCASH" ? "JazzCash" : "bank transfer"} fee of ${formatSirahMoney(manualQuote.amountMinor, manualQuote.currency)})`
          : ""
      }. Nothing was recorded.`,
    );
  const eventId = manualPaymentEventId(method, reference);
  // Reject a reused reference before anything is sent to the provider.
  await assertManualReferenceUnused(eventId, reference, order.id, amount, currency, true);
  await prisma.$transaction((tx) =>
    auditSirah(tx, order.id, actor, "GATEWAY_MANUAL_COMPLETION_REQUESTED", {
      provider: order.method,
      reference: order.providerOrderId || order.providerSubscriptionId || null,
    }),
  );
  const gatewayReference = await confirmSirahGatewayUnsettled(order);
  const result = await serializable(async (tx) => {
    const changed = await tx.sirahOrder.updateMany({
      where: {
        id: order.id,
        revision: order.revision,
        method: order.method,
        paidCount: 0,
        paidMinor: 0,
        enrolmentState: "PENDING",
        cancelledAt: null,
        archivedAt: null,
        paymentState: { in: ["UNPAID", "PROCESSING", "FAILED"] },
        providerOrderId: order.providerOrderId,
        providerSubscriptionId: order.providerSubscriptionId,
      },
      data: {
        method,
        paymentState: "UNPAID",
        providerOrderId: null,
        providerSubscriptionId: null,
        providerPlanId: null,
        checkoutToken: null,
        ...(reprice
          ? {
              amountMinor: manualQuote.amountMinor,
              totalMinor: manualQuote.totalMinor,
              pricingVersion: manualQuote.pricingVersion,
            }
          : {}),
        revision: { increment: 1 },
      },
    });
    if (!changed.count)
      throw new SirahError(
        "This registration changed while the payment provider was checked. Nothing was recorded; reload and retry.",
        409,
      );
    await auditSirah(tx, order.id, actor, "GATEWAY_ORDER_COMPLETED_MANUALLY", {
      previousMethod: order.method,
      previousPaymentState: order.paymentState,
      providerReferenceConfirmedUnsettled: gatewayReference,
      method,
      amountMinor: amount,
      currency,
      ...(reprice ? { previousAmountMinor: order.amountMinor, repricedToManualQuote: true } : {}),
      receivedDate: input.receivedDate,
      transactionReference: reference,
      note,
    });
    return confirmSirahPaymentInTransaction(tx, {
      orderId: order.id,
      eventId,
      provider: method,
      amountMinor: amount,
      currency,
      actor,
      note: `${note} Completed manually after an unfinished ${order.method === "STRIPE" ? "Stripe" : "PayPal"} checkout. Reference source: admin-entered transfer reference. Reference: ${reference}`,
      expectedRevision: order.revision + 1,
      allowUnsubmittedManual: true,
      receivedAt,
    });
  });
  return afterSirahPaymentConfirmed(order.id, result);
}
export async function actOnSirahOrder(
  input: z.infer<typeof sirahAdminActionSchema>,
  actor: string,
) {
  const order = await prisma.sirahOrder.findUnique({
    // Archived (soft-deleted) orders take no enrolment actions until restored.
    where: { id: input.orderId, course: { slug: SIRAH_SLUG }, archivedAt: null },
    include: { events: { where: { kind: { in: ["FIRST", "RENEWAL"] } } } },
  });
  if (!order) throw new SirahError("Registration not found.", 404);
  if (input.action === "RETRY_NOTIFICATIONS") {
    await prisma.$transaction(async (tx) => {
      await auditSirah(tx, order.id, actor, "NOTIFICATIONS_RETRY", {});
    });
    await queuePendingInvitations();
    return dispatchSirahNotifications(order.id);
  }
  if (input.action === "RECONCILE_PROVIDER") {
    if (
      order.revision !== input.revision ||
      order.paymentState !== "PROCESSING" ||
      !(
        input.providerReference ||
        order.providerOrderId ||
        order.providerSubscriptionId
      )
    )
      throw new SirahError(
        "Choose the unchanged processing order and its actual provider reference.",
        409,
      );
    const providerReference =
      input.providerReference ||
      order.providerOrderId ||
      order.providerSubscriptionId!;
    await prisma.$transaction((tx) =>
      auditSirah(tx, order.id, actor, "PROVIDER_RECONCILIATION_REQUESTED", {
        reference: providerReference,
        note: input.note || null,
      }),
    );
    if (order.method === "STRIPE")
      return verifySirahStripeSession(order.id, providerReference);
    if (order.method === "PAYPAL")
      return verifySirahPaypal(order.id, providerReference, false);
    throw new SirahError("This record is not an online checkout.");
  }
  if (input.action === "COMPLETE_MANUALLY")
    return completeSirahGatewayOrderManually(order, input, actor);
  if (input.action === "APPROVE") {
    const method = order.method || input.manualMethod;
    const recovery = canRecoverSirahManualPayment(order);
    if (!method) throw new SirahError("Select the verified Meezan Bank or JazzCash payment method.");
    if (!method || !["BANK_TRANSFER", "JAZZCASH"].includes(method) ||
        (!order.method && !recovery) ||
        (order.method && input.manualMethod && input.manualMethod !== order.method))
      throw new SirahError(
        "Online payments cannot be approved through a display-status change.",
      );
    if (input.verifiedTransfer !== true)
      throw new SirahError(
        "Confirm that the funds were received in the merchant account.",
      );
    if (recovery && !input.note?.trim())
      throw new SirahError("Record how staff verified the received funds without a complete student submission.");
    const evidence = await prisma.sirahAudit.findFirst({
      where: { orderId: order.id, action: "EVIDENCE_SUBMITTED" },
      orderBy: { createdAt: "desc" },
      select: { detail: true },
    });
    const detail = evidence?.detail as {
      transactionReference?: unknown;
    } | null;
    const submittedReference =
      typeof detail?.transactionReference === "string"
        ? detail.transactionReference.trim()
        : "";
    const reference =
      input.transactionReference?.trim() ||
      submittedReference ||
      `TGA-REVIEW-${order.id}-${input.revision}`;
    const source = input.transactionReference?.trim()
      ? "admin-entered transfer reference"
      : submittedReference
        ? "submitted receipt reference reviewed by staff"
        : "internal review reference (no bank reference supplied)";
    const currency = input.currency?.toUpperCase() || order.currency;
    const amount = input.verifiedAmount
      ? decimalToMinor(input.verifiedAmount, currency)
      : order.amountMinor;
    const eventId = manualPaymentEventId(method, reference);
    await assertManualReferenceUnused(eventId, reference, order.id, amount, currency, source === "admin-entered transfer reference");
    return confirmSirahPayment({
      orderId: order.id,
      eventId,
      provider: method as "BANK_TRANSFER" | "JAZZCASH",
      amountMinor: amount,
      currency,
      actor,
      note: `${input.note || "Staff confirmed the received funds against this registration."} Reference source: ${source}. Reference: ${reference}`,
      expectedRevision: input.revision,
      allowUnsubmittedManual: recovery,
      allowCancelledTransfer:
        order.enrolmentState === "CANCELLED" &&
        !!input.note &&
        !!input.verifiedTransfer,
    });
  }
  if (order.revision !== input.revision)
    throw new SirahError(
      "Another admin or student changed this record. Reload first.",
      409,
    );
  if (input.action === "PENDING") {
    if (
      !["BANK_TRANSFER", "JAZZCASH"].includes(order.method || "") ||
      order.paidCount ||
      order.paidMinor ||
      order.enrolmentState !== "PENDING" ||
      order.cancelledAt ||
      !["UNPAID", "REJECTED", "FAILED"].includes(order.paymentState)
    )
      throw new SirahError(
        "Only an unpaid manual registration can return to pending review.",
        409,
      );
    const evidence = await prisma.sirahAudit.findFirst({
      where: { orderId: order.id, action: "EVIDENCE_SUBMITTED" },
      select: { id: true },
    });
    await serializable(async (tx) => {
      const changed = await tx.sirahOrder.updateMany({
        where: {
          id: order.id,
          revision: input.revision,
          paidCount: 0,
          paidMinor: 0,
          enrolmentState: "PENDING",
          cancelledAt: null,
        },
        data: {
          paymentState: evidence ? "AWAITING_REVIEW" : "UNPAID",
          revision: { increment: 1 },
        },
      });
      if (!changed.count)
        throw new SirahError(
          "This record changed. Reload before reviewing it.",
          409,
        );
      await auditSirah(tx, order.id, actor, "RETURNED_TO_PENDING", {
        note:
          input.note ||
          "Admin returned the unpaid manual registration to pending review.",
      });
    });
    return { updated: true };
  }
  if (input.action === "QUOTE_ANNUAL_REFUND")
    return quoteSirahAnnualRefund(
      order.id,
      input.revision,
      input.unusedEligibleMonths!,
      actor,
    );
  if (input.action === "REFUND") {
    if (!input.verifiedAmount || !input.currency)
      throw new SirahError(
        "A verified refund amount and currency are required.",
      );
    const amount = decimalToMinor(
      input.verifiedAmount,
      input.currency.toUpperCase(),
    );
    if (
      input.currency.toUpperCase() !== order.currency ||
      amount > order.paidMinor - order.refundedMinor - order.events.filter((event) => event.kind === "REFUND_PENDING").reduce((sum, event) => sum + event.amountMinor, 0)
    )
      throw new SirahError(
        "Refund exceeds unrefunded payments or uses the wrong currency.",
      );
    let refundId = input.refundReference;
    if (order.method === "STRIPE" || order.method === "PAYPAL") {
      const event = order.events.find((e) => e.id === input.paymentEventId);
      if (!event || amount > event.amountMinor)
        throw new SirahError(
          "Choose a verified payment event and an amount within that payment.",
        );
      if (order.method === "STRIPE") {
        const stripe = stripeClient();
        let intent: string;
        if (event.id.startsWith("stripe:invoice:")) {
          const invoice = await stripe.invoices.retrieve(
            event.id.replace("stripe:invoice:", ""),
            { expand: ["payments"] },
          );
          const payment = invoice.payments?.data.find(
            (p) => p.payment.type === "payment_intent",
          )?.payment.payment_intent;
          intent = typeof payment === "string" ? payment : payment?.id || "";
        } else intent = event.id.replace("stripe:payment:", "");
        if (!intent)
          throw new SirahError(
            "Provider payment reference is not yet available.",
          );
        const refund = await stripe.refunds.create(
          { payment_intent: intent, amount },
          { idempotencyKey: `sirah-refund:${order.id}:${input.revision}` },
        );
        if (refund.amount !== amount || refund.currency.toUpperCase() !== order.currency) throw new SirahError("Provider refund amount or currency mismatch.");
        if (["pending", "requires_action"].includes(refund.status || "")) {
          await reflectPendingSirahRefund(order.id, `stripe:refund:${refund.id}`, refund.amount, refund.currency.toUpperCase(), true);
          return { refundPending: true };
        }
        if (refund.status !== "succeeded") throw new SirahError("The provider did not accept the refund.", 409);
        refundId = `stripe:refund:${refund.id}`;
      } else {
        const capture = event.id.replace(/^paypal:(capture|sale):/, "");
        const recurring = event.id.startsWith("paypal:sale:");
        const refund = await paypalRequest(
          recurring
            ? `/v1/payments/sale/${capture}/refund`
            : `/v2/payments/captures/${capture}/refund`,
          "POST",
          recurring
            ? {
                amount: {
                  currency: order.currency,
                  total: paypalDecimal(amount, order.currency),
                },
              }
            : {
                amount: {
                  currency_code: order.currency,
                  value: paypalDecimal(amount, order.currency),
                },
              },
          `refund-${order.id}-${input.revision}`,
        );
        if (refund.status !== "COMPLETED" && refund.state !== "completed")
          throw new SirahError(
            "The provider refund has not settled; no status was changed.",
            409,
          );
        refundId = `paypal:refund:${refund.id}`;
      }
    } else if (!refundId)
      throw new SirahError(
        "Record the real manual-refund transaction reference.",
      );
    await recordSirahRefund(
      order.id,
      refundId!,
      amount,
      order.currency,
      actor,
      input.note!,
    );
    await dispatchSirahNotifications(order.id).catch(() => {});
    return { refunded: true };
  }
  if (input.action === "CANCEL") {
    const terms = order.terms as SirahTerms | null;
    if (order.paidCount && !terms)
      throw new SirahError("Approved cancellation terms are not configured.");
    const timing = terms?.cancellationTiming || "IMMEDIATE";
    const paidUntil =
      timing !== "PERIOD_END"
        ? null
        : order.plan === "ANNUAL" &&
            terms?.annualRefundBasis === "FULL_UNUSED_MONTHS" &&
            order.programmeStart
          ? order.accessEndsAt ||
            calculateSirahAnnualUnusedMonths(order.programmeStart, new Date())
              .paidThrough
          : paidSirahPeriodEnd(order);
    if (timing === "PERIOD_END" && order.paidCount && !paidUntil)
      throw new SirahError(
        "The verified paid-period expiry needs reconciliation before cancellation.",
        409,
      );
    await cancelSirahProvider(order, timing);
    await serializable(async (tx) => {
      const changed = await tx.sirahOrder.updateMany({
        where: { id: order.id, revision: input.revision },
        data: {
          cancelledAt: new Date(),
          nextBillingAt: null,
          ...(paidUntil
            ? { accessEndsAt: paidUntil }
            : { enrolmentState: "CANCELLED" }),
          revision: { increment: 1 },
        },
      });
      if (!changed.count)
        throw new SirahError(
          "Cancellation was sent to the provider but the record changed; reload for reconciliation.",
          409,
        );
      await auditSirah(tx, order.id, actor, "CANCELLED", {
        timing,
        note: input.note || "Cancelled by admin.",
      });
      await queueSirahNotice(
        tx,
        order.id,
        "CANCELLED",
        String(input.revision),
        input.note,
      );
    });
  } else if (input.action === "REJECT") {
    if (
      !["BANK_TRANSFER", "JAZZCASH"].includes(order.method || "") ||
      order.paymentState !== "AWAITING_REVIEW"
    )
      throw new SirahError(
        "Only an awaiting-review manual submission can be rejected.",
      );
    await serializable(async (tx) => {
      const changed = await tx.sirahOrder.updateMany({
        where: {
          id: order.id,
          revision: input.revision,
          paymentState: "AWAITING_REVIEW",
        },
        data: { paymentState: "REJECTED", revision: { increment: 1 } },
      });
      if (!changed.count)
        throw new SirahError("Submission already reviewed.", 409);
      await auditSirah(tx, order.id, actor, "REJECTED", {
        reason:
          input.note ||
          "Payment evidence requires correction following staff review.",
      });
      await queueSirahNotice(
        tx,
        order.id,
        "REJECTED",
        String(input.revision),
        input.note,
      );
    });
  } else if (input.action === "COMPLETE") {
    await serializable(async (tx) => {
      const changed = await tx.sirahOrder.updateMany({
        where: { id: order.id, revision: input.revision },
        data: { enrolmentState: "COMPLETED", revision: { increment: 1 } },
      });
      if (!changed.count) throw new SirahError("Record changed.", 409);
      await auditSirah(tx, order.id, actor, "COMPLETED", {
        note: input.note || null,
        paymentStateUnchanged: order.paymentState,
      });
      await queueSirahNotice(tx, order.id, "COMPLETED", String(input.revision));
    });
  }
  await dispatchSirahNotifications(order.id).catch(() => {});
  return { updated: true };
}
export function sirahCsvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[=+@\-\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
/** Most rows one CSV export returns (well above the whole Sīrah cohort). */
export const SIRAH_CSV_MAX_ROWS = 20000;

type SirahCsvRow = Pick<
  Awaited<ReturnType<typeof listSirahAdmin>>["rows"][number],
  | "reference"
  | "user"
  | "phoneE164"
  | "countryName"
  | "batchCode"
  | "plan"
  | "method"
  | "amountMinor"
  | "paidMinor"
  | "refundedMinor"
  | "currency"
  | "paymentState"
  | "enrolmentState"
  | "customLink"
  | "groupAddedAt"
  | "groupAddedBy"
> & { events?: { kind: string; amountMinor: number }[] };

/** Every record matching the list filters (not just one page), with only the
 * columns the students CSV needs. */
export async function listSirahAdminForCsv(search: URLSearchParams) {
  const { where, archivedView } = await sirahAdminOrderWhere(search);
  const rows = await prisma.sirahOrder.findMany({
    where,
    take: SIRAH_CSV_MAX_ROWS,
    orderBy: archivedView ? { archivedAt: "desc" } : { createdAt: "desc" },
    select: {
      reference: true,
      phoneE164: true,
      countryName: true,
      batchCode: true,
      plan: true,
      method: true,
      amountMinor: true,
      paidMinor: true,
      refundedMinor: true,
      currency: true,
      paymentState: true,
      enrolmentState: true,
      discount: true,
      groupAddedAt: true,
      groupAddedBy: true,
      user: { select: { fullName: true, email: true } },
      events: { where: { kind: "REFUND_PENDING" }, select: { kind: true, amountMinor: true } },
    },
  });
  return {
    rows: rows.map(({ discount, ...row }): SirahCsvRow => {
      const custom = adminCustomSnapshot({ discount });
      return {
        ...row,
        customLink: custom
          ? {
              catalogAmountMinor: custom.catalogAmountMinor,
              catalogCurrency: custom.catalogCurrency,
              amountMinor: custom.amountMinor,
              sponsorLabel: custom.sponsorLabel,
              createdBy: custom.createdBy,
              createdAt: custom.createdAt,
            }
          : null,
      };
    }),
  };
}

export function sirahCsv(data: { rows: SirahCsvRow[] }) {
  return [
    [
      "Reference",
      "Name",
      "Email",
      "Phone",
      "Country",
      "Batch",
      "Plan",
      "Method",
      "Expected",
      "Paid",
      "Refunded",
      "Net received",
      "Currency",
      "Payment status",
      "Enrolment status",
      "Source",
      "Catalog price",
      "Custom price",
      "Sponsor",
      "Link created by",
      "Added to group",
      "Group added at",
      "Group added by",
    ].join(","),
    ...data.rows.map((row) =>
      [
        row.reference,
        row.user.fullName,
        row.user.email,
        row.phoneE164,
        row.countryName,
        row.batchCode,
        row.plan,
        row.method,
        formatSirahMoney(row.amountMinor, row.currency),
        formatSirahMoney(row.paidMinor, row.currency),
        formatSirahMoney(row.refundedMinor + sirahPendingRefundMinor(row), row.currency),
        formatSirahMoney(sirahNetReceivedMinor(row), row.currency),
        row.currency,
        `${sirahDisplayPaymentState(row)}${sirahPendingRefundMinor(row) ? " (REFUND PENDING)" : ""}`,
        row.enrolmentState,
        row.customLink ? "Admin custom link" : "Self-registered",
        row.customLink
          ? formatSirahMoney(
              row.customLink.catalogAmountMinor,
              row.customLink.catalogCurrency,
            )
          : "",
        row.customLink
          ? formatSirahMoney(row.customLink.amountMinor, row.currency)
          : "",
        row.customLink?.sponsorLabel || "",
        row.customLink?.createdBy || "",
        row.groupAddedAt ? "Yes" : "No",
        row.groupAddedAt ? new Date(row.groupAddedAt).toISOString() : "",
        row.groupAddedBy || "",
      ]
        .map(sirahCsvCell)
        .join(","),
    ),
  ].join("\r\n");
}

/** A signed, provider-retrieved refund arriving before its settlement event must
 * block entitlement until both financial records are reconciled. */
export async function holdSirahRefund(
  orderId: string,
  refundId: string,
  currency: string,
  amountMinor: number,
) {
  await serializable(async (tx) => {
    const order = await tx.sirahOrder.findUniqueOrThrow({
      where: { id: orderId },
    });
    if (
      order.currency !== currency ||
      amountMinor <= 0 ||
      amountMinor > order.amountMinor
    )
      throw new SirahError("Refund does not match this locked order.");
    const updated = await tx.sirahOrder.updateMany({
      where: {
        id: orderId,
        paymentState: { notIn: ["REFUND_PENDING", "REFUNDED"] },
      },
      data: { paymentState: "REFUND_PENDING", revision: { increment: 1 } },
    });
    if (updated.count) {
      await auditSirah(
        tx,
        orderId,
        "provider:verified-refund",
        "REFUND_BEFORE_SETTLEMENT",
        { refundId, amountMinor, currency },
      );
      await queueSirahNotice(tx, orderId, "REFUND_PENDING", refundId);
    }
  });
}
