import { defaultPriceMethod } from "@/lib/sirah/payment-display";
import "server-only";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { countries } from "countries-list";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  SIRAH_SLUG,
  SIRAH_TITLE,
  SIRAH_BATCH,
  priceFor,
  type SirahMethod,
  type SirahPlan,
} from "@/lib/sirah/catalog";
import { normalizeSirahPhone } from "@/lib/sirah/phone";
import {
  methodAvailable,
  termsFor,
  manualAccounts,
  PAYMENT_SUPPORT_URL,
  type SirahTerms,
} from "@/lib/sirah/config";
import { sirahRegistrationSchema } from "@/lib/sirah/validation";
import {
  queueSirahNotice,
  dispatchSirahNotifications,
} from "./sirah-notifications.service";
export class SirahError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export const jsonValue = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export async function auditSirah(
  tx: Prisma.TransactionClient,
  orderId: string,
  actor: string,
  action: string,
  detail: unknown,
) {
  await tx.sirahAudit.create({
    data: { orderId, actor, action, detail: jsonValue(detail) },
  });
}
export async function registerSirah(
  input: z.infer<typeof sirahRegistrationSchema>,
  signedInUserId?: string,
) {
  const phone = normalizeSirahPhone(
    input.phoneCountry,
    input.callingCode,
    input.phone,
  );
  let userId = signedInUserId;
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });
  if (!signedInUserId && existing)
    throw new SirahError(
      "This email has an account. Please sign in to register without creating another account.",
      409,
    );
  const hash =
    !userId && input.password ? await bcrypt.hash(input.password, 12) : null;
  if (!userId && !hash)
    throw new SirahError("Create an account password or sign in.");
  const initial = priceFor(
    input.countryCode,
    input.plan,
    input.method || defaultPriceMethod(input.countryCode, input.plan),
  );
  if (
    input.method &&
    !methodAvailable(
      input.method,
      input.countryCode,
      initial.currency,
      input.plan,
    )
  )
    throw new SirahError(
      "This payment method is no longer available. Please review the current options.",
    );
  const result = await prisma.$transaction(async (tx) => {
    if (userId) {
      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { status: true, email: true },
      });
      if (user.status !== "ACTIVE")
        throw new SirahError("Your account is not active.", 403);
      if (user.email !== input.email)
        throw new SirahError("Use your signed-in account email.");
    } else {
      const user = await tx.user.create({
        data: {
          fullName: input.fullName,
          email: input.email,
          passwordHash: hash!,
          phoneCountryCode: phone.phoneCountryCode,
          phoneNumber: phone.phoneNumber,
          studentProfile: {
            create: {
              countryCode: input.countryCode,
              countryName:
                countries[input.countryCode as keyof typeof countries].name,
            },
          },
        },
      });
      userId = user.id;
    }
    // Stable course record. Updating the title does not reprice any existing registration.
    const course = await tx.course.upsert({
      where: { slug: SIRAH_SLUG },
      create: {
        slug: SIRAH_SLUG,
        title: SIRAH_TITLE,
        basePrice: 2999,
        currency: "GBP",
        isActive: true,
      },
      update: { title: SIRAH_TITLE },
    });
    const previous = await tx.sirahOrder.findUnique({
      where: {
        userId_courseId_batchCode: {
          userId: userId!,
          courseId: course.id,
          batchCode: SIRAH_BATCH,
        },
      },
    });
    if (previous)
      return { userId: userId!, orderId: previous.id, existing: true };
    const order = await tx.sirahOrder.create({
      data: {
        userId: userId!,
        courseId: course.id,
        batchCode: SIRAH_BATCH,
        reference: `SIRAH-${randomUUID().toUpperCase()}`,
        requestKey: input.requestKey,
        phoneCountry: phone.phoneCountry,
        phoneE164: phone.phoneE164,
        countryCode: input.countryCode,
        countryName:
          countries[input.countryCode as keyof typeof countries].name,
        marketCode: initial.market,
        plan: input.plan,
        method: input.method || null,
        terms:
          input.method && termsFor(input.plan)
            ? jsonValue(termsFor(input.plan))
            : Prisma.DbNull,
        pricingVersion: initial.pricingVersion,
        currency: initial.currency,
        amountMinor: initial.amountMinor,
        totalMinor: initial.totalMinor,
      },
    });
    await auditSirah(tx, order.id, `student:${userId}`, "REGISTERED", {
      country: input.countryCode,
      phoneCountry: phone.phoneCountry,
      pricingVersion: initial.pricingVersion,
    });
    await queueSirahNotice(tx, order.id, "REGISTERED", "created");
    return { userId: userId!, orderId: order.id, existing: false };
  });
  await dispatchSirahNotifications(result.orderId).catch(() => {});
  return result;
}
export async function ownedSirahOrder(orderId: string, userId: string) {
  const order = await prisma.sirahOrder.findFirst({
    where: { id: orderId, userId, course: { slug: SIRAH_SLUG } },
    include: {
      receipts: {
        select: { id: true, revision: true, filename: true, createdAt: true },
        orderBy: { revision: "desc" },
      },
      notifications: {
        select: { kind: true, state: true },
        where: { toEmail: { not: "" } },
      },
    },
  });
  if (!order) throw new SirahError("Registration not found.", 404);
  return order;
}
export async function publicSirahOrder(orderId: string, userId: string) {
  const order = await ownedSirahOrder(orderId, userId);
  const methods = (
    ["BANK_TRANSFER", "JAZZCASH", "STRIPE", "PAYPAL"] as SirahMethod[]
  ).filter((method) =>
    methodAvailable(
      method,
      order.countryCode,
      order.currency,
      order.plan as SirahPlan,
    ),
  );
  const student = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { fullName: true, email: true },
  });
  return {
    id: order.id,
    fullName: student.fullName,
    email: student.email,
    reference: order.reference,
    courseTitle: SIRAH_TITLE,
    batchCode: order.batchCode,
    phoneE164: order.phoneE164,
    phoneCountry: order.phoneCountry,
    countryCode: order.countryCode,
    countryName: order.countryName,
    marketCode: order.marketCode,
    plan: order.plan,
    method: order.method,
    currency: order.currency,
    amountMinor: order.amountMinor,
    totalMinor: order.totalMinor,
    pricingVersion: order.pricingVersion,
    paymentState: order.paymentState,
    enrolmentState: order.enrolmentState,
    revision: order.revision,
    paidMinor: order.paidMinor,
    programmeEnd: order.programmeEnd,
    nextBillingAt: order.nextBillingAt,
    hasBillingProfile: !!order.providerSubscriptionId,
    receipts: order.receipts,
    terms:
      (order.terms as SirahTerms | null) || termsFor(order.plan as SirahPlan),
    manualEvidenceAllowed:
      ["BANK_TRANSFER", "JAZZCASH"].includes(order.method || "") &&
      !!order.terms,
    methods,
    manualAccounts:
      order.countryCode === "PK" &&
      methods.some((m) => ["BANK_TRANSFER", "JAZZCASH"].includes(m))
        ? manualAccounts()
        : [],
    paymentSupportUrl: PAYMENT_SUPPORT_URL,
    // Deliberately no course-group URL. The confirmed endpoint checks entitlement.
  };
}
export async function repriceSirah(
  orderId: string,
  userId: string,
  revision: number,
  countryCode: string,
  plan: SirahPlan,
  method: SirahMethod | null,
) {
  const price = priceFor(
    countryCode,
    plan,
    method || defaultPriceMethod(countryCode, plan),
  );
  if (method && !methodAvailable(method, countryCode, price.currency, plan))
    throw new SirahError(
      "This payment route is not approved or configured for this market and plan.",
    );
  await prisma.$transaction(async (tx) => {
    const result = await tx.sirahOrder.updateMany({
      where: {
        id: orderId,
        userId,
        revision,
        paymentState: { in: ["UNPAID", "REJECTED", "FAILED"] },
        enrolmentState: "PENDING",
        paidCount: 0,
        providerOrderId: null,
        providerSubscriptionId: null,
      },
      data: {
        countryCode,
        countryName: countries[countryCode as keyof typeof countries].name,
        plan,
        method,
        marketCode: price.market,
        currency: price.currency,
        amountMinor: price.amountMinor,
        totalMinor: price.totalMinor,
        pricingVersion: price.pricingVersion,
        terms: termsFor(plan) ? jsonValue(termsFor(plan)) : Prisma.DbNull,
        revision: { increment: 1 },
      },
    });
    if (result.count !== 1)
      throw new SirahError(
        "This order changed or has a payment in progress. Reload it before changing fees.",
        409,
      );
    await auditSirah(tx, orderId, `student:${userId}`, "REPRICED", {
      countryCode,
      plan,
      method,
      pricingVersion: price.pricingVersion,
    });
  });
  return publicSirahOrder(orderId, userId);
}
