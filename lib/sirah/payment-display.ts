import "server-only";
import { catalogue, priceFor, type SirahPlan } from "./catalog";
import { methodAvailable } from "./config";
export function defaultPriceMethod(country: string, plan: SirahPlan) {
  if (country !== "PK" || plan !== "MONTHLY") return null;
  return methodAvailable("STRIPE", country, "PKR", plan)
    ? "STRIPE"
    : "BANK_TRANSFER";
}
export function planAvailability() {
  return Object.fromEntries(
    catalogue.map(([country]) => [
      country,
      Object.fromEntries(
        (["MONTHLY", "ANNUAL"] as const).map((plan) => {
          const price = priceFor(country, plan, null);
          return [
            plan,
            (["STRIPE", "PAYPAL", "BANK_TRANSFER", "JAZZCASH"] as const).some(
              (method) =>
                methodAvailable(method, country, price.currency, plan),
            ),
          ];
        }),
      ),
    ]),
  );
}
