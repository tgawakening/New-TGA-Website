import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";
export async function GET() {
  const script = await readFile(join(process.cwd(), "lib/sirah/admin-worker.js"), "utf8");
  return new Response(script, { headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "no-store", "Service-Worker-Allowed": "/admin/" } });
}
