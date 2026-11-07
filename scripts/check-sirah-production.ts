/** Read-only operational audit, except an explicit idempotent email to configured admins.
 * Run in the existing App Platform runtime. Never prints student identities or credentials.
 */
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { prisma } from "../lib/prisma";
import { sendTransactionalEmail } from "../lib/email";
import { paypalRequest } from "../services/sirah-online.service";
import { manualAccounts, termsFor } from "../lib/sirah/config";

async function main() {
  const report: Record<string, unknown> = {};
  report.activeStaff = await prisma.user.count({ where: { role: "ADMIN", status: "ACTIVE" } });
  report.registrationStates = await prisma.sirahOrder.groupBy({ by: ["paymentState", "enrolmentState"], _count: true });
  report.notifications = await prisma.sirahNotification.groupBy({ by: ["kind", "state"], _count: true });
  report.monthlyTermsConfigured = !!termsFor("MONTHLY");
  report.annualTermsConfigured = !!termsFor("ANNUAL");
  const legacy = await readFile("components/sirah/legacy-registration.tsx", "utf8");
  report.receivingDetailsMatchExistingRecords = ["SIRAH_MEEZAN_HOLDER", "SIRAH_MEEZAN_ACCOUNT", "SIRAH_MEEZAN_IBAN", "SIRAH_JAZZCASH_HOLDER", "SIRAH_JAZZCASH_ACCOUNT"].every(key => {
    const value = process.env[key]?.trim();
    return !!value && legacy.toUpperCase().includes(value.toUpperCase());
  });
  report.approvedManualAccounts = manualAccounts().map(a => a.method);
  // Read existing provider records only. No order, capture, or subscription is created.
  const orders = await prisma.payment.findMany({ where: { provider: "PAYPAL", providerOrderId: { not: null } }, select: { providerOrderId: true }, orderBy: { createdAt: "desc" }, take: 5 });
  let merchantVerified = false;
  let inspectedOrders = 0;
  for (const order of orders) {
    try {
      const value = await paypalRequest(`/v2/checkout/orders/${encodeURIComponent(order.providerOrderId!)}`);
      inspectedOrders++;
      const payees: string[] = value.purchase_units?.map((unit: {payee?: {merchant_id?: string}}) => unit.payee?.merchant_id).filter(Boolean) || [];
      if (payees.length && payees.every(id => id === process.env.SIRAH_PAYPAL_MERCHANT_ID)) merchantVerified = true;
    } catch { /* Old/inaccessible records cannot establish current merchant identity. */ }
  }
  report.paypalMerchant = { inspectedOrders, matchesExistingProviderRecord: merchantVerified };
  const runId = process.env.SIRAH_OPERATIONS_RUN_ID;
  if (process.env.SIRAH_OPERATIONS_SEND_EMAIL === "true") {
    if (!runId || !/^[a-zA-Z0-9_-]{8,80}$/.test(runId)) throw Error("Explicit operational run ID is required.");
    const recipients = [...new Set((process.env.ADMIN_NOTIFICATION_EMAIL || "").split(",").map(v => v.trim()).filter(Boolean))];
    const deliveries = [];
    for (const to of recipients) {
      const emailType = `SIRAH_OPS_${runId}`;
      let sent = await prisma.emailLog.findFirst({ where: { toEmail: to, emailType, status: "SENT" }, orderBy: { createdAt: "desc" } });
      if (!sent) {
        const text = "TGA Sīrah operational email delivery check. No student payment or enrolment was created or confirmed. This single message verifies the existing transactional sender and admin delivery path.";
        await sendTransactionalEmail({ to, emailType, idempotencyKey: createHash("sha256").update(`${emailType}:${to}`).digest("hex"), subject: "Sīrah registration — operational delivery check", html: `<p>${text}</p>`, text });
        sent = await prisma.emailLog.findFirst({ where: { toEmail: to, emailType, status: "SENT" }, orderBy: { createdAt: "desc" } });
      }
      let delivery: string = "unverified";
      if (sent?.providerId && process.env.RESEND_API_KEY) {
        const response = await fetch(`https://api.resend.com/emails/${encodeURIComponent(sent.providerId)}`, { headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` } });
        if (response.ok) delivery = (await response.json()).last_event || "accepted";
        else delivery = `accepted; delivery lookup HTTP ${response.status}`;
      }
      deliveries.push({ emailLogId: sent?.id || null, providerId: sent?.providerId || null, delivery });
    }
    report.adminDeliveryChecks = deliveries;
  }
  console.log(JSON.stringify(report, null, 2));
}
main().catch(() => { console.error("Sīrah operational audit failed; no credentials or student details printed."); process.exitCode = 1; }).finally(() => prisma.$disconnect());
