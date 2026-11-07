import "server-only";
import { createSirahResumeLink } from "@/lib/sirah/resume";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendTransactionalEmail } from "@/lib/email";
import { SIRAH_TITLE, formatSirahMoney } from "@/lib/sirah/catalog";
import { getGroupInvitation } from "@/lib/sirah/config";
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const subjects: Record<string, string> = {
  CHECKOUT_REVIEW: "Checkout needs provider reconciliation",
  REFUND_PENDING: "A verified refund is being reconciled",
  BILLING_REVIEW: "Refund recorded — billing cancellation needs follow-up",
  PAYMENT_RECONCILIATION: "Payment received — enrolment needs admin review",
  REGISTERED: "Complete your Sīrah registration",
  PAYMENT_RESUME: "Complete your Sīrah registration",
  SUBMITTED: "Payment submission received — awaiting approval",
  CONFIRMED: "Payment received and enrolment confirmed",
  REJECTED: "Payment evidence needs attention",
  FAILED: "Recurring payment requires attention",
  CANCELLED: "Course enrolment cancelled",
  REFUNDED: "Payment refund recorded",
  REFUND_REQUESTED: "Refund review requested",
  COMPLETED: "Course marked completed",
  INVITATION: "Your course group invitation",
  INVITATION_PENDING: "Course group invitation needs follow-up",
  RENEWED: "Monthly payment received",
  RENEWAL_DUE: "Monthly payment reminder",
};
export async function queueSirahNotice(
  tx: Prisma.TransactionClient,
  orderId: string,
  kind: string,
  version: string,
  note = "",
) {
  const order = await tx.sirahOrder.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      user: true,
      receipts: {
        select: { id: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  const paymentReminder = ["REGISTERED", "PAYMENT_RESUME", "FAILED"].includes(kind);
  if (paymentReminder && order.paymentState === "PAID") return;
  const paid =
    order.user.status === "ACTIVE" &&
    order.paymentState === "PAID" &&
    ["ACTIVE", "COMPLETED"].includes(order.enrolmentState);
  const group =
    paid && ["CONFIRMED", "INVITATION"].includes(kind)
      ? getGroupInvitation(order.countryCode)
      : null;
  const app = (
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  ).replace(/\/$/, "");
  const rows = [
    `Course: ${SIRAH_TITLE}`,
    `Registration reference: ${order.reference}`,
    `Name: ${order.user.fullName}`,
    `Email: ${order.user.email}`,
    `Phone: ${order.phoneE164}`,
    `Country: ${order.countryName}`,
    `Batch: ${order.batchCode}`,
    `Plan: ${order.plan}`,
    `Payment method: ${order.method || "Not selected"}`,
    `Expected: ${formatSirahMoney(order.amountMinor, order.currency)}`,
    `Paid to date: ${formatSirahMoney(order.paidMinor, order.currency)}`,
    `Refunded to date: ${formatSirahMoney(order.refundedMinor, order.currency)}`,
    `Payment status: ${order.paymentState}`,
    `Enrolment status: ${order.enrolmentState}`,
    `Timestamp: ${new Date().toISOString()}`,
    ...(note ? [`Note: ${note}`] : []),
  ];
  if (kind === "FAILED" && order.accessEndsAt)
    rows.push(`Renewal grace ends: ${order.accessEndsAt.toISOString()}. Update the existing subscription's payment details; access resumes only after verified payment.`);
  if (kind === "SUBMITTED")
    rows.push(
      "Your payment submission has been received. Enrolment confirmation follows admin approval.",
    );
  if (kind === "REGISTERED")
    rows.push(
      "Your registration has been recorded. Payment is outstanding; course access is not yet active.",
    );
  if (kind === "REJECTED")
    rows.push(
      `Please replace your evidence from ${app}/seerah/register?order=${order.id}`,
    );
  if (paid && ["CONFIRMED", "INVITATION"].includes(kind))
    rows.push(
      group
        ? `Course group invitation: ${group}`
        : "Your course group invitation will follow.",
    );
  const admins = (process.env.ADMIN_NOTIFICATION_EMAIL || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  const recipients =
    kind === "PAYMENT_RESUME"
      ? [order.user.email]
      : kind === "INVITATION_PENDING"
        ? admins.length
          ? admins
          : [""]
        : [order.user.email, ...(admins.length ? admins : [""])];
  for (const email of recipients) {
    const admin = email !== order.user.email;
    const key = createHash("sha256")
      .update(`${order.id}:${kind}:${version}:${email}`)
      .digest("hex");
    if (
      await tx.sirahNotification.findUnique({
        where: { key },
        select: { id: true },
      })
    )
      continue;
    const paymentUrl =
      paymentReminder && !admin
        ? await createSirahResumeLink(tx, order.id)
        : null;
    const text = [
      ...rows,
      admin
        ? `Secure admin record: ${app}/admin/sirah?order=${order.id}`
        : paymentUrl
          ? `Complete my payment: ${paymentUrl}\nThis secure link expires in 72 hours. Registration alone does not confirm enrolment.`
          : `Your registration: ${app}/seerah/register?order=${order.id}`,
      ...(admin && order.receipts[0]
        ? [
            `Protected receipt: ${app}/api/sirah/receipts/${order.receipts[0].id}`,
          ]
        : []),
    ].join("\n");
    const payload = {
      subject: paymentUrl
        ? kind === "FAILED" ? "Update your Sīrah payment" : "Complete your Sīrah registration"
        : `${SIRAH_TITLE} — ${subjects[kind] || kind}`,
      html: `<div style="background:#f5efdf;color:#141611;padding:24px;font-family:Arial,sans-serif"><h2>The Global Awakening</h2><h3>${escapeHtml(subjects[kind] || kind)}</h3>${text
        .split("\n")
        .map((line) => `<p>${escapeHtml(line)}</p>`)
        .join(
          "",
        )}${paymentUrl ? `<p><a href="${escapeHtml(paymentUrl)}" style="display:inline-block;padding:12px 20px;background:#d9ad4a;color:#141611;font-weight:bold">Complete my payment</a></p>` : ""}</div>`,
      text,
    };
    await tx.sirahNotification.upsert({
      where: { key },
      update: {},
      create: {
        key,
        orderId,
        toEmail: email,
        kind,
        payload,
        state: email ? "PENDING" : "SKIPPED",
        error: email ? null : "ADMIN_NOTIFICATION_EMAIL is missing.",
      },
    });
  }
}
async function resolveAdminRecipients(orderId?: string) {
  const recipients = (process.env.ADMIN_NOTIFICATION_EMAIL || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  if (!recipients.length) return;
  const missing = await prisma.sirahNotification.findMany({
    where: { ...(orderId ? { orderId } : {}), toEmail: "", state: "SKIPPED" },
    take: 100,
  });
  for (const item of missing)
    await prisma.$transaction(async (tx) => {
      for (const email of recipients) {
        const key = createHash("sha256")
          .update(`${item.key}:recipient:${email}`)
          .digest("hex");
        await tx.sirahNotification.upsert({
          where: { key },
          update: {},
          create: {
            key,
            orderId: item.orderId,
            toEmail: email,
            kind: item.kind,
            payload: item.payload as Prisma.InputJsonValue,
          },
        });
      }
      await tx.sirahNotification.update({
        where: { id: item.id },
        data: { state: "RECIPIENT_CONFIGURED", error: null },
      });
    });
}
export async function dispatchSirahNotifications(orderId?: string) {
  await resolveAdminRecipients(orderId);
  const candidates = await prisma.sirahNotification.findMany({
    where: {
      ...(orderId ? { orderId } : {}),
      state: {
        in: [
          "PENDING",
          "FAILED",
          "SKIPPED",
          "SENDING",
          "HELD_ACCESS",
          "GROUP_CONFIGURATION_CHANGED",
        ],
      },
      OR: [{ lockedUntil: null }, { lockedUntil: { lt: new Date() } }],
    },
    take: 50,
    orderBy: { createdAt: "asc" },
  });
  let sent = 0;
  for (const item of candidates) {
    if (!item.toEmail) continue;
    if (["REGISTERED", "PAYMENT_RESUME"].includes(item.kind)) {
      const order = await prisma.sirahOrder.findUnique({
        where: { id: item.orderId },
        select: { paymentState: true },
      });
      if (order?.paymentState === "PAID") {
        await prisma.sirahNotification.update({
          where: { id: item.id },
          data: { state: "SUPERSEDED", error: null },
        });
        continue;
      }
    }
    const storedPayload = item.payload as {
      subject: string;
      html: string;
      text: string;
    };
    if (
      storedPayload.text.includes(
        "Course group invitation: https://chat.whatsapp.com/",
      )
    ) {
      const current = await prisma.sirahOrder.findUniqueOrThrow({
        where: { id: item.orderId },
        select: {
          paymentState: true,
          enrolmentState: true,
          paidCount: true,
          programmeEnd: true,
          accessEndsAt: true,
          countryCode: true,
          user: { select: { email: true, status: true } },
        },
      });
      if (item.toEmail === current.user.email) {
        const eligible =
          current.user.status === "ACTIVE" &&
          current.paymentState === "PAID" &&
          current.paidCount > 0 &&
          ["ACTIVE", "COMPLETED"].includes(current.enrolmentState) &&
          (!current.programmeEnd || current.programmeEnd > new Date()) &&
          (!current.accessEndsAt || current.accessEndsAt > new Date());
        const assigned = getGroupInvitation(current.countryCode);
        if (!eligible) {
          await prisma.sirahNotification.update({
            where: { id: item.id },
            data: {
              state: "HELD_ACCESS",
              error:
                "Group invitation withheld because verified active access is no longer available.",
            },
          });
          continue;
        }
        if (
          !assigned ||
          !storedPayload.text.includes(`Course group invitation: ${assigned}`)
        ) {
          await prisma.$transaction(async (tx) => {
            await tx.sirahNotification.update({
              where: { id: item.id },
              data: {
                state: "GROUP_CONFIGURATION_CHANGED",
                error:
                  "Invitation mapping changed; a current invitation must be queued.",
              },
            });
            await tx.sirahOrder.update({
              where: { id: item.orderId },
              data: { invitationState: "PENDING" },
            });
          });
          continue;
        }
      }
    }
    if (
      ["SENDING", "FAILED"].includes(item.state) &&
      item.attempts > 0 &&
      Date.now() - item.createdAt.getTime() > 23 * 3600000
    ) {
      await prisma.sirahNotification.update({
        where: { id: item.id },
        data: {
          state: "DELIVERY_UNKNOWN",
          error:
            "Delivery lease expired beyond provider idempotency window; verify delivery before retrying.",
        },
      });
      continue;
    }
    if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
      await prisma.sirahNotification.update({
        where: { id: item.id },
        data: {
          state: "SKIPPED",
          error: "RESEND_API_KEY or EMAIL_FROM is missing.",
        },
      });
      continue;
    }
    const claimed = await prisma.sirahNotification.updateMany({
      where: {
        id: item.id,
        state: item.state,
        OR: [{ lockedUntil: null }, { lockedUntil: { lt: new Date() } }],
      },
      data: {
        state: "SENDING",
        attempts: { increment: 1 },
        lockedUntil: new Date(Date.now() + 120000),
      },
    });
    if (!claimed.count) continue;
    try {
      const payload = item.payload as {
        subject: string;
        html: string;
        text: string;
      };
      const result = await sendTransactionalEmail({
        to: item.toEmail,
        emailType: `SIRAH_${item.kind}`,
        idempotencyKey: `sirah-${item.key}`,
        ...payload,
      });
      await prisma.sirahNotification.update({
        where: { id: item.id },
        data: {
          state: result.status,
          providerId: "id" in result ? result.id : null,
          lockedUntil: null,
          error:
            result.status === "SKIPPED"
              ? "Email sender configuration is missing."
              : null,
        },
      });
      if (result.status === "SENT") {
        sent++;
        if (
          ["INVITATION", "CONFIRMED"].includes(item.kind) &&
          payload.text.includes(
            "Course group invitation: https://chat.whatsapp.com/",
          )
        ) {
          const owner = await prisma.sirahOrder.findUniqueOrThrow({
            where: { id: item.orderId },
            select: { user: { select: { email: true } } },
          });
          if (owner.user.email === item.toEmail)
            await prisma.sirahOrder.updateMany({
              where: { id: item.orderId, invitationState: "QUEUED" },
              data: { invitationState: "SENT" },
            });
        }
      }
    } catch {
      await prisma.sirahNotification.update({
        where: { id: item.id },
        data: {
          state: "FAILED",
          lockedUntil: null,
          error: "Delivery failed; retry from the authorised admin action.",
        },
      });
    }
  }
  return { sent };
}
export async function queuePendingInvitations() {
  const orders = await prisma.sirahOrder.findMany({
    where: {
      paymentState: "PAID",
      enrolmentState: { in: ["ACTIVE", "COMPLETED"] },
      invitationState: "PENDING",
      user: { status: "ACTIVE" },
    },
    take: 100,
  });
  for (const order of orders) {
    const url = getGroupInvitation(order.countryCode);
    if (!url) continue;
    const version = createHash("sha256").update(url).digest("hex");
    await prisma.$transaction(async (tx) => {
      await queueSirahNotice(tx, order.id, "INVITATION", version);
      await tx.sirahOrder.update({
        where: { id: order.id },
        data: { invitationState: "QUEUED" },
      });
    });
  }
}
