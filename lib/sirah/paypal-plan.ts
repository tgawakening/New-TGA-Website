import { z } from "zod";
import { decimalToMinor } from "./catalog";
const schema = z.object({
  id: z.string(),
  status: z.string(),
  product_id: z.string(),
  quantity_supported: z.boolean(),
  billing_cycles: z.array(
    z.object({
      tenure_type: z.string(),
      sequence: z.number(),
      total_cycles: z.number(),
      frequency: z.object({
        interval_unit: z.string(),
        interval_count: z.number(),
      }),
      pricing_scheme: z.object({
        fixed_price: z.object({ currency_code: z.string(), value: z.string() }),
      }),
    }),
  ),
  payment_preferences: z.object({
    auto_bill_outstanding: z.boolean(),
    payment_failure_threshold: z.number(),
    setup_fee: z
      .object({ currency_code: z.string(), value: z.string() })
      .optional(),
  }),
  taxes: z.object({ percentage: z.string().optional() }).nullish(),
});
export function paypalPlanIssue(
  value: unknown,
  expected: { productId: string; currency: string; amountMinor: number },
): string | null {
  const parsed = schema.safeParse(value);
  if (!parsed.success) return "Incomplete PayPal plan details.";
  const plan = parsed.data;
  if (plan.status !== "ACTIVE" || plan.product_id !== expected.productId)
    return "Plan is not active under the configured Sīrah product.";
  if (plan.quantity_supported)
    return "Plan allows a different subscription quantity.";
  const cycle = plan.billing_cycles[0];
  if (
    plan.billing_cycles.length !== 1 ||
    cycle.tenure_type !== "REGULAR" ||
    cycle.sequence !== 1 ||
    cycle.total_cycles !== 12 ||
    cycle.frequency.interval_unit !== "MONTH" ||
    cycle.frequency.interval_count !== 1
  )
    return "Plan must bill once per month for exactly 12 regular cycles.";
  try {
    if (
      cycle.pricing_scheme.fixed_price.currency_code !== expected.currency ||
      decimalToMinor(
        cycle.pricing_scheme.fixed_price.value,
        expected.currency,
      ) !== expected.amountMinor
    )
      return "Plan amount or currency differs from the server quote.";
    const fee = plan.payment_preferences.setup_fee;
    if (
      fee &&
      (fee.currency_code !== expected.currency ||
        decimalToMinor(fee.value, expected.currency) !== 0)
    )
      return "Plan adds an unapproved setup fee.";
  } catch {
    return "Plan contains an invalid monetary amount.";
  }
  if (
    plan.payment_preferences.auto_bill_outstanding ||
    plan.payment_preferences.payment_failure_threshold !== 1
  )
    return "Outstanding-balance collection or payment-failure settings differ from this flow.";
  if (plan.taxes && Number(plan.taxes.percentage || "0") !== 0)
    return "Plan adds tax outside the current verified amount model.";
  return null;
}
