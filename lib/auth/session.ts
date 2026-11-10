import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE_NAME = "ga_session";
const SESSION_DAYS = 14;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function getExpiryDate(hours = SESSION_DAYS * 24): Date {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + hours);
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

export async function createSession(userId: string, hours?: number): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = getExpiryDate(hours);

  await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  return token;
}

export async function attachSessionCookie(response: NextResponse, userId: string, hours?: number) {
  const token = await createSession(userId, hours);
  response.cookies.set(SESSION_COOKIE_NAME, token, getCookieOptions(getExpiryDate(hours)));
}

/** Lightweight, database-backed identity for scoped staff access. */
export async function getSessionIdentity(request?: Request) {
  const token = request
    ? request.headers.get("cookie")?.split(";").map(part => part.trim()).find(part => part.startsWith(`${SESSION_COOKIE_NAME}=`))?.slice(SESSION_COOKIE_NAME.length + 1)
    : (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { expiresAt: true, user: { select: { id: true, fullName: true, email: true, role: true, status: true } } },
  });
  return session && session.expiresAt > new Date() && session.user.status === "ACTIVE" ? session.user : null;
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
