import { writeFileSync, openSync, closeSync } from "node:fs";
import { parseArgs } from "node:util";
import { resolve, relative, isAbsolute } from "node:path";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { provisionSirahViewer } from "../services/sirah-team.service";

const { values } = parseArgs({ options: { email: { type: "string" }, name: { type: "string" }, apply: { type: "boolean", default: false }, "credentials-file": { type: "string" } } });
async function main() {
  const email = z.email().parse(values.email).toLowerCase();
  const name = z.string().trim().min(2).max(190).parse(values.name);
  if (!values.apply) { console.log(JSON.stringify({ email, name, role: "SIRAH_VIEWER", dryRun: true })); return; }
  if (!values["credentials-file"]) throw Error("Provide a private credentials-file outside the repository.");
  const destination = resolve(values["credentials-file"]);
  const within = relative(process.cwd(), destination);
  if (!within.startsWith("..") && !isAbsolute(within)) throw Error("Credentials must stay outside the repository.");
  const fd = openSync(destination, "wx", 0o600);
  try {
    const login = await provisionSirahViewer(email, name);
    writeFileSync(fd, `Sīrah team login\nURL: https://www.tga-awakening.com/admin\nEmail: ${login.email}\nPassword: ${login.password}\n\nAccess: Sīrah enrolments and Batch 4 scholarships only. ${login.role === "SIRAH_REVIEWER" ? "Scholarship approval is permitted; payment verification and other admin changes remain restricted." : "Read-only access."} This login does not create an email mailbox. Keep these credentials private.\n`);
    console.log(JSON.stringify({ provisioned: true, email, role: login.role, credentialsWrittenToPrivateFile: true, notificationSent: false }));
  } finally { closeSync(fd); }
}
main().catch(() => { console.error("Provisioning failed. Check the email, schema migration and private file path; no credentials were printed."); process.exitCode = 1; }).finally(() => prisma.$disconnect());
