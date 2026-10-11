/** Validate browser origins against the configured public URL, even behind an ingress proxy. */
export function isAllowedRequestOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return request.headers.get("sec-fetch-site") !== "cross-site";
  try {
    const submitted = new URL(origin);
    if (submitted.origin !== origin) return false;
    const allowed = new Set([new URL(request.url).origin]);
    const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (configured) {
      const publicUrl = new URL(configured);
      if (publicUrl.protocol === "https:" || publicUrl.hostname === "localhost") {
        allowed.add(publicUrl.origin);
        // Both TGA domain variants are operated by this website.
        if (["www.tga-awakening.com", "tga-awakening.com"].includes(publicUrl.hostname)) {
          allowed.add("https://www.tga-awakening.com");
          allowed.add("https://tga-awakening.com");
        }
      }
    }
    return allowed.has(origin);
  } catch {
    return false;
  }
}
