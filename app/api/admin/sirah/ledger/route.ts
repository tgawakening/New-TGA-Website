import { prisma } from "@/lib/prisma";
import { decimalToMinor } from "@/lib/sirah/catalog";
import { checkSirahOrigin, privateJson, sirahExclusionActor, sirahReadAccess, sirahResponseError } from "@/lib/sirah/http";
import { serializable } from "@/services/sirah-confirmation.service";
import { assertLedgerUnlocked, lockLedgerOrder } from "@/services/sirah-settlement.service";
import { SirahError } from "@/services/sirah-registration.service";

export async function GET(request: Request) {
  try {
    await sirahReadAccess(request);
    const id = new URL(request.url).searchParams.get("id") || "";
    const order = await prisma.sirahOrder.findUnique({ where: { id }, select: { currency: true, ledgerFeeMinor: true, ledgerFeeCurrency: true, settlements: { where: { status: "PENDING" }, select: { id: true, currency: true, amountMinor: true }, take: 1 }, ledgerPayments: { orderBy: { receivedAt: "desc" } }, agreement: { select: { filename: true } } } });
    if (!order) throw new SirahError("Registration not found.", 404);
    return privateJson(order);
  } catch (error) { return sirahResponseError(error); }
}

export async function POST(request: Request) {
  try {
    checkSirahOrigin(request);
    const actor = await sirahExclusionActor(request);
    const body = await request.json();
    if (typeof body.id !== "string") throw new SirahError("Invalid registration.");
    const order = await prisma.sirahOrder.findUnique({ where: { id: body.id }, select: { id: true, currency: true } });
    if (!order) throw new SirahError("Registration not found.", 404);
    if (typeof body.amount !== "string" || body.amount.length > 20) throw new SirahError("Enter a valid amount.");
    let amount: number;
    try { amount = decimalToMinor(body.amount, order.currency); } catch { throw new SirahError("Enter a valid amount in the registration currency."); }
    if (amount > 2147483647) throw new SirahError("Amount is too large.");
    if (body.action === "fee") {
      await serializable(async (tx) => {
        await lockLedgerOrder(tx, order.id);
        await assertLedgerUnlocked(tx, order.id);
        const current = await tx.sirahOrder.findUniqueOrThrow({ where: { id: order.id }, select: { currency: true } });
        if (current.currency !== order.currency) throw new SirahError("Registration currency changed. Try again.", 409);
        await tx.sirahOrder.update({ where: { id: order.id }, data: { ledgerFeeMinor: amount, ledgerFeeCurrency: order.currency } });
      });
    } else if (body.action === "payment") {
      if (amount <= 0 || !["JAZZCASH", "BANK", "CASH", "STRIPE", "OTHER"].includes(body.method) || typeof body.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) throw new SirahError("Check the payment details.");
      const receivedAt = new Date(`${body.date}T00:00:00.000Z`);
      if (Number.isNaN(receivedAt.getTime()) || receivedAt.toISOString().slice(0, 10) !== body.date) throw new SirahError("Enter a valid date.");
      if (body.note != null && (typeof body.note !== "string" || body.note.length > 1000)) throw new SirahError("Note is too long.");
      await serializable(async (tx) => {
        await lockLedgerOrder(tx, order.id);
        await assertLedgerUnlocked(tx, order.id);
        const current = await tx.sirahOrder.findUniqueOrThrow({ where: { id: order.id }, select: { currency: true } });
        if (current.currency !== order.currency) throw new SirahError("Registration currency changed. Try again.", 409);
        await tx.sirahLedgerPayment.create({ data: { orderId: order.id, amountMinor: amount, currency: order.currency, method: body.method, receivedAt, note: body.note?.trim() || null, createdBy: actor } });
      });
    } else throw new SirahError("Invalid action.");
    return privateJson({ ok: true });
  } catch (error) { return sirahResponseError(error); }
}
