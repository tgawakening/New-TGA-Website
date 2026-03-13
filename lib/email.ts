import { prisma } from "@/lib/prisma";

type EmailPayload = {
  userId?: string;
  to: string;
  subject: string;
  emailType: string;
  html: string;
  text: string;
};

function getOptionalEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

async function logEmail({
  userId,
  to,
  subject,
  emailType,
  status,
  providerId,
  error,
  payload,
}: {
  userId?: string;
  to: string;
  subject: string;
  emailType: string;
  status: string;
  providerId?: string;
  error?: string;
  payload?: unknown;
}) {
  await prisma.emailLog.create({
    data: {
      userId,
      toEmail: to,
      emailType,
      subject,
      status,
      providerId,
      error,
      payload: payload ? JSON.parse(JSON.stringify(payload)) : undefined,
      sentAt: status === "SENT" ? new Date() : undefined,
    },
  });
}

export async function sendTransactionalEmail(payload: EmailPayload) {
  const resendApiKey = getOptionalEnv("RESEND_API_KEY");
  const emailFrom = getOptionalEnv("EMAIL_FROM");

  if (!resendApiKey || !emailFrom) {
    await logEmail({
      userId: payload.userId,
      to: payload.to,
      subject: payload.subject,
      emailType: payload.emailType,
      status: "SKIPPED",
      payload,
      error: "RESEND_API_KEY or EMAIL_FROM missing.",
    });
    return { status: "SKIPPED" as const };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: emailFrom,
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    await logEmail({
      userId: payload.userId,
      to: payload.to,
      subject: payload.subject,
      emailType: payload.emailType,
      status: "FAILED",
      payload,
      error: errorText,
    });
    throw new Error(`Email send failed: ${errorText}`);
  }

  const json = (await response.json()) as { id?: string };
  await logEmail({
    userId: payload.userId,
    to: payload.to,
    subject: payload.subject,
    emailType: payload.emailType,
    status: "SENT",
    providerId: json.id,
    payload,
  });
  return { status: "SENT" as const, id: json.id ?? null };
}

export async function notifyAdmins({
  subject,
  emailType,
  html,
  text,
}: {
  subject: string;
  emailType: string;
  html: string;
  text: string;
}) {
  const configured = getOptionalEnv("ADMIN_NOTIFICATION_EMAIL");
  if (!configured) {
    return { status: "SKIPPED" as const };
  }

  const emails = configured
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);

  await Promise.all(
    emails.map((email) =>
      sendTransactionalEmail({
        to: email,
        subject,
        emailType,
        html,
        text,
      }),
    ),
  );

  return { status: "SENT" as const };
}
