/**
 * Read-only check of the transactional email setup. Run it where the
 * production env is loaded (npm run email:sender:check). It sends nothing:
 * it parses EMAIL_FROM, then asks Resend whether that domain is verified.
 * Never prints the API key.
 */
import { emailFrom, emailSender, resendApiKey } from "../lib/email-config";

async function main() {
  const key = resendApiKey();
  const raw = emailFrom();
  const sender = emailSender();
  const report: Record<string, unknown> = {
    RESEND_API_KEY: key ? "set" : "MISSING",
    EMAIL_FROM: raw ? (sender ? `set (${sender.address})` : `set but not a valid sender: ${raw}`) : "MISSING",
  };
  if (!key || !sender) {
    console.log(JSON.stringify({ ...report, verdict: "Not configured: set RESEND_API_KEY and EMAIL_FROM." }, null, 2));
    process.exitCode = 1;
    return;
  }
  const response = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${key}` } });
  if (response.status === 401 || response.status === 403) {
    report.domain = "unknown";
    report.verdict =
      "The key cannot list domains (a sending-only key). Check in the Resend dashboard that the domain is verified.";
  } else if (!response.ok) {
    report.verdict = `Resend answered HTTP ${response.status}.`;
    process.exitCode = 1;
  } else {
    const { data = [] } = (await response.json()) as { data?: { name: string; status: string }[] };
    const domain = data.find((item) => sender.domain === item.name || sender.domain.endsWith(`.${item.name}`));
    report.domain = domain ? `${domain.name}: ${domain.status}` : `${sender.domain}: not in this Resend account`;
    report.verdict =
      domain?.status === "verified"
        ? "Ready: the sender's domain is verified."
        : "Not ready: add and verify the sender's domain in Resend (DNS records), or change EMAIL_FROM.";
    if (domain?.status !== "verified") process.exitCode = 1;
  }
  console.log(JSON.stringify(report, null, 2));
}

main().catch(() => {
  console.error("Email sender check failed before reaching a verdict.");
  process.exitCode = 1;
});
