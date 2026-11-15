import "server-only";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendTransactionalEmail } from "@/lib/email";
import { appUrl, firstName, renderEmail } from "@/lib/email-layout";

/** Student password reset. A token is 32 random bytes, emailed once, stored
 * only as its SHA-256, valid for an hour and good for one use. Requesting
 * never reveals whether an account exists: the page shows one neutral
 * confirmation and runs the request after the response. */

export const RESET_TOKEN_MINUTES = 60;
/** Emails per account per hour, so the form cannot flood someone's inbox. */
export const RESET_REQUESTS_PER_HOUR = 3;

export const hashResetToken = (token: string) => createHash("sha256").update(token).digest("hex");
/** 32 bytes in base64url: exactly 43 characters of [A-Za-z0-9_-]. */
export const isResetTokenShape = (token: unknown): token is string =>
  typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);

export function passwordResetEmail(input: { fullName: string; link: string }) {
  return renderEmail("Reset your password", {
    masthead: "The Global Awakening",
    heading: "Reset your password",
    paragraphs: [
      `Assalamu alaykum ${firstName(input.fullName)}, we received a request to reset the password for your account.`,
      `The link works once and expires in ${RESET_TOKEN_MINUTES} minutes.`,
    ],
    action: { label: "Choose a new password", href: input.link },
    footnote: "If you did not ask for this, you can ignore this email. Your password stays as it is.",
  });
}

export async function requestPasswordReset(rawEmail: string, options: { now?: Date; app?: string } = {}) {
  const now = options.now ?? new Date();
  const email = rawEmail.trim().toLowerCase();
  if (!email) return { sent: false as const };
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.status !== "ACTIVE") return { sent: false as const };
  const recent = await prisma.passwordResetToken.count({
    where: { userId: user.id, createdAt: { gte: new Date(now.getTime() - 3_600_000) } },
  });
  if (recent >= RESET_REQUESTS_PER_HOUR) return { sent: false as const };

  const token = randomBytes(32).toString("base64url");
  await prisma.$transaction(async (tx) => {
    // Only the newest link works: retire any earlier unused one.
    await tx.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: now } });
    await tx.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashResetToken(token),
        expiresAt: new Date(now.getTime() + RESET_TOKEN_MINUTES * 60_000),
        usedAt: null,
        createdAt: now,
      },
    });
  });
  const message = passwordResetEmail({
    fullName: user.fullName,
    link: `${options.app ?? appUrl()}/reset-password/start?token=${token}`,
  });
  // sensitive: the email log keeps the subject and status, never the link.
  await sendTransactionalEmail({ to: user.email, userId: user.id, emailType: "PASSWORD_RESET", sensitive: true, ...message });
  return { sent: true as const };
}

/** The token's row if it can still be used, else null. */
export async function findUsableResetToken(token: unknown, now = new Date()) {
  if (!isResetTokenShape(token)) return null;
  const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashResetToken(token) } });
  return row && !row.usedAt && row.expiresAt > now ? row : null;
}

/** The registration rule: 8 to 72 characters (bcrypt reads 72 bytes). */
export const passwordProblem = (password: string, confirm: string) =>
  password.length < 8
    ? "Use at least 8 characters."
    : password.length > 72
      ? "Use 72 characters or fewer."
      : password !== confirm
        ? "The two passwords do not match."
        : null;

class ResetRefused extends Error {}

/** Set the new password and spend the token in one transaction. Claiming the
 * token is the first write, so two submissions cannot both succeed. Every
 * other open link and every signed-in session for the account end too. */
export async function resetPassword(token: unknown, password: string, now = new Date()) {
  const row = await findUsableResetToken(token, now);
  if (!row) return { ok: false as const, reason: "invalid" as const };
  const user = await prisma.user.findUnique({ where: { id: row.userId } });
  if (!user || user.status !== "ACTIVE") return { ok: false as const, reason: "invalid" as const };
  const passwordHash = await bcrypt.hash(password, 12);
  try {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.passwordResetToken.updateMany({
        where: { id: row.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (!claimed.count) throw new ResetRefused();
      await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
      await tx.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: now } });
      await tx.session.deleteMany({ where: { userId: user.id } });
    });
  } catch (error) {
    if (error instanceof ResetRefused) return { ok: false as const, reason: "invalid" as const };
    throw error;
  }
  return { ok: true as const };
}
