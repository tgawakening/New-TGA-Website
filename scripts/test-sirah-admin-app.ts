import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import sharp from "sharp";
import { GET as getManifest } from "../app/admin/manifest.webmanifest/route";
import { GET as getWorker } from "../app/admin/sw.js/route";

const source = readFileSync("lib/sirah/admin-worker.js", "utf8");
function worker(fetcher: typeof fetch) {
  const handlers = new Map<string, (event: Record<string, unknown>) => void>();
  const self = { location: { origin: "https://tga.example" }, addEventListener: (name: string, handler: (event: Record<string, unknown>) => void) => handlers.set(name, handler), skipWaiting: async () => {}, clients: { claim: async () => {} } };
  vm.runInNewContext(source, { self, URL, Response, fetch: fetcher, get caches() { throw Error("Private admin data must not enter Cache Storage."); } });
  return (url: string, mode = "navigate", method = "GET") => {
    let response: Promise<Response> | undefined;
    handlers.get("fetch")!({ request: { url, mode, method }, respondWith: (result: Promise<Response>) => { response = result; } });
    return response;
  };
}

test("manifest launches a standalone admin workspace with valid opaque app icons", async () => {
  const response = getManifest();
  assert.equal(response.headers.get("content-type"), "application/manifest+json");
  const manifest = await response.json();
  assert.equal(manifest.start_url, "/admin/sirah"); assert.equal(manifest.scope, "/admin/"); assert.equal(manifest.display, "standalone");
  for (const icon of manifest.icons) {
    const image = await sharp("public" + icon.src).metadata();
    assert.equal(`${image.width}x${image.height}`, icon.sizes); assert.equal(image.hasAlpha, false);
  }
  const apple = await sharp("public/admin-app/apple-touch-icon.png").metadata(); assert.equal(apple.width, 180); assert.equal(apple.height, 180);
});
test("worker is served as uncached JavaScript with only the admin scope", async () => {
  const response = await getWorker(); assert.match(response.headers.get("content-type") || "", /application\/javascript/); assert.equal(response.headers.get("cache-control"), "no-store"); assert.equal(response.headers.get("service-worker-allowed"), "/admin/"); assert.equal(await response.text(), source);
});
test("online admin navigation goes to the server with no HTTP caching and no Cache Storage", async () => {
  const original = new Response("private student records", { headers: { "Cache-Control": "private, no-store" } });
  let calls = 0;
  const request = worker(async (_request, options) => { calls++; assert.equal(options?.cache, "no-store"); return original; });
  assert.equal(await request("https://tga.example/admin/sirah"), original); assert.equal(calls, 1);
});
test("offline navigation returns generic reconnect guidance without reflecting query data", async () => {
  const request = worker(async () => { throw Error("Network unavailable"); });
  const response = await request("https://tga.example/admin/sirah?email=private-student%40example.test"); assert.ok(response);
  assert.equal(response.status, 503); assert.equal(response.headers.get("cache-control"), "no-store"); const body = await response.text(); assert.match(body, /Connection needed/); assert.doesNotMatch(body, /private-student|ga_session|password/); assert.match(response.headers.get("content-security-policy") || "", /default-src 'none'/);
});
test("worker never intercepts API requests, mutations, public pages or other origins", () => {
  const request = worker(async () => { throw Error("This fetch must not be intercepted."); });
  for (const [url, mode, method] of [
    ["https://tga.example/api/admin/sirah", "cors", "GET"],
    ["https://tga.example/api/admin/sirah/scholarships", "cors", "POST"],
    ["https://tga.example/admin/sirah", "navigate", "POST"],
    ["https://tga.example/seerah/register", "navigate", "GET"],
    ["https://elsewhere.example/admin/sirah", "navigate", "GET"],
  ]) assert.equal(request(url, mode, method), undefined);
});
