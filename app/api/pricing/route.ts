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
import { priceFor, SIRAH_SLUG } from "@/lib/sirah/catalog";
import { methodAvailable, termsFor, manualAccounts } from "@/lib/sirah/config";
export async function POST(request: Request) {
  try {
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
        couponCode: z.string().optional(),
      })
      .strict()
      .safeParse(body);
    if (!input.success || !(input.data.countryCode in countries))
      return NextResponse.json(
        { error: "Choose a valid billing country and plan." },
        { status: 400 },
      );
    const v = input.data;
    if (v.courseSlug !== SIRAH_SLUG)
      return NextResponse.json({
        pricing: await calculatePricing({
          courseSlug: v.courseSlug,
          countryCode: v.countryCode,
          couponCode: v.couponCode,
        }),
      });
    if (v.couponCode)
      return NextResponse.json(
        {
          error:
            "Additional discounts cannot be stacked with this course’s approved fees.",
        },
        { status: 400 },
      );
    const price = priceFor(
      v.countryCode,
      v.plan,
      v.method || defaultPriceMethod(v.countryCode, v.plan),
    );
    const cohort = await publicSirahCohort();
    const commencementReady = cohortAllowsPayment(termsFor(v.plan, v.countryCode), cohort);
    return NextResponse.json({
      cohort,
      pricing: price,
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
      terms: snapshotSirahCohort(termsFor(v.plan, v.countryCode), cohort),
    });
  } catch {
    return NextResponse.json(
      { error: "Pricing is temporarily unavailable." },
      { status: 503 },
    );
  }
}
