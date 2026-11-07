/** Inspect by default. --apply provisions reusable plans, never charges a student.
 * Needs approved monthly terms and --merchant-order <existing PayPal order ID>
 * to independently match the configured merchant before any provider mutation.
 */
import { createHash } from "node:crypto";
import { priceFor } from "../lib/sirah/catalog";
import { paypalPlanIssue } from "../lib/sirah/paypal-plan";
import { termsFor } from "../lib/sirah/config";
import { paypalRequest, paypalDecimal } from "../services/sirah-online.service";
const markets = ["GB", "US", "CA", "DE", "CH", "SE", "NO", "DK", "PL", "CZ", "HU"];
async function main() {
  const apply = process.argv.includes("--apply");
  const productId = process.env.SIRAH_PAYPAL_PRODUCT_ID;
  if (!productId || !process.env.SIRAH_PAYPAL_MERCHANT_ID) throw Error("Existing Sīrah product and merchant configuration are required.");
  const product = await paypalRequest(`/v1/catalogs/products/${encodeURIComponent(productId)}`);
  if (product.id !== productId || product.type !== "SERVICE") throw Error("Sīrah product verification failed.");
  let mayApply = false;
  if (apply) {
    if (!termsFor("MONTHLY")) throw Error("Approved monthly terms must be installed before provisioning.");
    const orderId = process.argv[process.argv.indexOf("--merchant-order") + 1];
    if (!process.argv.includes("--merchant-order") || !orderId || !/^[A-Z0-9]{10,30}$/.test(orderId)) throw Error("An existing provider order is required to verify the merchant.");
    const order = await paypalRequest(`/v2/checkout/orders/${orderId}`);
    const payees = order.purchase_units?.map((p: { payee?: { merchant_id?: string } }) => p.payee?.merchant_id);
    if (!payees?.length || !payees.every((id: string) => id === process.env.SIRAH_PAYPAL_MERCHANT_ID)) throw Error("PayPal order merchant does not match configuration.");
    mayApply = true;
  }
  const existing: unknown[] = [];
  for (let page = 1; page <= 100; page++) {
    const list = await paypalRequest(`/v1/billing/plans?product_id=${encodeURIComponent(productId)}&page_size=20&page=${page}&total_required=true`);
    for (const plan of list.plans || []) existing.push(await paypalRequest(`/v1/billing/plans/${encodeURIComponent(plan.id)}`));
    if (!list.links?.some((link: {rel: string}) => link.rel === "next")) break;
    if (page === 100) throw Error("Plan inventory incomplete; refusing creation.");
  }
  const results = [];
  for (const market of markets) {
    const quote = priceFor(market, "MONTHLY", "PAYPAL");
    const expected = { productId, currency: quote.currency, amountMinor: quote.amountMinor };
    const matched = existing.find(plan => !paypalPlanIssue(plan, expected)) as { id: string } | undefined;
    let planId = matched?.id;
    if (!planId && mayApply) {
      const plan = await paypalRequest("/v1/billing/plans", "POST", {
        product_id: productId, status: "ACTIVE", quantity_supported: false,
        name: `Sirah voluntary monthly ${quote.currency} ${paypalDecimal(quote.amountMinor, quote.currency)}`,
        billing_cycles: [{ frequency: { interval_unit: "MONTH", interval_count: 1 }, tenure_type: "REGULAR", sequence: 1, total_cycles: 12, pricing_scheme: { fixed_price: { currency_code: quote.currency, value: paypalDecimal(quote.amountMinor, quote.currency) } } }],
        payment_preferences: { auto_bill_outstanding: false, payment_failure_threshold: 1 },
      }, createHash("sha256").update(`sirah-plan-v1:${process.env.PAYPAL_ENV}:${process.env.SIRAH_PAYPAL_MERCHANT_ID}:${productId}:${quote.currency}:${quote.amountMinor}`).digest("hex").slice(0, 38));
      planId = plan.id;
      const verified = await paypalRequest(`/v1/billing/plans/${encodeURIComponent(planId!)}`);
      const issue = paypalPlanIssue(verified, expected);
      if (issue || verified.id !== planId) throw Error(issue || "Created plan identity mismatch.");
      existing.push(verified);
    }
    results.push({ currency: quote.currency, amount: paypalDecimal(quote.amountMinor, quote.currency), planId: planId || null, status: planId ? "ACTIVE_COMPATIBLE" : "MISSING_COMPATIBLE_PLAN", action: matched ? "REUSE" : planId ? "CREATED" : "NO_CHANGE", configurationKey: `SIRAH_PAYPAL_MONTHLY_PLAN_${quote.currency}`, websiteEnabled: false, settlementVerified: false });
  }
  console.log(JSON.stringify({ mode: apply ? "apply" : "inspect", productId, results }, null, 2));
}
main().catch((error: Error) => { console.error(error.message); process.exitCode = 1; });
