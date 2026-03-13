import {
  EnrollmentStatus,
  PaymentStatus,
  Prisma,
  RegistrationStatus,
  SubscriptionProvider,
  SubscriptionStatus,
  type Payment,
  type Registration,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyAdmins, sendTransactionalEmail } from "@/lib/email";

type RegistrationWithPayment = Registration & {
  payment: Payment;
};

type PaypalOrder = {
  id: string;
  links?: Array<{ rel: string; href: string }>;
};

function getRequiredEnv(name: string): string {
  const value = process.env[name];
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

async function loadRegistrationForUser(registrationId: string, userId: string): Promise<RegistrationWithPayment> {
  const registration = await prisma.registration.findFirst({
    where: { id: registrationId, userId },
    include: { payment: true },
  });
  if (!registration || !registration.payment) {
    throw new Error("Registration payment record not found.");
  }
  return registration as RegistrationWithPayment;
}

function toJsonValue(input: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(input)) as Prisma.InputJsonValue;
}

function getStripeMonthlyAmountPence(registration: Registration) {
  if (registration.selectedCurrency === "GBP") return registration.finalAmount;
  // South Asia discounted path is represented as approximately GBP 5/month recurring billing.
  return 500;
}

async function markSuccessfulPayment({
  paymentId,
  providerOrderId,
  providerPaymentId,
  payload,
}: {
  paymentId: string;
  providerOrderId?: string;
  providerPaymentId?: string;
  payload?: unknown;
}) {
  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      include: {
        registration: {
          include: {
            user: true,
            course: true,
          },
        },
      },
    });
    if (!payment) throw new Error("Payment not found.");
    if (payment.status === PaymentStatus.SUCCEEDED || payment.status === PaymentStatus.CONFIRMED) {
      return {
        userId: payment.registration.userId,
        fullName: payment.registration.user.fullName,
        email: payment.registration.user.email,
        courseTitle: payment.registration.course.title,
        paymentReference: payment.registration.paymentReference,
      };
    }

    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.SUCCEEDED,
        providerOrderId: providerOrderId ?? payment.providerOrderId,
        providerPaymentId: providerPaymentId ?? payment.providerPaymentId,
        paidAt: new Date(),
        rawPayloadJson: payload ? toJsonValue(payload) : undefined,
      },
    });

    await tx.registration.update({
      where: { id: payment.registrationId },
      data: { status: RegistrationStatus.PAID },
    });

    await tx.enrollment.update({
      where: { registrationId: payment.registrationId },
      data: {
        status: EnrollmentStatus.ACTIVE,
        activatedAt: new Date(),
      },
    });

    return {
      userId: payment.registration.userId,
      fullName: payment.registration.user.fullName,
      email: payment.registration.user.email,
      courseTitle: payment.registration.course.title,
      paymentReference: payment.registration.paymentReference,
    };
  });

  await Promise.allSettled([
    sendTransactionalEmail({
      userId: result.userId,
      to: result.email,
      subject: "Payment confirmed and dashboard access activated",
      emailType: "PAYMENT_CONFIRMED",
      html: `
        <p>Assalam-u-Alaikum ${result.fullName},</p>
        <p>Your payment for ${result.courseTitle} has been confirmed.</p>
        <p>Reference: <strong>${result.paymentReference ?? "N/A"}</strong></p>
        <p>You can now log in and access your student dashboard.</p>
      `,
      text: [
        `Assalam-u-Alaikum ${result.fullName},`,
        `Your payment for ${result.courseTitle} has been confirmed.`,
        `Reference: ${result.paymentReference ?? "N/A"}`,
        "You can now log in and access your student dashboard.",
      ].join("\n"),
    }),
    notifyAdmins({
      subject: `Payment confirmed: ${result.fullName}`,
      emailType: "ADMIN_PAYMENT_CONFIRMED",
      html: `
        <p>Payment confirmed for ${result.fullName}.</p>
        <p>Reference: <strong>${result.paymentReference ?? "N/A"}</strong></p>
      `,
      text: `Payment confirmed for ${result.fullName}.\nReference: ${result.paymentReference ?? "N/A"}`,
    }),
  ]);
}

export async function createStripeCheckout({
  registrationId,
  userId,
  successUrl,
  cancelUrl,
}: {
  registrationId: string;
  userId: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const stripeSecretKey = getRequiredEnv("STRIPE_SECRET_KEY");
  const stripeModule = await import("stripe");
  const Stripe = stripeModule.default;
  const stripe = new Stripe(stripeSecretKey);

  const registration = await loadRegistrationForUser(registrationId, userId);
  const payment = registration.payment;
  if (payment.provider !== "STRIPE") {
    throw new Error("This registration is not set for Stripe.");
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      registrationId: registration.id,
      paymentId: payment.id,
        userId,
      },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "gbp",
          unit_amount: getStripeMonthlyAmountPence(registration),
          recurring: {
            interval: "month",
          },
          product_data: {
            name: "Prophetic Seerah and Planning",
            description: `Reference: ${registration.paymentReference}`,
          },
        },
      },
    ],
  });

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: PaymentStatus.PENDING,
      providerOrderId: session.id,
      rawPayloadJson: toJsonValue(session),
    },
  });

  return {
    checkoutUrl: session.url,
    sessionId: session.id,
  };
}

export async function handleStripeWebhook({
  signature,
  payloadText,
}: {
  signature: string | null;
  payloadText: string;
}) {
  const stripeSecretKey = getRequiredEnv("STRIPE_SECRET_KEY");
  const stripeWebhookSecret = getRequiredEnv("STRIPE_WEBHOOK_SECRET");
  const stripeModule = await import("stripe");
  const Stripe = stripeModule.default;
  const stripe = new Stripe(stripeSecretKey);
  if (!signature) throw new Error("Missing Stripe signature.");

  const event = stripe.webhooks.constructEvent(payloadText, signature, stripeWebhookSecret);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const paymentId = session.metadata?.paymentId;
    if (!paymentId) throw new Error("Missing paymentId in Stripe session metadata.");
    await markSuccessfulPayment({
      paymentId,
      providerOrderId: session.id,
      providerPaymentId: typeof session.payment_intent === "string" ? session.payment_intent : undefined,
      payload: session,
    });

    const registrationId = session.metadata?.registrationId;
    const userId = session.metadata?.userId;
    if (
      session.subscription &&
      typeof session.subscription === "string" &&
      registrationId &&
      userId
    ) {
      await prisma.subscription.upsert({
        where: { registrationId },
        update: {
          provider: SubscriptionProvider.STRIPE,
          status: SubscriptionStatus.ACTIVE,
          providerSubscriptionId: session.subscription,
          providerCustomerId: typeof session.customer === "string" ? session.customer : undefined,
        },
        create: {
          userId,
          registrationId,
          provider: SubscriptionProvider.STRIPE,
          status: SubscriptionStatus.ACTIVE,
          providerSubscriptionId: session.subscription,
          providerCustomerId: typeof session.customer === "string" ? session.customer : undefined,
        },
      });
    }
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.created") {
    const subscription = event.data.object as unknown as {
      id?: string;
      status?: string;
      current_period_start?: number;
      current_period_end?: number;
      cancel_at_period_end?: boolean;
      canceled_at?: number | null;
    };
    if (typeof subscription.id === "string") {
      await prisma.subscription.updateMany({
        where: { providerSubscriptionId: subscription.id },
        data: {
          status:
            subscription.status === "active"
              ? SubscriptionStatus.ACTIVE
              : subscription.status === "past_due"
                ? SubscriptionStatus.PAST_DUE
                : subscription.status === "canceled"
                  ? SubscriptionStatus.CANCELED
                  : SubscriptionStatus.INCOMPLETE,
          currentPeriodStart:
            typeof subscription.current_period_start === "number"
              ? new Date(subscription.current_period_start * 1000)
              : null,
          currentPeriodEnd:
            typeof subscription.current_period_end === "number"
              ? new Date(subscription.current_period_end * 1000)
              : null,
          cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
          canceledAt:
            typeof subscription.canceled_at === "number"
              ? new Date(subscription.canceled_at * 1000)
              : null,
        },
      });
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as unknown as { id?: string };
    if (typeof subscription.id === "string") {
      await prisma.subscription.updateMany({
        where: { providerSubscriptionId: subscription.id },
        data: {
          status: SubscriptionStatus.CANCELED,
          cancelAtPeriodEnd: true,
          canceledAt: new Date(),
        },
      });
    }
  }

  return { received: true };
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

export async function createPaypalOrder({
  registrationId,
  userId,
  returnUrl,
  cancelUrl,
}: {
  registrationId: string;
  userId: string;
  returnUrl: string;
  cancelUrl: string;
}) {
  const registration = await loadRegistrationForUser(registrationId, userId);
  const payment = registration.payment;
  if (payment.provider !== "PAYPAL") {
    throw new Error("This registration is not set for PayPal.");
  }

  const token = await getPaypalAccessToken();
  const base = getPaypalApiBase();
  const amountGbp = (registration.finalAmount / 100).toFixed(2);

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
          reference_id: registration.id,
          custom_id: payment.id,
          amount: {
            currency_code: "GBP",
            value: amountGbp,
          },
          description: `Prophetic Seerah and Planning (${registration.paymentReference})`,
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
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: PaymentStatus.PENDING,
      providerOrderId: order.id,
      rawPayloadJson: toJsonValue(order),
    },
  });

  return {
    orderId: order.id,
    approveUrl: order.links?.find((item) => item.rel === "approve")?.href ?? null,
  };
}

export async function capturePaypalOrder({
  registrationId,
  userId,
  orderId,
}: {
  registrationId: string;
  userId: string;
  orderId: string;
}) {
  const registration = await loadRegistrationForUser(registrationId, userId);
  const payment = registration.payment;
  if (payment.provider !== "PAYPAL") {
    throw new Error("This registration is not set for PayPal.");
  }

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
  const paymentId =
    capture?.purchase_units?.[0]?.payments?.captures?.[0]?.id ?? undefined;

  await markSuccessfulPayment({
    paymentId: payment.id,
    providerOrderId: orderId,
    providerPaymentId: paymentId,
    payload: capture,
  });

  return { success: true };
}

export async function submitManualPayment({
  registrationId,
  userId,
  method,
  senderName,
  senderNumber,
  referenceKey,
  notes,
  screenshotUrl,
}: {
  registrationId: string;
  userId: string;
  method: "BANK_TRANSFER" | "NAYAPAY";
  senderName: string;
  senderNumber: string;
  referenceKey: string;
  notes?: string;
  screenshotUrl?: string;
}) {
  const registration = await loadRegistrationForUser(registrationId, userId);
  const payment = registration.payment;
  if (registration.selectedCountryCode !== "PK") {
    throw new Error("Manual payment is currently available for Pakistan only.");
  }
  if (!["BANK_TRANSFER", "NAYAPAY"].includes(payment.provider)) {
    throw new Error("This registration is not set for manual payment.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.manualPaymentSubmission.upsert({
      where: { paymentId: payment.id },
      update: {
        method,
        senderName,
        senderNumber,
        referenceKey,
        notes,
        screenshotUrl,
        submittedAt: new Date(),
      },
      create: {
        paymentId: payment.id,
        method,
        senderName,
        senderNumber,
        referenceKey,
        notes,
        screenshotUrl,
      },
    });

    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.UNDER_REVIEW,
        manualNotes: notes,
        rawPayloadJson: toJsonValue({
          senderName,
          senderNumber,
          referenceKey,
          screenshotUrl,
        }),
      },
    });

    await tx.registration.update({
      where: { id: registration.id },
      data: { status: RegistrationStatus.MANUAL_REVIEW },
    });
  });

  const registrationDetails = await prisma.registration.findUnique({
    where: { id: registration.id },
    include: {
      user: true,
      course: true,
    },
  });

  if (registrationDetails) {
    await Promise.allSettled([
      sendTransactionalEmail({
        userId: registrationDetails.userId,
        to: registrationDetails.user.email,
        subject: "Manual payment received and pending review",
        emailType: "MANUAL_PAYMENT_PENDING",
        html: `
          <p>Assalam-u-Alaikum ${registrationDetails.user.fullName},</p>
          <p>We have received your manual payment submission for ${registrationDetails.course.title}.</p>
          <p>Reference: <strong>${registrationDetails.paymentReference ?? "N/A"}</strong></p>
          <p>Your payment is now pending admin review. We will confirm it from the backend and notify you once approved.</p>
        `,
        text: [
          `Assalam-u-Alaikum ${registrationDetails.user.fullName},`,
          `We have received your manual payment submission for ${registrationDetails.course.title}.`,
          `Reference: ${registrationDetails.paymentReference ?? "N/A"}`,
          "Your payment is now pending admin review. We will confirm it from the backend and notify you once approved.",
        ].join("\n"),
      }),
      notifyAdmins({
        subject: `Manual payment submitted: ${registrationDetails.user.fullName}`,
        emailType: "ADMIN_MANUAL_PAYMENT_PENDING",
        html: `
          <p>Manual payment submitted for review.</p>
          <p>Name: <strong>${registrationDetails.user.fullName}</strong></p>
          <p>Email: ${registrationDetails.user.email}</p>
          <p>Reference: ${registrationDetails.paymentReference ?? "N/A"}</p>
          <p>Sender: ${senderName} (${senderNumber})</p>
          <p>Transfer Ref: ${referenceKey}</p>
        `,
        text: [
          "Manual payment submitted for review.",
          `Name: ${registrationDetails.user.fullName}`,
          `Email: ${registrationDetails.user.email}`,
          `Reference: ${registrationDetails.paymentReference ?? "N/A"}`,
          `Sender: ${senderName} (${senderNumber})`,
          `Transfer Ref: ${referenceKey}`,
        ].join("\n"),
      }),
    ]);
  }

  return { status: "UNDER_REVIEW" as const };
}

export async function listManualPaymentsForAdmin() {
  return prisma.payment.findMany({
    where: {
      status: PaymentStatus.UNDER_REVIEW,
    },
    include: {
      registration: {
        include: {
          user: true,
        },
      },
      manualSubmission: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
}

export async function adminConfirmManualPayment({
  paymentId,
  approve,
  note,
}: {
  paymentId: string;
  approve: boolean;
  note?: string;
}) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      registration: {
        include: {
          user: true,
        },
      },
      manualSubmission: true,
    },
  });

  if (!payment || !payment.manualSubmission) {
    throw new Error("Manual payment submission not found.");
  }

  if (approve) {
    await markSuccessfulPayment({
      paymentId: payment.id,
      payload: { adminNote: note ?? null, source: "manual-confirmation" },
    });
    await prisma.manualPaymentSubmission.update({
      where: { paymentId },
      data: {
        reviewedAt: new Date(),
        reviewNote: note,
      },
    });
    return { status: "CONFIRMED" as const };
  }

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.FAILED,
        manualNotes: note,
      },
    });
    await tx.registration.update({
      where: { id: payment.registrationId },
      data: { status: RegistrationStatus.REJECTED },
    });
    await tx.enrollment.update({
      where: { registrationId: payment.registrationId },
      data: { status: EnrollmentStatus.CANCELLED },
    });
    await tx.manualPaymentSubmission.update({
      where: { paymentId: payment.id },
      data: {
        reviewedAt: new Date(),
        reviewNote: note,
      },
    });
  });

  await Promise.allSettled([
    sendTransactionalEmail({
      userId: payment.registration.userId,
      to: payment.registration.user.email,
      subject: "Manual payment review update",
      emailType: "MANUAL_PAYMENT_REJECTED",
      html: `
        <p>Assalam-u-Alaikum ${payment.registration.user.fullName},</p>
        <p>Your manual payment could not be confirmed yet.</p>
        <p>Reference: <strong>${payment.registration.paymentReference ?? "N/A"}</strong></p>
        <p>Please contact support or submit a corrected payment proof.</p>
      `,
      text: [
        `Assalam-u-Alaikum ${payment.registration.user.fullName},`,
        "Your manual payment could not be confirmed yet.",
        `Reference: ${payment.registration.paymentReference ?? "N/A"}`,
        "Please contact support or submit a corrected payment proof.",
      ].join("\n"),
    }),
    notifyAdmins({
      subject: `Manual payment rejected: ${payment.registration.user.fullName}`,
      emailType: "ADMIN_MANUAL_PAYMENT_REJECTED",
      html: `
        <p>Manual payment rejected.</p>
        <p>Name: <strong>${payment.registration.user.fullName}</strong></p>
        <p>Email: ${payment.registration.user.email}</p>
        <p>Reference: ${payment.registration.paymentReference ?? "N/A"}</p>
      `,
      text: [
        "Manual payment rejected.",
        `Name: ${payment.registration.user.fullName}`,
        `Email: ${payment.registration.user.email}`,
        `Reference: ${payment.registration.paymentReference ?? "N/A"}`,
      ].join("\n"),
    }),
  ]);

  return { status: "REJECTED" as const };
}
