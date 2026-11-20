import "server-only";
import { NextResponse } from "next/server";

/**
 * Responses for the join/start routes. They are opened by navigation (a link
 * or button), so failures are a small HTML page rather than JSON. Nothing is
 * cached, and the Referer is never sent on to Zoom.
 */

export const LMS_ROUTE_HEADERS = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex",
} as const;

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

export function lmsNotice(status: number, title: string, message: string, link?: { href: string; label: string }) {
  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1rem;color:#1f2937;background:#fff}h1{font-size:1.25rem}a{color:#1d4ed8}</style></head>
<body><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p>${link ? `<p><a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a></p>` : ""}</body></html>`;
  return new NextResponse(body, { status, headers: { ...LMS_ROUTE_HEADERS, "Content-Type": "text/html; charset=utf-8" } });
}

/** 302 to Zoom. The URL travels only in the Location header, never in a body. */
export function lmsRedirect(url: string) {
  return new NextResponse(null, { status: 302, headers: { ...LMS_ROUTE_HEADERS, Location: url } });
}

export const utcLabel = (date: Date) => `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
