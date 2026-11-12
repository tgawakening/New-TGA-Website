import { withDiscountTerms } from "@/lib/sirah/discount-terms";
import { personalSirahPrice, SirahDiscountError } from "@/lib/sirah/manual-discount";
import {
  publicSirahCohort,
  cohortAllowsPayment,
  snapshotSirahCohort,
} from "@/services/sirah-cohort.service";
import { defaultPriceMethod } from "@/lib/sirah/payment-display";
import { sirahSchemaAvailable } from "@/lib/sirah/readiness";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { countries } from "countries-list";
import { z } from "zod";
import { calculatePricing } from "@/lib/pricing";
import { SIRAH_SLUG } from "@/lib/sirah/catalog";
import { methodAvailable, termsFor, manualAccounts } from "@/lib/sirah/config";
import {
  sirahClientIp,
  sirahRateLimit,
  normalizeEmail,
  MINUTE,
  HOUR,
} from "@/lib/sirah/rate-limit";
export async function POST(request: Request) {
  try {
    const ip = sirahClientIp(request);
    // GENTLE: a generous per-IP ceiling that only trips on an automated flood.
    // The form re-quotes on every field change, and schools/families share one
    // IP, so this is set high and fails open — it never blocks real pricing.
    const flood = sirahRateLimit([
      { key: `pricing:ip:${ip}:m`, limit: 600, windowMs: MINUTE },
    ]);
    if (flood) return flood;
    const body = await request.json().catch(() => null);
    if (body?.legacyRegistrationId) {
      const input = z
        .object({
          legacyRegistrationId: z.string().min(1),
          courseSlug: z.literal(SIRAH_SLUG).optional(),
          countryCode: z.string().length(2).optional(),
          couponCode: z.string().optional(),
        })
        .strict()
        .safeParse(body);
      if (!input.success)
        return NextResponse.json(
          { error: "Invalid saved-order request." },
          { status: 400 },
        );
      const user = await getCurrentUser();
      if (!user || user.status !== "ACTIVE")
        return NextResponse.json(
          { error: "Sign in to resume your saved order." },
          { status: 401 },
        );
      const registration = await prisma.registration.findFirst({
        where: {
          id: input.data.legacyRegistrationId,
          userId: user.id,
          course: { slug: SIRAH_SLUG },
          ...((await sirahSchemaAvailable()) ? { sirahOrder: null } : {}),
        },
        include: { payment: true },
      });
      if (!registration)
        return NextResponse.json(
          { error: "Saved order not found." },
          { status: 404 },
        );
      const snapshot = registration.pricingSnapshot as Record<string, unknown>;
      if (
        !snapshot ||
        !snapshot.display ||
        !snapshot.allowedPaymentMethodsByPlan
      )
        return NextResponse.json(
          {
            error:
              "Your historical pricing metadata needs support review. Your recorded amount and currency are preserved.",
          },
          { status: 409 },
        );
      if (body.couponCode && body.couponCode !== registration.couponCode)
        return NextResponse.json(
          { error: "Historical discounts are locked to the saved agreement." },
          { status: 409 },
        );
      return NextResponse.json(
        {
          pricing: {
            ...snapshot,
            allowedPaymentMethods: [registration.paymentMethod],
            allowedPaymentMethodsByPlan: {
              subscription: [registration.paymentMethod],
              fullCourse: [registration.paymentMethod],
            },
          },
        },
        { headers: { "Cache-Control": "private,no-store" } },
      );
    }
    const input = z
      .object({
        courseSlug: z.string().default(SIRAH_SLUG),
        countryCode: z.string().length(2).toUpperCase(),
        plan: z.enum(["MONTHLY", "ANNUAL"]).default("MONTHLY"),
        method: z
          .enum(["STRIPE", "PAYPAL", "BANK_TRANSFER", "JAZZCASH"])
          .nullable()
          .default(null),
        couponCode: z.string().max(64).optional(),
        email: z.email().max(254).optional(),
      })
      .strict()
      .safeParse(body);
    if (!input.success || !(input.data.countryCode in countries))
      return NextResponse.json(
        { error: "Choose a valid billing country and plan." },
        { status: 400 },
      );
    const v = input.data;
    if (v.couponCode) {
      // STRICT: a coupon on the request means this is the discount-code
      // validation path. Limit per email (stops guessing codes for one address)
      // and per IP (stops scanning). Legitimate use applies a code once or
      // twice; the form clears the coupon on any field change, so normal
      // re-quoting never reaches this path.
      const email = normalizeEmail(v.email || "") || "noemail";
      const limited = sirahRateLimit([
        { key: `pricing-coupon:email:${email}:m`, limit: 5, windowMs: MINUTE },
        { key: `pricing-coupon:email:${email}:h`, limit: 20, windowMs: HOUR },
        { key: `pricing-coupon:ip:${ip}:m`, limit: 30, windowMs: MINUTE },
        { key: `pricing-coupon:ip:${ip}:h`, limit: 300, windowMs: HOUR },
      ]);
      if (limited) return limited;
    }
    if (v.courseSlug !== SIRAH_SLUG)
      return NextResponse.json({
        pricing: await calculatePricing({
          courseSlug: v.courseSlug,
          countryCode: v.countryCode,
          couponCode: v.couponCode,
        }),
      });
    const price = await personalSirahPrice(
      v.countryCode,
      v.plan,
      v.method || defaultPriceMethod(v.countryCode, v.plan),
      v.email || "",
      v.couponCode,
    );
    const cohort = await publicSirahCohort();
    const commencementReady = cohortAllowsPayment(termsFor(v.plan, v.countryCode), cohort);
    return NextResponse.json({
      cohort,
      pricing: { ...price, discount: price.discount ? { label: price.discount.label, originalAmountMinor: price.discount.originalAmountMinor, amountMinor: price.discount.amountMinor } : null },
      methods: (
        ["STRIPE", "PAYPAL", "BANK_TRANSFER", "JAZZCASH"] as const
      ).filter(
        (method) =>
          commencementReady &&
          methodAvailable(method, v.countryCode, price.currency, v.plan),
      ),
      manualAccounts:
        v.countryCode === "PK"
          ? manualAccounts().filter(
              (account) =>
                commencementReady &&
                methodAvailable(
                  account.method,
                  v.countryCode,
                  price.currency,
                  v.plan,
                ),
            )
          : [],
      cardAvailable:
        commencementReady &&
        methodAvailable("STRIPE", v.countryCode, price.currency, v.plan),
      available: v.method
        ? commencementReady &&
          methodAvailable(v.method, v.countryCode, price.currency, v.plan)
        : false,
      terms: withDiscountTerms(snapshotSirahCohort(termsFor(v.plan, v.countryCode), cohort), price.discount, price.currency),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof SirahDiscountError) return NextResponse.json({ error: error.message }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
    return NextResponse.json(
      { error: "Pricing is temporarily unavailable." },
      { status: 503 },
    );
  }
}
