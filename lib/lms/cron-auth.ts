import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

/**
 * The CRON_SECRET bearer check for internal scheduled endpoints, the same
 * rule as POST /api/internal/lms/zoom/process-events: "Authorization: Bearer
 * <CRON_SECRET>", compared in constant time (both sides hashed to equal
 * lengths). The secret's value is never logged or returned.
 */
export type CronAuth = { ok: true } | { ok: false; status: 401 | 503; error: string };

export function checkCronAuth(request: Request, env: NodeJS.ProcessEnv = process.env): CronAuth {
  const secret = env.CRON_SECRET?.trim();
  if (!secret) return { ok: false, status: 503, error: "Not configured (CRON_SECRET)." };
  const header = request.headers.get("authorization")?.trim() ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return { ok: false, status: 401, error: "Unauthorized." };
  const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();
  return timingSafeEqual(digest(token), digest(secret)) ? { ok: true } : { ok: false, status: 401, error: "Unauthorized." };
}
