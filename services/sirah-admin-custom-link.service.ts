import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import type Stripe from "stripe";
import { countries } from "countries-list";
import { prisma } from "@/lib/prisma";
import { sendTransactionalEmail } from "@/lib/email";
import {
  SIRAH_BATCH,
  SIRAH_SLUG,
  SIRAH_TITLE,
  catalogue,
  decimalToMinor,
  formatSirahMoney,
  priceFor,
} from "@/lib/sirah/catalog";
import { termsFor } from "@/lib/sirah/config";
import { normalizeSirahPhone } from "@/lib/sirah/phone";
import {
  ADMIN_CUSTOM_PRICING_VERSION,
  buildAdminCustomCheckoutParams,
  buildAdminCustomSnapshot,
  type SirahAdminCustomLinkInput,
} from "@/lib/sirah/admin-custom";
import { auditSirah, jsonValue, SirahError } from "./sirah-registration.service";
import {
  cohortAllowsPayment,
  publicSirahCohort,
  snapshotSirahCohort,
} from "./sirah-cohort.service";
import {
  resetUnsettledSirahCheckout,
  stripeClient,
  verifyStripeMerchant,
} from "./sirah-online.service";

/** Stripe's single-charge ceiling for 2-decimal currencies (99,999,999 minor). */
const STRIPE_MAX_MINOR = 99_999_999;
const SUPPORTED_CURRENCIES = new Set<string>(catalogue.map((row) => row[2]));
const appUrl = () =>
  (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

function temporaryPassword() {
  // Same shape as scholarship approvals (TGA-xxxxxx#2026), cryptographically random.
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  for (const byte of randomBytes(8)) out += alphabet[byte % alphabet.length];
  return `TGA-${out}#2026`;
}

/**
 * Admin-created custom-price enrolment, paid through a one-time Stripe Checkout
 * Session on the Sīrah Stripe account. The SirahOrder's amountMinor IS the
 * custom amount, so the unchanged webhook → verifySirahStripeSession →
 * confirmSirahPayment path settles and enrols it with every amount check intact.
 * Annual (full programme, one-time) only in this version.
 */
export async function createSirahAdminCustomLink(
  input: SirahAdminCustomLinkInput,
  actor: string,
  stripeOverride?: Stripe,
) {
  const countryCode = input.countryCode;
  if (!(countryCode in countries))
    throw new SirahError("Choose a valid country.");
  const plan = "ANNUAL" as const;
  const catalog = priceFor(countryCode, plan, "STRIPE");
  const currency = input.currency || catalog.currency;
  if (!SUPPORTED_CURRENCIES.has(currency))
    throw new SirahError("Choose a currency from the Sīrah price list.");
  let amountMinor: number;
  try {
    amountMinor = decimalToMinor(input.amount, currency);
  } catch {
    throw new SirahError("Enter the custom amount with the currency's precision.");
  }
  if (amountMinor <= 0 || amountMinor > STRIPE_MAX_MINOR)
    throw new SirahError("Enter a custom amount above zero and within card limits.");
  // Stripe rejects three-decimal amounts that are not a multiple of 10.
  if (["BHD", "KWD"].includes(currency) && amountMinor % 10)
    throw new SirahError("BHD/KWD card amounts must end in 0 (e.g. 91.800).");
  const terms = termsFor(plan, countryCode);
  if (!terms)
    throw new SirahError(
      `Approved annual payment terms are not configured for ${countryCode}.`,
      409,
    );
  const cohort = await publicSirahCohort();
  if (!cohortAllowsPayment(terms, cohort))
    throw new SirahError(
      "The first paid teaching date is pending owner confirmation. Payment remains closed.",
      409,
    );
  let phone = { phoneCountry: countryCode, phoneCountryCode: "", phoneNumber: "", phoneE164: "" };
  if (input.phone) {
    try {
      phone = normalizeSirahPhone(input.phone.country, input.phone.callingCode, input.phone.number);
    } catch (cause) {
      throw new SirahError(cause instanceof Error ? cause.message : "Enter a valid phone number.");
    }
  }

  // Everything is on the Sīrah merchant (SIRAH_STRIPE_SECRET_KEY + account check).
  const stripe = stripeOverride || stripeClient();
  await verifyStripeMerchant(stripe);

  const email = input.email.trim().toLowerCase();
  const course = await prisma.course.upsert({
    where: { slug: SIRAH_SLUG },
    create: { slug: SIRAH_SLUG, title: SIRAH_TITLE, basePrice: 2999, currency: "GBP", isActive: true },
    update: { title: SIRAH_TITLE },
  });
  const knownUser = await prisma.user.findUnique({ where: { email }, select: { id: true, status: true } });
  if (knownUser && knownUser.status !== "ACTIVE")
    throw new SirahError("This student account is not active.", 409);
  if (knownUser) {
    const prior = await prisma.sirahOrder.findUnique({
      where: { userId_courseId_batchCode: { userId: knownUser.id, courseId: course.id, batchCode: SIRAH_BATCH } },
    });
    if (prior?.paymentState === "PROCESSING") {
      // Regenerate: close the previous unsettled attempt first. This refuses
      // (and changes nothing) if the earlier checkout paid or may still settle.
      // A student's own open checkout is closed too, since staff are taking over.
      if (!["STRIPE", "PAYPAL"].includes(prior.method || ""))
        throw new SirahError("Reconcile this registration before issuing a link.", 409);
      await resetUnsettledSirahCheckout(prior.id, prior.userId, {
        expireOpenAdminLink: true,
        actor,
        stripe,
      });
    }
  }

  const password = knownUser ? null : temporaryPassword();
  const passwordHash = password ? await bcrypt.hash(password, 12) : null;
  const checkoutToken = randomUUID();
  const snapshot = buildAdminCustomSnapshot({
    amountMinor,
    currency,
    catalogAmountMinor: catalog.amountMinor,
    catalogCurrency: catalog.currency,
    sponsorLabel: input.sponsorLabel,
    note: input.note,
    createdBy: actor,
  });
  const orderData = {
    countryCode,
    countryName: countries[countryCode as keyof typeof countries].name,
    marketCode: catalog.market,
    plan,
    method: "STRIPE",
    currency,
    amountMinor,
    totalMinor: amountMinor,
    pricingVersion: ADMIN_CUSTOM_PRICING_VERSION,
    discount: jsonValue(snapshot),
    terms: jsonValue(snapshotSirahCohort(terms, cohort)),
    checkoutToken,
    paymentState: "PROCESSING",
    providerOrderId: null,
    providerSubscriptionId: null,
    providerPlanId: null,
  };

  const order = await prisma.$transaction(async (tx) => {
    let userId = knownUser?.id;
    if (!userId) {
      const user = await tx.user.create({
        data: {
          fullName: input.fullName,
          email,
          passwordHash: passwordHash!,
          phoneCountryCode: phone.phoneCountryCode,
          phoneNumber: phone.phoneNumber,
          studentProfile: {
            create: { countryCode, countryName: orderData.countryName },
          },
        },
      });
      userId = user.id;
    }
    const existing = await tx.sirahOrder.findUnique({
      where: { userId_courseId_batchCode: { userId, courseId: course.id, batchCode: SIRAH_BATCH } },
    });
    let saved;
    if (existing) {
      if (
        existing.paidCount ||
        existing.paidMinor ||
        existing.cancelledAt ||
        existing.enrolmentState !== "PENDING" ||
        !["UNPAID", "FAILED", "REJECTED"].includes(existing.paymentState)
      )
        throw new SirahError(
          existing.paymentState === "AWAITING_REVIEW"
            ? "This student has a payment receipt awaiting review. Approve or reject it first."
            : "This student already has a paid, active, cancelled or in-progress Sīrah registration for this batch.",
          409,
        );
      const changed = await tx.sirahOrder.updateMany({
        where: { id: existing.id, revision: existing.revision, paidCount: 0 },
        data: { ...orderData, revision: { increment: 1 } },
      });
      if (!changed.count)
        throw new SirahError("The registration changed. Try again.", 409);
      saved = await tx.sirahOrder.findUniqueOrThrow({ where: { id: existing.id } });
    } else {
      saved = await tx.sirahOrder.create({
        data: {
          ...orderData,
          userId,
          courseId: course.id,
          batchCode: SIRAH_BATCH,
          reference: `SIRAH-${randomUUID().toUpperCase()}`,
          requestKey: `admin-custom:${randomUUID()}`,
          phoneCountry: phone.phoneCountry,
          phoneE164: phone.phoneE164,
          revision: 1,
        },
      });
    }
    await auditSirah(tx, saved.id, actor, "ADMIN_CUSTOM_LINK_CREATED", {
      createdBy: actor,
      plan,
      currency,
      amountMinor,
      catalogAmountMinor: catalog.amountMinor,
      catalogCurrency: catalog.currency,
      sponsorLabel: snapshot.sponsorLabel,
      note: snapshot.note,
      newAccount: !knownUser,
      reusedRegistration: !!existing,
      checkoutToken,
    });
    return saved;
  });

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create(
      buildAdminCustomCheckoutParams(
        { id: order.id, checkoutToken, currency, amountMinor, reference: order.reference },
        { appUrl: appUrl(), email },
      ) as Stripe.Checkout.SessionCreateParams,
      { idempotencyKey: `sirah-admin:${checkoutToken}` },
    );
  } catch (cause) {
    // No session exists: release the order so the admin can retry. The amount
    // and custom snapshot stay; only the PROCESSING claim is withdrawn.
    await prisma.$transaction(async (tx) => {
      await tx.sirahOrder.updateMany({
        where: { id: order.id, checkoutToken, providerOrderId: null },
        data: { paymentState: "UNPAID", checkoutToken: null, revision: { increment: 1 } },
      });
      await auditSirah(tx, order.id, actor, "ADMIN_CUSTOM_LINK_FAILED", {
        error: cause instanceof Error ? cause.message.slice(0, 300) : "Stripe error",
      });
    });
    throw new SirahError(
      `Stripe could not create the payment link${cause instanceof Error ? `: ${cause.message}` : "."}`,
      502,
    );
  }
  const expiresAt = new Date(session.expires_at * 1000);
  await prisma.$transaction(async (tx) => {
    const saved = await tx.sirahOrder.updateMany({
      where: { id: order.id, checkoutToken },
      data: { providerOrderId: session.id },
    });
    if (!saved.count)
      throw new SirahError("The registration changed while the link was created.", 409);
    await auditSirah(tx, order.id, actor, "ADMIN_CUSTOM_LINK_ISSUED", {
      createdBy: actor,
      sessionId: session.id,
      expiresAt: expiresAt.toISOString(),
      amountMinor,
      currency,
    });
  });

  let accountEmail: "SENT" | "SKIPPED" | "FAILED" | "NOT_NEEDED" = "NOT_NEEDED";
  if (password) {
    const name = input.fullName;
    const login = `${appUrl()}/login`;
    accountEmail = await sendTransactionalEmail({
      userId: order.userId,
      to: email,
      subject: `Your ${SIRAH_TITLE} student account`,
      emailType: "SIRAH_ADMIN_ACCOUNT_CREATED",
      html: `
        <p>Assalam-u-Alaikum ${escapeHtml(name)},</p>
        <p>The TGA team has created your student account for ${SIRAH_TITLE}.</p>
        <p>Email: <strong>${escapeHtml(email)}</strong><br/>Temporary password: <strong>${password}</strong></p>
        <p>Your course access activates automatically once the agreed payment is received. Please sign in at <a href="${login}">${login}</a> and change your password.</p>
      `,
      text: [
        `Assalam-u-Alaikum ${name},`,
        `The TGA team has created your student account for ${SIRAH_TITLE}.`,
        `Email: ${email}`,
        `Temporary password: ${password}`,
        `Your course access activates automatically once the agreed payment is received. Sign in at ${login} and change your password.`,
      ].join("\n"),
    })
      .then((result) => (result.status === "SENT" ? "SENT" : "SKIPPED") as "SENT" | "SKIPPED")
      .catch(() => "FAILED" as const);
  }

  return {
    orderId: order.id,
    reference: order.reference,
    url: session.url,
    expiresAt: expiresAt.toISOString(),
    amount: formatSirahMoney(amountMinor, currency),
    catalogAmount: formatSirahMoney(catalog.amountMinor, catalog.currency),
    newAccount: !knownUser,
    accountEmail,
  };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
