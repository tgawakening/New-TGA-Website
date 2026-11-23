import { appUrl } from "@/lib/email-layout";

/**
 * The public origin a browser used to reach us, for building same-origin
 * redirects. Behind the DigitalOcean proxy, request.url is the container's
 * internal address (http://localhost:8080), so it must never be the base of a
 * Location header.
 *
 * 1. x-forwarded-proto + x-forwarded-host, when both are present and well
 *    formed (the first value of each, if the proxy sends a list).
 * 2. Otherwise appUrl() (NEXT_PUBLIC_APP_URL, else http://localhost:3000).
 *
 * The raw request host and port are never used.
 */

const PROTOCOLS = new Set(["http", "https"]);
/** A hostname or IPv4 address with an optional port; no path, user info or spaces. */
const HOST = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*(?::\d{1,5})?$/i;

const firstValue = (value: string | null) => value?.split(",")[0]?.trim() || null;

export function externalOrigin(request: Request, env: NodeJS.ProcessEnv = process.env): string {
  const proto = firstValue(request.headers.get("x-forwarded-proto"))?.toLowerCase();
  const host = firstValue(request.headers.get("x-forwarded-host"));
  if (proto && host && PROTOCOLS.has(proto) && HOST.test(host)) return `${proto}://${host.toLowerCase()}`;
  return new URL(appUrl(env)).origin;
}

/** An absolute URL for a same-origin path, on the public origin. */
export function externalUrl(path: string, request: Request, env: NodeJS.ProcessEnv = process.env): URL {
  return new URL(path, externalOrigin(request, env));
}
