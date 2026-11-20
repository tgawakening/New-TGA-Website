import "server-only";
import { zoomApiEnv } from "./env";

/**
 * Server-to-Server OAuth access token for the Zoom REST API.
 *
 * The token is cached at module level and reused until five minutes before it
 * expires. Concurrent callers share one in-flight token request. The token and
 * client secret are never logged or included in errors.
 */

export const ZOOM_OAUTH_URL = "https://zoom.us/oauth/token";
export const ZOOM_API_BASE = "https://api.zoom.us/v2";
export const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;
export const MAX_RATE_LIMIT_RETRIES = 3;
export const MAX_RATE_LIMIT_WAIT_MS = 30_000;

type CachedToken = { accessToken: string; expiresAt: number; scopes: string[] };

let cached: CachedToken | null = null;
let inflight: Promise<CachedToken> | null = null;

/** Clock and sleep, swappable in tests. */
export const zoomRuntime = {
  now: () => Date.now(),
  sleep: (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
};

export class ZoomAuthError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "ZoomAuthError";
  }
}

async function requestToken(): Promise<CachedToken> {
  const env = zoomApiEnv();
  const url = new URL(ZOOM_OAUTH_URL);
  url.searchParams.set("grant_type", "account_credentials");
  url.searchParams.set("account_id", env.ZOOM_ACCOUNT_ID);
  const basic = Buffer.from(`${env.ZOOM_CLIENT_ID}:${env.ZOOM_CLIENT_SECRET}`).toString("base64");
  const requestedAt = zoomRuntime.now();
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}` },
    cache: "no-store",
  });
  if (!response.ok) {
    let reason = "";
    try {
      const body = (await response.json()) as { reason?: unknown; error?: unknown };
      reason = typeof body.reason === "string" ? body.reason : typeof body.error === "string" ? body.error : "";
    } catch {
      // Non-JSON error body: report the status alone.
    }
    throw new ZoomAuthError(
      `Zoom token request failed (HTTP ${response.status})${reason ? `: ${reason}` : ""}. Check the Server-to-Server OAuth app credentials and that the app is activated.`,
      response.status,
    );
  }
  const body = (await response.json()) as { access_token?: unknown; expires_in?: unknown; scope?: unknown };
  if (typeof body.access_token !== "string" || typeof body.expires_in !== "number")
    throw new ZoomAuthError("Zoom token response did not include an access token.");
  return {
    accessToken: body.access_token,
    expiresAt: requestedAt + body.expires_in * 1000 - TOKEN_REFRESH_MARGIN_MS,
    scopes: typeof body.scope === "string" ? body.scope.split(/\s+/).filter(Boolean) : [],
  };
}

async function currentToken(forceRefresh: boolean): Promise<CachedToken> {
  if (!forceRefresh && cached && zoomRuntime.now() < cached.expiresAt) return cached;
  if (!inflight) {
    inflight = requestToken()
      .then((token) => (cached = token))
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** A valid access token, from cache when it has more than five minutes left. */
export async function getZoomAccessToken(options: { forceRefresh?: boolean } = {}): Promise<string> {
  return (await currentToken(!!options.forceRefresh)).accessToken;
}

/** Scopes granted to the current token (empty until a token has been fetched). */
export function cachedZoomScopes(): string[] {
  return cached?.scopes ?? [];
}

/** Drop the cached token, e.g. after credentials rotate. Also used by tests. */
export function clearZoomTokenCache() {
  cached = null;
  inflight = null;
}

function retryAfterMs(response: Response, attempt: number): number {
  const header = response.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const date = Date.parse(header);
    if (!Number.isNaN(date)) return Math.max(0, date - zoomRuntime.now());
  }
  return 1000 * 2 ** attempt; // 1s, 2s, 4s
}

/** Zoom error code for "access token does not contain scopes". */
const MISSING_SCOPE_CODE = 4711;

async function isScopeError(response: Response): Promise<boolean> {
  try {
    const body = (await response.clone().json()) as { code?: unknown };
    return body.code === MISSING_SCOPE_CODE;
  } catch {
    return false;
  }
}

/**
 * fetch() against the Zoom REST API with the cached bearer token.
 * - On 401 it refreshes the token once and retries once (a missing-scope 401
 *   is returned as is, since a new token would not fix it).
 * - On 429 it waits (Retry-After, else exponential backoff) and retries up to
 *   MAX_RATE_LIMIT_RETRIES times. A wait longer than MAX_RATE_LIMIT_WAIT_MS
 *   (e.g. a daily limit) is not slept on: the 429 is returned to the caller.
 */
export async function zoomFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const url = path.startsWith("https://") ? path : `${ZOOM_API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
  const send = async (forceRefresh: boolean) => {
    const token = await getZoomAccessToken({ forceRefresh });
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    if (init.body !== undefined && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    return fetch(url, { ...init, headers, cache: "no-store" });
  };

  let refreshed = false;
  let rateLimitRetries = 0;
  let response = await send(false);
  for (;;) {
    if (response.status === 401 && !refreshed && !(await isScopeError(response))) {
      refreshed = true;
      response = await send(true);
      continue;
    }
    if (response.status === 429 && rateLimitRetries < MAX_RATE_LIMIT_RETRIES) {
      const wait = retryAfterMs(response, rateLimitRetries);
      if (wait > MAX_RATE_LIMIT_WAIT_MS) return response;
      rateLimitRetries += 1;
      await zoomRuntime.sleep(wait);
      response = await send(false);
      continue;
    }
    return response;
  }
}
