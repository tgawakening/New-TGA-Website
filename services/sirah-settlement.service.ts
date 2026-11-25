import "server-only";
import type Stripe from "stripe";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SIRAH_TITLE, decimalToMinor } from "@/lib/sirah/catalog";
import { SETTLEMENT_SOURCE, settlementSessionMatches, settlementSessionState } from "@/lib/sirah/settlement-check";
import { stripeClient, verifyStripeMerchant } from "./sirah-online.service";
import { serializable } from "./sirah-confirmation.service";
import { SirahError } from "./sirah-registration.service";

const TTL_SECONDS = 23 * 3600 + 30 * 60;

/** Serialize balance snapshots and ledger changes on the same order row. */
export async function lockLedgerOrder(tx: Prisma.TransactionClient, id: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM SirahOrder WHERE id = ${id} FOR UPDATE`;
  if (!rows.length) throw new SirahError("Registration not found.", 404);
}
export async function assertLedgerUnlocked(tx: Prisma.TransactionClient, id: string) {
  if (await tx.sirahSettlement.findFirst({ where: { orderId: id, status: "PENDING" }, select: { id: true } }))
    throw new SirahError("A balance payment link is open. Reconcile it before changing the fee or recording another payment.", 409);
}

export async function createBalanceLink(orderId: string, actor: string, stripe = stripeClient(), requestedAmount?: string) {
  await verifyStripeMerchant(stripe);
  // Claim a single pending attempt before contacting Stripe. A failed/ambiguous
  // request is retried with the same idempotency key and exact parameters.
  const attempt = await serializable(async (tx) => {
    await lockLedgerOrder(tx, orderId);
    const prior = await tx.sirahSettlement.findFirst({ where: { orderId, status: "PENDING" } });
    if (prior) return prior;
    const order = await tx.sirahOrder.findUniqueOrThrow({ where: { id: orderId }, select: { currency: true, ledgerFeeMinor: true, ledgerFeeCurrency: true } });
    if (order.ledgerFeeMinor === null) throw new SirahError("Set the course fee before creating a balance link.", 409);
    if (order.ledgerFeeCurrency !== order.currency) throw new SirahError("The fee currency does not match the registration currency. Reconcile the fee before issuing a link.", 409);
    const mismatch = await tx.sirahLedgerPayment.findFirst({ where: { orderId, currency: { not: order.currency } }, select: { id: true } });
    if (mismatch) throw new SirahError("Ledger currencies do not match the registration currency. Reconcile the ledger before issuing a link.", 409);
    const totals = await tx.sirahLedgerPayment.aggregate({ where: { orderId }, _sum: { amountMinor: true } });
    const outstanding = order.ledgerFeeMinor - (totals._sum.amountMinor || 0);
    let amountMinor = outstanding;
    if (requestedAmount) {
      try { amountMinor = decimalToMinor(requestedAmount, order.currency); } catch { throw new SirahError("Enter a valid payment amount."); }
      if (amountMinor <= 0 || amountMinor > outstanding) throw new SirahError("The payment amount must be above zero and no more than the outstanding balance.", 409);
    }
    if (amountMinor <= 0) throw new SirahError("There is no outstanding balance.", 409);
    if (amountMinor > 99_999_999 || (["BHD", "KWD"].includes(order.currency) && amountMinor % 10 !== 0)) throw new SirahError("The balance cannot be charged by Stripe with this amount or currency precision.", 409);
    return tx.sirahSettlement.create({ data: { orderId, amountMinor, currency: order.currency, status: "PENDING", expiresAt: new Date((Math.floor(Date.now() / 1000) + TTL_SECONDS) * 1000), createdBy: actor } });
  });
  let session: Stripe.Checkout.Session;
  if (attempt.stripeSessionId) {
    session = await stripe.checkout.sessions.retrieve(attempt.stripeSessionId);
  } else {
    // Beyond this point Stripe's idempotency retention cannot safely be assumed.
    if (Date.now() >= attempt.expiresAt.getTime() - 30 * 60 * 1000)
      throw new SirahError("This settlement could not be reconciled automatically. Contact an administrator to investigate Stripe before issuing another link.", 409);
    const origin = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
    session = await stripe.checkout.sessions.create({
      mode: "payment", payment_method_types: ["card"],
      ...{ managed_payments: { enabled: false } },
      client_reference_id: attempt.id,
      metadata: { sirahSource: SETTLEMENT_SOURCE, settlementId: attempt.id, orderId },
      expires_at: Math.floor(attempt.expiresAt.getTime() / 1000),
      success_url: `${origin}/seerah/settlement`,
      cancel_url: `${origin}/seerah`,
      line_items: [{ quantity: 1, price_data: { currency: attempt.currency.toLowerCase(), unit_amount: attempt.amountMinor, product_data: { name: `${SIRAH_TITLE} - remaining balance` } } }],
    }, { idempotencyKey: `sirah-settlement:${attempt.id}` });
    await prisma.sirahSettlement.updateMany({ where: { id: attempt.id, stripeSessionId: null, status: "PENDING" }, data: { stripeSessionId: session.id } });
  }
  const result = await reconcileBalanceSession(attempt.id, session.id, stripe);
  if (result === "PAID") throw new SirahError("This balance was paid and recorded. Refresh the balance.", 409);
  if (result === "EXPIRED") throw new SirahError("The previous link expired. Generate a new balance link.", 409);
  if (session.status !== "open" || !session.url) throw new SirahError("The payment is being processed; check the balance again shortly.", 409);
  return { url: session.url, amountMinor: attempt.amountMinor, currency: attempt.currency, expiresAt: attempt.expiresAt };
}

export async function reconcileBalanceSession(id: string, sessionId: string, stripe = stripeClient()) {
  await verifyStripeMerchant(stripe);
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const settlement = await prisma.sirahSettlement.findUnique({ where: { id } });
  if (!settlement) throw new SirahError("Settlement not found.", 404);
  if (!settlement.stripeSessionId) throw new SirahError("Settlement session is still being recorded; retry.", 503);
  if (!settlementSessionMatches(settlement, session))
    throw new SirahError("Settlement session ownership, amount or currency mismatch.", 400);
  const sessionState = settlementSessionState(session);
  if (sessionState === "PAID") {
    const intent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
    if (!intent) throw new SirahError("Payment settlement is not yet available.", 503);
    await serializable(async (tx) => {
      await lockLedgerOrder(tx, settlement.orderId);
      const current = await tx.sirahSettlement.findUniqueOrThrow({ where: { id } });
      if (current.status === "PAID") return;
      if (current.status !== "PENDING") throw new SirahError("Settlement status requires investigation.", 409);
      await tx.sirahLedgerPayment.create({ data: { id: `settlement:${id}`, orderId: current.orderId, amountMinor: current.amountMinor, currency: current.currency, method: "STRIPE", receivedAt: new Date(), note: `Stripe settlement ${intent}`, createdBy: "provider:stripe" } });
      await tx.sirahSettlement.update({ where: { id }, data: { status: "PAID" } });
    });
    return "PAID" as const;
  }
  if (sessionState === "EXPIRED") {
    await serializable(async (tx) => {
      await lockLedgerOrder(tx, settlement.orderId);
      await tx.sirahSettlement.updateMany({ where: { id, status: "PENDING" }, data: { status: "EXPIRED" } });
    });
    return "EXPIRED" as const;
  }
  return "PENDING" as const;
}

export async function handleBalanceStripeEvent(event: Stripe.Event, stripe: Stripe): Promise<boolean> {
  if (!["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed", "checkout.session.expired"].includes(event.type)) return false;
  const session = event.data.object as Stripe.Checkout.Session;
  if (session.metadata?.sirahSource !== SETTLEMENT_SOURCE) return false;
  const id = session.metadata.settlementId;
  if (!id) throw new SirahError("Settlement event missing identifier.", 400);
  await reconcileBalanceSession(id, session.id, stripe);
  return true;
}
