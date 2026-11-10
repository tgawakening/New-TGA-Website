import { parseArgs } from "node:util";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { grantSirahScholarshipApproval } from "../services/sirah-team.service";
const { values } = parseArgs({ options: { email: { type: "string" }, apply: { type: "boolean", default: false } } });
async function main() {
  const email = z.email().parse(values.email).toLowerCase();
  if (!values.apply) { console.log(JSON.stringify({ email, targetRole: "SIRAH_REVIEWER", dryRun: true })); return; }
  console.log(JSON.stringify(await grantSirahScholarshipApproval(email)));
}
main().catch(() => { console.error("Grant failed: check the account, migration and authorised email."); process.exitCode = 1; }).finally(() => prisma.$disconnect());
