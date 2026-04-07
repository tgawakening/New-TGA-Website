import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { ensureRegistrationPaymentPlanColumn, prisma } from "@/lib/prisma";

const SESSION_COOKIE_NAME = "ga_session";
const SESSION_DAYS = 14;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function getExpiryDate(): Date {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS);
  return expiresAt;
}

function getCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    expires,
    path: "/",
  };
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = getExpiryDate();

  await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  return token;
}

export async function attachSessionCookie(response: NextResponse, userId: string) {
  const token = await createSession(userId);
  response.cookies.set(SESSION_COOKIE_NAME, token, getCookieOptions(getExpiryDate()));
}

export async function clearSessionCookie(response: NextResponse) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    await prisma.session.deleteMany({
      where: { tokenHash: hashToken(token) },
    });
  }
  response.cookies.set(SESSION_COOKIE_NAME, "", { path: "/", maxAge: 0 });
}

export async function getCurrentUser() {
  await ensureRegistrationPaymentPlanColumn();
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const tokenHash = hashToken(token);
  const now = new Date();
  const session = await prisma.session.findFirst({
    where: {
      tokenHash,
      expiresAt: { gt: now },
    },
    include: {
      user: {
        include: {
          enrollments: {
            include: {
              course: true,
            },
          },
          registrations: {
            include: {
              payment: true,
              course: true,
            },
            orderBy: {
              createdAt: "desc",
            },
          },
          subscriptions: {
            orderBy: {
              createdAt: "desc",
            },
          },
          studentProfile: true,
        },
      },
    },
  });

  if (!session) return null;
  return session.user;
}


