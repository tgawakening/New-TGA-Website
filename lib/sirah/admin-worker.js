/* Sīrah Admin: online-only records. No Cache Storage, offline queue or background sync. */
/* global self */
self.addEventListener("install", (event) => { event.waitUntil(self.skipWaiting()); });
self.addEventListener("activate", (event) => { event.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || event.request.mode !== "navigate" || url.origin !== self.location.origin || !url.pathname.startsWith("/admin/")) return;
  event.respondWith(fetch(event.request, { cache: "no-store" }).catch(() => new Response(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="theme-color" content="#1d5b8f"><title>Connect to Sīrah Admin</title>
<style>body{margin:0;padding:24px;font-family:system-ui,sans-serif;background:#f3f7fc;color:#153654;min-height:90vh;display:grid;place-items:center}main{max-width:420px;padding:28px;border-radius:20px;background:white;box-shadow:0 12px 40px #12345615}h1{font-size:1.7rem}p{line-height:1.6}a{display:inline-block;padding:14px 22px;border-radius:12px;background:#1d5b8f;color:white;text-decoration:none;font-weight:600}</style></head>
<body><main><p>TGA · Sīrah Admin</p><h1>Connection needed</h1><p>Connect to the internet to view current records or make changes. Your work will not be submitted while you are offline.</p><a href="/admin/sirah">Try again</a></main></body></html>`, {
    status: 503,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'" },
  })));
});
