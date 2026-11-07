/** Approved TGA aliases share the same registration API; unrelated hosts never do. */
export function sirahOriginAllowed(
  origin: string | null,
  requestUrl: string,
  configuredUrl?: string,
) {
  if (!origin) return true; // Server-to-server calls still require authentication.
  const allowed = new Set([new URL(requestUrl).origin]);
  if (configuredUrl) {
    try {
      const configured = new URL(configuredUrl.trim());
      allowed.add(configured.origin);
      if (
        configured.protocol === "https:" &&
        ["tga-awakening.com", "www.tga-awakening.com"].includes(
          configured.hostname,
        )
      ) {
        allowed.add("https://tga-awakening.com");
        allowed.add("https://www.tga-awakening.com");
      }
    } catch {
      /* Invalid deployment configuration does not authorize another host. */
    }
  }
  return allowed.has(origin);
}
