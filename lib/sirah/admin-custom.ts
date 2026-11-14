import { Prisma } from "@prisma/client";
import { z } from "zod";
import { SIRAH_TITLE } from "./catalog";

/**
 * Admin-issued custom payment links (sponsorships, in-person/group bookings,
 * agreed custom prices). The order's own `amountMinor` IS the custom amount, so
 * the unchanged Stripe verification (`amount_total === order.amountMinor`) and
 * `confirmSirahPayment` (amount/currency/method must match the locked order)
 * both apply exactly as for a self-registered checkout. Nothing here loosens
 * an amount check; it only stops other code paths from repricing the order.
 */
export const ADMIN_CUSTOM_PRICING_VERSION = "admin-custom-link-v1";
export const ADMIN_CUSTOM_SOURCE = "admin-custom-link";
/** Stripe allows at most 24h; keep a margin so the link never outlives it. */
export const ADMIN_CUSTOM_LINK_TTL_SECONDS = 23 * 3600 + 30 * 60;

export type AdminCustomLinkSnapshot = {
  kind: "ADMIN_CUSTOM_LINK";
  label: string;
  /** Read by confirmSirahPayment as the Registration base amount. Equals the
   * catalog price when it is in the same currency and not below the custom
   * amount; otherwise the custom amount, so no negative discount is recorded. */
  originalAmountMinor: number;
  amountMinor: number;
  catalogAmountMinor: number;
  catalogCurrency: string;
  sponsorLabel: string | null;
  note: string | null;
  createdBy: string;
  createdAt: string;
};

export function buildAdminCustomSnapshot(input: {
  amountMinor: number;
  currency: string;
  catalogAmountMinor: number;
  catalogCurrency: string;
  sponsorLabel?: string | null;
  note?: string | null;
  createdBy: string;
  now?: Date;
}): AdminCustomLinkSnapshot {
  const comparable =
    input.catalogCurrency === input.currency &&
    input.catalogAmountMinor >= input.amountMinor;
  return {
    kind: "ADMIN_CUSTOM_LINK",
    label: input.sponsorLabel
      ? `Admin custom payment link (${input.sponsorLabel})`
      : "Admin custom payment link",
    originalAmountMinor: comparable ? input.catalogAmountMinor : input.amountMinor,
    amountMinor: input.amountMinor,
    catalogAmountMinor: input.catalogAmountMinor,
    catalogCurrency: input.catalogCurrency,
    sponsorLabel: input.sponsorLabel?.trim() || null,
    note: input.note?.trim() || null,
    createdBy: input.createdBy,
    createdAt: (input.now || new Date()).toISOString(),
  };
}

export function adminCustomSnapshot(order: {
  discount?: unknown;
}): AdminCustomLinkSnapshot | null {
  const value = order.discount as Partial<AdminCustomLinkSnapshot> | null;
  return value && typeof value === "object" && value.kind === "ADMIN_CUSTOM_LINK"
    ? (value as AdminCustomLinkSnapshot)
    : null;
}

export function isAdminCustomOrder(order: {
  discount?: unknown;
  pricingVersion?: string | null;
}) {
  return (
    order.pricingVersion === ADMIN_CUSTOM_PRICING_VERSION ||
    adminCustomSnapshot(order) !== null
  );
}

export const ADMIN_CUSTOM_LOCKED_MESSAGE =
  "This registration has a price agreed with the TGA team. Use the payment link the team sent, or contact support to change it.";

/** A student may never reprice, change method or self-checkout a custom order. */
export function studentPriceChangeRefusal(order: {
  discount?: unknown;
  pricingVersion?: string | null;
}) {
  return isAdminCustomOrder(order) ? ADMIN_CUSTOM_LOCKED_MESSAGE : null;
}

/**
 * Data written when an abandoned/expired online checkout is cleared.
 * Self-registered orders return to the catalog quote (unchanged behaviour).
 * Admin custom orders keep their agreed amount, method, terms and snapshot;
 * only the dead provider attempt is cleared so the admin can issue a new link.
 */
export function unsettledCheckoutResetData(
  order: {
    discount?: unknown;
    pricingVersion?: string | null;
  },
  catalogQuote: {
    amountMinor: number;
    totalMinor: number;
    pricingVersion: string;
  },
) {
  const cleared = {
    providerOrderId: null,
    providerSubscriptionId: null,
    providerPlanId: null,
    checkoutToken: null,
    paymentState: "UNPAID",
    revision: { increment: 1 },
  } as const;
  if (isAdminCustomOrder(order)) return { ...cleared };
  return {
    ...cleared,
    method: null,
    amountMinor: catalogQuote.amountMinor,
    totalMinor: catalogQuote.totalMinor,
    // Drop the locked quote's discount and terms so the base amount cannot
    // drift from a stale personal-discount snapshot; re-selecting a method
    // re-resolves both server-side.
    discount: Prisma.DbNull,
    terms: Prisma.DbNull,
    pricingVersion: catalogQuote.pricingVersion,
  };
}

/** Stripe Checkout Session for the order's exact locked amount.
 * - ANNUAL: one-time payment (full programme).
 * - MONTHLY: a monthly subscription built the same way as the student's own
 *   monthly card checkout (mode "subscription", recurring monthly price at the
 *   order amount, ownership metadata on the subscription).
 * Same ownership metadata as the student checkout, so the existing webhook,
 * verifySirahStripeSession and verifySirahStripeInvoice accept it unchanged. */
export function buildAdminCustomCheckoutParams(
  order: {
    id: string;
    checkoutToken: string;
    currency: string;
    amountMinor: number;
    reference: string;
    plan?: "ANNUAL" | "MONTHLY";
  },
  options: { appUrl: string; email: string; now?: Date },
) {
  const metadata = {
    sirahOrderId: order.id,
    checkoutToken: order.checkoutToken,
    sirahSource: ADMIN_CUSTOM_SOURCE,
    studentEmail: options.email,
  };
  const nowSeconds = Math.floor((options.now || new Date()).getTime() / 1000);
  const shared = {
    // Keep TGA as the seller, matching the student checkout.
    ...{ managed_payments: { enabled: false } },
    client_reference_id: order.id,
    customer_email: options.email,
    expires_at: nowSeconds + ADMIN_CUSTOM_LINK_TTL_SECONDS,
    success_url: `${options.appUrl}/seerah?payment=received&reference=${encodeURIComponent(order.reference)}`,
    cancel_url: `${options.appUrl}/seerah`,
    metadata,
  };
  if (order.plan === "MONTHLY")
    return {
      ...shared,
      mode: "subscription" as const,
      subscription_data: {
        metadata,
        description: `${SIRAH_TITLE} — ${order.reference}`,
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: order.currency.toLowerCase(),
            unit_amount: order.amountMinor,
            product_data: { name: `${SIRAH_TITLE} — monthly` },
            recurring: { interval: "month" as const },
          },
        },
      ],
    };
  return {
    ...shared,
    mode: "payment" as const,
    payment_intent_data: {
      metadata,
      description: `${SIRAH_TITLE} — ${order.reference}`,
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: order.currency.toLowerCase(),
          unit_amount: order.amountMinor,
          product_data: { name: `${SIRAH_TITLE} — full programme` },
        },
      },
    ],
  };
}

export const sirahAdminCustomLinkSchema = z
  .object({
    fullName: z.string().trim().min(2).max(120),
    email: z.string().trim().toLowerCase().email().max(254),
    plan: z.enum(["ANNUAL", "MONTHLY"]),
    countryCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/)
      .optional(),
    amount: z.string().trim().regex(/^\d+(\.\d{1,3})?$/),
    sponsorLabel: z.string().trim().max(120).optional(),
    note: z.string().trim().max(1000).optional(),
    phone: z
      .object({
        country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/),
        callingCode: z.string().trim().regex(/^\+\d{1,4}$/),
        number: z.string().trim().min(4).max(30),
      })
      .optional(),
  })
  .strict();
export type SirahAdminCustomLinkInput = z.infer<typeof sirahAdminCustomLinkSchema>;
