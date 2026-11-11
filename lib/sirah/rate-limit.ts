import "server-only";
import { NextResponse } from "next/server";
import { checkRateLimit, type RateLimitRule } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request-ip";

export const MINUTE = 60_000;
export const HOUR = 3_600_000;

const TOO_MANY =
  "You’ve made too many attempts in a short time. Please wait a minute and try again.";

/** Stable IP token for a request (falls back to a shared bucket if unknown). */
export function sirahClientIp(request: Request): string {
  return clientIp(request.headers) || "unknown";
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/**
 * Evaluate the rules. Returns a friendly 429 JSON response (with Retry-After)
 * if any rule tripped, otherwise null so the caller proceeds. `extra` is merged
 * into the body so callers can keep their response shape (e.g. `eligible`).
 */
export function sirahRateLimit(
  rules: RateLimitRule[],
  extra?: Record<string, unknown>,
): NextResponse | null {
  const result = checkRateLimit(rules);
  if (result.ok) return null;
  return NextResponse.json(
    { error: TOO_MANY, ...extra },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSeconds),
        "Cache-Control": "private, no-store",
      },
    },
  );
}
