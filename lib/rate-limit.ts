import "server-only";

/**
 * In-memory fixed-window rate limiter.
 *
 * Why in-memory: this app runs as a single DigitalOcean App Platform container.
 * An in-process limiter needs no extra infrastructure, adds no per-request
 * database writes, and fails open — if the process restarts, counters simply
 * reset, so it can never wrongly lock a legitimate student out of registering.
 *
 * Multi-instance caveat: if the app is ever scaled horizontally, each instance
 * keeps its own counters, so effective limits loosen by the instance count
 * (the per-email/IP checks still apply within each instance). If precise global
 * limits become necessary, replace this module with a shared store (a
 * Prisma-backed counter table or Redis) using the same `RateLimitRule` keys —
 * callers do not change.
 */

export type RateLimitRule = {
  /** Unique bucket identity, e.g. `scope:email:alice@example.com:m`. */
  key: string;
  /** Max allowed hits per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
};

export type RateLimitResult = {
  ok: boolean;
  /** Seconds until the most-constrained tripped window resets (0 when allowed). */
  retryAfterSeconds: number;
};

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets)
    if (bucket.resetAt <= now) buckets.delete(key);
}

function hit(rule: RateLimitRule, now: number): RateLimitResult {
  const bucket = buckets.get(rule.key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(rule.key, { count: 1, resetAt: now + rule.windowMs });
    return { ok: true, retryAfterSeconds: 0 };
  }
  if (bucket.count >= rule.limit)
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  bucket.count += 1;
  return { ok: true, retryAfterSeconds: 0 };
}

/**
 * Test isolation only: clear every in-memory bucket so one test's requests
 * cannot spend another test's allowance. Not called by application code.
 */
export function resetRateLimitsForTests() {
  buckets.clear();
  lastSweep = 0;
}

/**
 * Evaluate every rule. The request is allowed only if all rules allow it.
 * All rules are still counted even once one trips, so a sustained abuser is
 * also caught by the longer windows. Returns the longest retry-after among the
 * tripped rules (0 when allowed).
 */
export function checkRateLimit(rules: RateLimitRule[]): RateLimitResult {
  const now = Date.now();
  sweep(now);
  let retryAfterSeconds = 0;
  for (const rule of rules) {
    const result = hit(rule, now);
    if (!result.ok)
      retryAfterSeconds = Math.max(retryAfterSeconds, result.retryAfterSeconds);
  }
  return { ok: retryAfterSeconds === 0, retryAfterSeconds };
}
