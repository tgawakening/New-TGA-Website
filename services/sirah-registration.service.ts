import { withManualDiscountTerms } from "@/lib/sirah/discount-terms";
import { personalSirahPrice } from "@/lib/sirah/manual-discount";
import { defaultPriceMethod } from "@/lib/sirah/payment-display";
import "server-only";
import { sirahAccessConsentsComplete } from "@/lib/sirah/access-consent";
import {
  recordInitialSirahEvidence,
  type SirahInitialPayment,
} from "./sirah-manual-submission.service";
import {
  publicSirahCohort,
  cohortAllowsPayment,
  snapshotSirahCohort,
} from "./sirah-cohort.service";
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
  payment?: SirahInitialPayment,
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
  const initial = await personalSirahPrice(
    input.countryCode,
    input.plan,
    input.method || defaultPriceMethod(input.countryCode, input.plan),
    input.email,
    input.couponCode,
  );
  const cohort = await publicSirahCohort();
  const initialTerms = withManualDiscountTerms(snapshotSirahCohort(
    termsFor(input.plan, input.countryCode),
    cohort,
  ), initial.discount);
  if (
    input.method &&
    !cohortAllowsPayment(termsFor(input.plan, input.countryCode), cohort)
  )
    throw new SirahError(
      "The first paid teaching date is pending owner confirmation. Contact TGA before registering.",
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
  if (payment) {
    if (
      !input.method ||
      !initialTerms ||
      payment.acceptedTermsVersion !== initialTerms.version
    )
      throw new SirahError(
        "Review the current payment method and accept its terms.",
      );
    if (!sirahAccessConsentsComplete(initialTerms, payment.accessConsents))
      throw new SirahError(
        "Please make the required service-start and recording-access choices.",
      );
    const manual = ["BANK_TRANSFER", "JAZZCASH"].includes(input.method);
    if (manual !== Boolean(payment.manual))
      throw new SirahError(
        "Manual payments require transfer details and a valid receipt.",
      );
  }
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
          input.method && initialTerms
            ? jsonValue(initialTerms)
            : Prisma.DbNull,
        discount: initial.discount ? jsonValue(initial.discount) : Prisma.DbNull,
        pricingVersion: initial.pricingVersion,
        currency: initial.currency,
        amountMinor: initial.amountMinor,
        totalMinor: initial.totalMinor,
        ...(payment?.manual
          ? { paymentState: "AWAITING_REVIEW", revision: 1 }
          : {}),
      },
    });
    await auditSirah(tx, order.id, `student:${userId}`, "REGISTERED", {
      country: input.countryCode,
      phoneCountry: phone.phoneCountry,
      pricingVersion: initial.pricingVersion,
    });
    if (payment?.manual && initialTerms) {
      await recordInitialSirahEvidence(tx, order, initialTerms, payment);
    } else {
      await queueSirahNotice(tx, order.id, "REGISTERED", "created");
    }
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
  const cohort = await publicSirahCohort();
  const commencementReady = cohortAllowsPayment(
    termsFor(order.plan as SirahPlan, order.countryCode),
    cohort,
  );
  const methods = (
    ["BANK_TRANSFER", "JAZZCASH", "STRIPE", "PAYPAL"] as SirahMethod[]
  ).filter(
    (method) =>
      commencementReady &&
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
    cohort,
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
    discount: order.discount ? { applied: true, label: "Personal manual-payment discount", originalAmountMinor: (order.discount as { originalAmountMinor: number }).originalAmountMinor, amountMinor: order.amountMinor } : null,
    paymentState: order.paymentState,
    enrolmentState: order.enrolmentState,
    revision: order.revision,
    paidMinor: order.paidMinor,
    programmeEnd: order.programmeEnd,
    cancelledAt: order.cancelledAt,
    accessEndsAt: order.accessEndsAt,
    nextBillingAt: order.nextBillingAt,
    hasBillingProfile: !!order.providerSubscriptionId,
    receipts: order.receipts,
    terms:
      (order.terms as SirahTerms | null) ||
      termsFor(order.plan as SirahPlan, order.countryCode),
    manualEvidenceAllowed:
      ["BANK_TRANSFER", "JAZZCASH"].includes(order.method || "") &&
      !!order.terms,
    methods,
    manualAccounts:
      order.countryCode === "PK" &&
      methods.some((m) => ["BANK_TRANSFER", "JAZZCASH"].includes(m))
        ? manualAccounts().filter((account) => methods.includes(account.method))
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
  couponCode?: string,
) {
  const owned = await ownedSirahOrder(orderId, userId);
  const student = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
  const price = await personalSirahPrice(
    countryCode,
    plan,
    method || defaultPriceMethod(countryCode, plan),
    student.email,
    couponCode,
    owned.discount,
  );
  const cohort = await publicSirahCohort();
  const selectedTerms = withManualDiscountTerms(snapshotSirahCohort(
    termsFor(plan, countryCode),
    cohort,
  ), price.discount);
  if (method && !cohortAllowsPayment(termsFor(plan, countryCode), cohort))
    throw new SirahError(
      "The first paid teaching date is pending owner confirmation. Payment remains closed.",
    );
  if (
    method &&
    !methodAvailable(method, countryCode, price.currency, plan, {
      id: orderId,
      amountMinor: price.amountMinor,
    })
  )
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
        discount: price.discount ? jsonValue(price.discount) : Prisma.DbNull,
        terms: selectedTerms ? jsonValue(selectedTerms) : Prisma.DbNull,
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
      discount: price.discount,
    });
  });
  return publicSirahOrder(orderId, userId);
}
