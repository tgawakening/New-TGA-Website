import { PaymentMethod, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyAdmins, sendTransactionalEmail } from "@/lib/email";

type PaypalOrder = {
  id: string;
  links?: Array<{ rel: string; href: string }>;
};

function normalizeEnvValue(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

function getRequiredEnv(name: string): string {
  const rawValue = process.env[name];
  const value = rawValue ? normalizeEnvValue(rawValue) : "";
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
}

function getPaypalApiBase() {
  return process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

function buildMissionSupportReference() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `SUPPORT-${y}${m}${d}-${random}`;
}

function amountToPence(amountGbp: number) {
  return Math.round(amountGbp * 100);
}

function formatGbp(amountPence: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
  }).format(amountPence / 100);
}

async function getPaypalAccessToken() {
  const clientId = getRequiredEnv("PAYPAL_CLIENT_ID");
  const clientSecret = getRequiredEnv("PAYPAL_CLIENT_SECRET");
  const base = getPaypalApiBase();

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const tokenResponse = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!tokenResponse.ok) {
    throw new Error("Failed to obtain PayPal access token.");
  }

  const tokenJson = (await tokenResponse.json()) as { access_token: string };
  return tokenJson.access_token;
}

export async function createMissionSupportDonation(input: {
  fullName: string;
  email: string;
  phoneCountryCode?: string;
  phoneNumber?: string;
  countryName?: string;
  amountGbp: number;
  paymentMethod: "STRIPE" | "PAYPAL" | "BANK_TRANSFER" | "JAZZCASH";
  donorMessage?: string;
  senderName?: string;
  senderNumber?: string;
  referenceKey?: string;
  notes?: string;
}) {
  const amount = amountToPence(input.amountGbp);
  const reference = buildMissionSupportReference();

  const donation = await prisma.missionSupportDonation.create({
    data: {
      fullName: input.fullName,
      email: input.email,
      phoneCountryCode: input.phoneCountryCode || null,
      phoneNumber: input.phoneNumber || null,
      countryName: input.countryName || null,
      amount,
      paymentMethod: input.paymentMethod,
      paymentReference: reference,
      donorMessage: input.donorMessage || null,
      status:
        input.paymentMethod === PaymentMethod.BANK_TRANSFER || input.paymentMethod === PaymentMethod.JAZZCASH
          ? PaymentStatus.UNDER_REVIEW
          : PaymentStatus.INITIATED,
      manualNotes: input.notes || null,
    },
  });

  if (input.paymentMethod === PaymentMethod.BANK_TRANSFER || input.paymentMethod === PaymentMethod.JAZZCASH) {
    if (!input.senderName || !input.referenceKey) {
      throw new Error("Manual support submissions require sender name and reference key.");
    }

    await prisma.missionSupportManualSubmission.create({
      data: {
        donationId: donation.id,
        method: input.paymentMethod,
        senderName: input.senderName,
        senderNumber: input.senderNumber || "",
        referenceKey: input.referenceKey,
        notes: input.notes || null,
      },
    });

    await notifyAdmins({
      subject: `Manual mission support submitted: ${input.fullName}`,
      emailType: "ADMIN_MISSION_SUPPORT_MANUAL_SUBMITTED",
      html: `
        <p>A manual Support Our Mission contribution has been submitted.</p>
        <p>Name: <strong>${input.fullName}</strong></p>
        <p>Email: ${input.email}</p>
        <p>Reference: ${reference}</p>
        <p>Amount: ${formatGbp(amount)}</p>
        <p>Method: ${input.paymentMethod}</p>
      `,
      text: [
        "A manual Support Our Mission contribution has been submitted.",
        `Name: ${input.fullName}`,
        `Email: ${input.email}`,
        `Reference: ${reference}`,
        `Amount: ${formatGbp(amount)}`,
        `Method: ${input.paymentMethod}`,
      ].join("\n"),
    });

    return { donationId: donation.id, paymentReference: reference, mode: "MANUAL" as const };
  }

  return { donationId: donation.id, paymentReference: reference, mode: "ONLINE" as const };
}

export async function createMissionSupportStripeCheckout({
  donationId,
  successUrl,
  cancelUrl,
}: {
  donationId: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const stripeSecretKey = getRequiredEnv("STRIPE_SECRET_KEY");
  const stripeModule = await import("stripe");
  const Stripe = stripeModule.default;
  const stripe = new Stripe(stripeSecretKey);

  const donation = await prisma.missionSupportDonation.findUnique({
    where: { id: donationId },
  });

  if (!donation) throw new Error("Mission support donation not found.");
  if (donation.paymentMethod !== PaymentMethod.STRIPE) throw new Error("This donation is not set for Stripe.");

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      donationId: donation.id,
      paymentKind: "MISSION_SUPPORT",
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "gbp",
          unit_amount: donation.amount,
          product_data: {
            name: "Support Our Mission",
            description: `Reference: ${donation.paymentReference}`,
          },
        },
      },
    ],
    customer_email: donation.email,
  });

  await prisma.missionSupportDonation.update({
    where: { id: donation.id },
    data: {
      status: PaymentStatus.PENDING,
      providerOrderId: session.id,
      rawPayloadJson: JSON.parse(JSON.stringify(session)),
    },
  });

  return {
    checkoutUrl: session.url,
    sessionId: session.id,
  };
}

export async function createMissionSupportPaypalOrder({
  donationId,
  returnUrl,
  cancelUrl,
}: {
  donationId: string;
  returnUrl: string;
  cancelUrl: string;
}) {
  const donation = await prisma.missionSupportDonation.findUnique({
    where: { id: donationId },
  });

  if (!donation) throw new Error("Mission support donation not found.");
  if (donation.paymentMethod !== PaymentMethod.PAYPAL) throw new Error("This donation is not set for PayPal.");

  const token = await getPaypalAccessToken();
  const base = getPaypalApiBase();
  const orderResponse = await fetch(`${base}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: donation.id,
          custom_id: donation.id,
          amount: {
            currency_code: "GBP",
            value: (donation.amount / 100).toFixed(2),
          },
          description: `Support Our Mission (${donation.paymentReference})`,
        },
      ],
      application_context: {
        return_url: returnUrl,
        cancel_url: cancelUrl,
      },
    }),
  });

  if (!orderResponse.ok) {
    throw new Error("Failed to create PayPal order.");
  }

  const order = (await orderResponse.json()) as PaypalOrder;
  await prisma.missionSupportDonation.update({
    where: { id: donation.id },
    data: {
      status: PaymentStatus.PENDING,
      providerOrderId: order.id,
      rawPayloadJson: JSON.parse(JSON.stringify(order)),
    },
  });

  return {
    orderId: order.id,
    approveUrl: order.links?.find((item) => item.rel === "approve")?.href ?? null,
  };
}

export async function markMissionSupportSuccessful({
  donationId,
  providerOrderId,
  providerPaymentId,
  payload,
  confirmedStatus = PaymentStatus.SUCCEEDED,
}: {
  donationId: string;
  providerOrderId?: string;
  providerPaymentId?: string;
  payload?: unknown;
  confirmedStatus?: PaymentStatus;
}) {
  const donation = await prisma.missionSupportDonation.update({
    where: { id: donationId },
    data: {
      status: confirmedStatus,
      providerOrderId,
      providerPaymentId,
      paidAt: new Date(),
      rawPayloadJson: payload ? JSON.parse(JSON.stringify(payload)) : undefined,
    },
  });

  await Promise.allSettled([
    sendTransactionalEmail({
      to: donation.email,
      subject: "Your support is making an impact",
      emailType: "MISSION_SUPPORT_CONFIRMED",
      html: `
        <p>Assalam-u-Alaikum ${donation.fullName},</p>
        <p>Thank you for supporting TGA through our Support Our Mission initiative.</p>
        <p>Amount received: <strong>${formatGbp(donation.amount)}</strong></p>
        <p>Reference: <strong>${donation.paymentReference ?? "N/A"}</strong></p>
        <p>Your support helps children access education, mentoring, and leadership development.</p>
      `,
      text: [
        `Assalam-u-Alaikum ${donation.fullName},`,
        "Thank you for supporting TGA through our Support Our Mission initiative.",
        `Amount received: ${formatGbp(donation.amount)}`,
        `Reference: ${donation.paymentReference ?? "N/A"}`,
        "Your support helps children access education, mentoring, and leadership development.",
      ].join("\n"),
    }),
    notifyAdmins({
      subject: `Mission support confirmed: ${donation.fullName}`,
      emailType: "ADMIN_MISSION_SUPPORT_CONFIRMED",
      html: `
        <p>A mission support contribution has been confirmed.</p>
        <p>Name: <strong>${donation.fullName}</strong></p>
        <p>Email: ${donation.email}</p>
        <p>Amount: ${formatGbp(donation.amount)}</p>
        <p>Reference: ${donation.paymentReference ?? "N/A"}</p>
      `,
      text: [
        "A mission support contribution has been confirmed.",
        `Name: ${donation.fullName}`,
        `Email: ${donation.email}`,
        `Amount: ${formatGbp(donation.amount)}`,
        `Reference: ${donation.paymentReference ?? "N/A"}`,
      ].join("\n"),
    }),
  ]);

  return donation;
}

export async function captureMissionSupportPaypalOrder({
  donationId,
  orderId,
}: {
  donationId: string;
  orderId: string;
}) {
  const donation = await prisma.missionSupportDonation.findUnique({
    where: { id: donationId },
  });

  if (!donation) throw new Error("Mission support donation not found.");
  if (donation.paymentMethod !== PaymentMethod.PAYPAL) throw new Error("This donation is not set for PayPal.");

  const token = await getPaypalAccessToken();
  const base = getPaypalApiBase();
  const captureResponse = await fetch(`${base}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!captureResponse.ok) {
    throw new Error("PayPal capture failed.");
  }

  const capture = await captureResponse.json();
  const providerPaymentId = capture?.purchase_units?.[0]?.payments?.captures?.[0]?.id ?? undefined;
  await markMissionSupportSuccessful({
    donationId,
    providerOrderId: orderId,
    providerPaymentId,
    payload: capture,
  });

  return { success: true };
}

export async function handleMissionSupportStripeSessionCompleted(session: {
  id: string;
  metadata?: Record<string, string> | null;
  payment_intent?: string | { id?: string | null } | null;
}) {
  const donationId = session.metadata?.donationId;
  if (!donationId) {
    throw new Error("Missing donationId in Stripe session metadata.");
  }

  await markMissionSupportSuccessful({
    donationId,
    providerOrderId: session.id,
    providerPaymentId:
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id ?? undefined,
    payload: session,
  });
}

export async function listMissionSupportDonationsForAdmin() {
  return prisma.missionSupportDonation.findMany({
    include: { manualSubmission: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function adminUpdateMissionSupportDonation({
  donationId,
  action,
  note,
}: {
  donationId: string;
  action: "CONFIRM" | "PENDING" | "CANCEL";
  note?: string;
}) {
  const donation = await prisma.missionSupportDonation.findUnique({
    where: { id: donationId },
    include: { manualSubmission: true },
  });

  if (!donation) throw new Error("Mission support donation not found.");

  if (action === "CONFIRM") {
    await prisma.$transaction(async (tx) => {
      await tx.missionSupportDonation.update({
        where: { id: donation.id },
        data: {
          status: PaymentStatus.CONFIRMED,
          paidAt: donation.paidAt ?? new Date(),
          manualNotes: note ?? donation.manualNotes,
        },
      });

      if (donation.manualSubmission) {
        await tx.missionSupportManualSubmission.update({
          where: { donationId: donation.id },
          data: {
            reviewedAt: new Date(),
            reviewNote: note ?? null,
          },
        });
      }
    });

    await markMissionSupportSuccessful({
      donationId: donation.id,
      providerOrderId: donation.providerOrderId ?? undefined,
      providerPaymentId: donation.providerPaymentId ?? undefined,
      payload: { source: "admin-confirmation", note: note ?? null },
      confirmedStatus: PaymentStatus.CONFIRMED,
    });

    return { status: "CONFIRMED" as const };
  }

  if (action === "PENDING") {
    await prisma.missionSupportDonation.update({
      where: { id: donation.id },
      data: {
        status:
          donation.paymentMethod === PaymentMethod.BANK_TRANSFER || donation.paymentMethod === PaymentMethod.JAZZCASH
            ? PaymentStatus.UNDER_REVIEW
            : PaymentStatus.PENDING,
        manualNotes: note ?? donation.manualNotes,
      },
    });

    return { status: "PENDING" as const };
  }

  await prisma.$transaction(async (tx) => {
    await tx.missionSupportDonation.update({
      where: { id: donation.id },
      data: {
        status: PaymentStatus.FAILED,
        manualNotes: note ?? donation.manualNotes,
      },
    });

    if (donation.manualSubmission) {
      await tx.missionSupportManualSubmission.update({
        where: { donationId: donation.id },
        data: {
          reviewedAt: new Date(),
          reviewNote: note ?? null,
        },
      });
    }
  });

  return { status: "CANCELLED" as const };
}
