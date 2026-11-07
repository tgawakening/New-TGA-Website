import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
export const SIRAH_RESUME_COOKIE = "tga_sirah_payment_resume";
export const resumeHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function createSirahResumeLink(
  tx: Prisma.TransactionClient,
  orderId: string,
) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 72 * 3600000);
  await tx.sirahResumeLink.create({
    data: { orderId, tokenHash: resumeHash(token), expiresAt },
  });
  const base = (
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  ).replace(/\/$/, "");
  // Fragment avoids sending the bearer token in server access logs or Referer headers.
  return `${base}/seerah/register#payment=${token}`;
}
export async function resolveSirahResumeToken(token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  return prisma.sirahResumeLink.findFirst({
    where: {
      tokenHash: resumeHash(token),
      expiresAt: { gt: new Date() },
      order: { user: { status: "ACTIVE" } },
    },
    include: { order: { include: { user: true } } },
  });
}
export async function currentSirahResumeGrant() {
  const token = (await cookies()).get(SIRAH_RESUME_COOKIE)?.value;
  return token ? resolveSirahResumeToken(token) : null;
}
