import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

const ADMIN_SESSION_COOKIE_NAME = "ga_admin_session";
const ADMIN_SESSION_HOURS = 12;

type AdminConfig = {
  email: string;
  password: string;
  secret: string;
};

type AdminSessionPayload = {
  email: string;
  exp: number;
};

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url<T>(value: string): T | null {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

function signPayload(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
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

function getExpiryDate() {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + ADMIN_SESSION_HOURS);
  return expiresAt;
}

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

export function getAdminConfig(): AdminConfig {
  const email = process.env.ADMIN_DASHBOARD_EMAIL ? normalizeEnvValue(process.env.ADMIN_DASHBOARD_EMAIL) : "";
  const password = process.env.ADMIN_DASHBOARD_PASSWORD ? normalizeEnvValue(process.env.ADMIN_DASHBOARD_PASSWORD) : "";
  const secretSource = process.env.ADMIN_DASHBOARD_SECRET ?? process.env.ADMIN_API_TOKEN;
  const secret = secretSource ? normalizeEnvValue(secretSource) : "";

  if (!email || !password || !secret) {
    throw new Error(
      "Admin dashboard credentials are not configured. Set ADMIN_DASHBOARD_EMAIL, ADMIN_DASHBOARD_PASSWORD, and ADMIN_DASHBOARD_SECRET.",
    );
  }

  return { email, password, secret };
}

function buildToken(email: string, secret: string) {
  const payload = encodeBase64Url(
    JSON.stringify({
      email,
      exp: getExpiryDate().getTime(),
    } satisfies AdminSessionPayload),
  );
  const signature = signPayload(payload, secret);
  return `${payload}.${signature}`;
}

function readPayloadFromToken(token: string, secret: string): AdminSessionPayload | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = signPayload(payload, secret);
  const signatureBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (signatureBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

  const decoded = decodeBase64Url<AdminSessionPayload>(payload);
  if (!decoded?.email || !decoded?.exp) return null;
  if (decoded.exp < Date.now()) return null;
  return decoded;
}

export async function attachAdminSessionCookie(response: NextResponse, email: string) {
  const { secret } = getAdminConfig();
  response.cookies.set(ADMIN_SESSION_COOKIE_NAME, buildToken(email, secret), getCookieOptions(getExpiryDate()));
}

export function clearAdminSessionCookie(response: NextResponse) {
  response.cookies.set(ADMIN_SESSION_COOKIE_NAME, "", { path: "/", maxAge: 0 });
}

export async function getCurrentAdmin() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;
    if (!token) return null;

    const { secret } = getAdminConfig();
    const payload = readPayloadFromToken(token, secret);
    if (!payload) return null;

    return { email: payload.email };
  } catch {
    return null;
  }
}

export function hasValidAdminSession(request: Request) {
  try {
    const header = request.headers.get("cookie");
    if (!header) return false;

    const cookieEntry = header
      .split(";")
      .map((item) => item.trim())
      .find((item) => item.startsWith(`${ADMIN_SESSION_COOKIE_NAME}=`));

    if (!cookieEntry) return false;

    const token = cookieEntry.slice(`${ADMIN_SESSION_COOKIE_NAME}=`.length);
    const { secret } = getAdminConfig();
    return Boolean(readPayloadFromToken(token, secret));
  } catch {
    return false;
  }
}

export async function authenticateAdminCredentials(email: string, password: string) {
  const config = getAdminConfig();
  return email.trim().toLowerCase() === config.email.trim().toLowerCase() && password === config.password;
}
