/**
 * Register the default Zoom host (ZOOM_DEFAULT_HOST_USER_ID) as a ZoomHost.
 *
 *   npm run lms:zoom-host:register            # dry run: resolve in Zoom, write nothing
 *   npm run lms:zoom-host:register -- --apply # upsert the ZoomHost row
 *
 * The Zoom user is resolved through the users API (scope user:read:user:admin,
 * classic user:read:admin) so zoomUserId and the licensed flag come from Zoom.
 * --apply writes to whichever database DATABASE_URL points at: check that
 * first. Re-running is safe (keyed on the Zoom user ID). No secrets are printed.
 */
import { registerDefaultZoomHost, resolveDefaultZoomHost } from "../lib/lms/hosts";

async function main() {
  const apply = process.argv.includes("--apply");
  const resolved = await resolveDefaultZoomHost();
  console.log(`Zoom user ${resolved.zoomUserId} (${resolved.email}), licensed: ${resolved.licensed ? "yes" : "NO"}`);
  if (!resolved.licensed) console.warn("Warning: this Zoom user is not licensed; meetings will be limited to Basic-plan rules (40 min, no cloud recording).");
  if (!apply) {
    console.log("Dry run: nothing written. Re-run with --apply to upsert the ZoomHost row.");
    return;
  }
  const host = await registerDefaultZoomHost();
  console.log(`ZoomHost ${host.id} registered (active: ${host.active}).`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? `${error.name}: ${error.message}` : "Failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    const { prisma } = await import("../lib/prisma");
    await prisma.$disconnect();
  });
