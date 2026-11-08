import { prisma } from "@/lib/prisma";

export class EmailDeliveryError extends Error {
  constructor(message: string, readonly retryAfterMs: number, readonly pauseBatch = false) { super(message); }
}

type EmailPayload = {
  idempotencyKey?: string;
  userId?: string;
  to: string;
  subject: string;
  emailType: string;
  html: string;
  text: string;
};

function getOptionalEnv(name: string) {
  const rawValue = process.env[name]?.trim();
  const value =
    rawValue && (
      (rawValue.startsWith("\"") && rawValue.endsWith("\"")) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"))
    )
      ? rawValue.slice(1, -1).trim()
      : rawValue;

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
  // Operational checks must inspect existing deliveries instead of spending student quota.
  if (payload.emailType.startsWith("SIRAH_OPS_") && process.env.ALLOW_OPERATIONAL_TEST_EMAILS !== "true") {
    await logEmail({ ...payload, status: "SKIPPED", error: "Operational test emails disabled to preserve transactional quota." });
    return { status: "SKIPPED" as const };
  }
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

  let response: Response;

  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
        ...(payload.idempotencyKey ? { "Idempotency-Key": payload.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: emailFrom,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown email send error.";
    await logEmail({
      userId: payload.userId,
      to: payload.to,
      subject: payload.subject,
      emailType: payload.emailType,
      status: "FAILED",
      payload,
      error: message,
    });
    throw new Error(`Email send failed: ${message}`);
  }

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
    const retryHeader = response.headers.get("retry-after");
    const retrySeconds = retryHeader ? Number(retryHeader) : NaN;
    const retryDate = retryHeader ? Date.parse(retryHeader) - Date.now() : NaN;
    const providerDelay = Number.isFinite(retrySeconds) ? retrySeconds * 1000 : Number.isFinite(retryDate) ? retryDate : 0;
    const cooldown = /daily_quota|monthly_quota/i.test(errorText) ? 3600000 : response.status === 429 ? 60000 : 300000;
    throw new EmailDeliveryError("Email delivery deferred by provider.", Math.max(providerDelay, cooldown), response.status === 429);
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

  const emails = [...new Set(configured.split(",").map(email => email.trim().toLowerCase()).filter(Boolean))];

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
