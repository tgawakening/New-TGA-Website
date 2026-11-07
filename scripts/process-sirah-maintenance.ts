/** Sīrah-only scheduled maintenance; older-batch processing is unchanged. */
import { prisma } from "../lib/prisma";
import { maintainSirahOrders } from "../services/sirah-maintenance.service";
async function main() {
  const result = await maintainSirahOrders();
  const failures = "failures" in result ? result.failures.length : 0;
  console.log(JSON.stringify({ ...result, failures }));
  if (failures || ("available" in result && !result.available)) process.exitCode = 1;
}
main().catch(() => { console.error("Sīrah maintenance needs review; no credentials or student details printed."); process.exitCode = 1; }).finally(() => prisma.$disconnect());
