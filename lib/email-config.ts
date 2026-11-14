/** The one place the sender is read. Every transactional email (Sīrah
 * notices, classroom emails, password resets) is sent from EMAIL_FROM, which
 * must be an address on a domain verified in Resend. Accepts
 * `Name <noreply@domain>` or a bare `noreply@domain`, optionally quoted. */

export type EmailSender = { from: string; address: string; domain: string };

function unquote(raw: string | undefined) {
  const value = raw?.trim();
  if (!value) return "";
  const quoted = (value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"));
  return (quoted ? value.slice(1, -1) : value).trim();
}

export function parseEmailSender(raw: string | undefined): EmailSender | null {
  const value = unquote(raw);
  if (!value) return null;
  const match = /^(?:(.*?)\s*<([^<>\s]+@[^<>\s]+)>|([^<>\s]+@[^<>\s]+))$/.exec(value);
  const address = (match?.[2] || match?.[3] || "").toLowerCase();
  if (!/^[^@\s]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(address)) return null;
  return { from: value, address, domain: address.split("@")[1] };
}

export const emailSender = (env: NodeJS.ProcessEnv = process.env) => parseEmailSender(env.EMAIL_FROM);

/** The From header as configured. Sending uses it as is (Resend validates it),
 * so an unusual but valid format never silently stops mail; the parsed form
 * above is for the sender check and reports. */
export const emailFrom = (env: NodeJS.ProcessEnv = process.env) => unquote(env.EMAIL_FROM) || null;

export const resendApiKey = (env: NodeJS.ProcessEnv = process.env) => unquote(env.RESEND_API_KEY) || null;

/** True when both the API key and a sender are set. Whether the
 * domain is verified can only be checked against Resend itself: run
 * `npm run email:sender:check` where the production env is loaded. */
export const emailConfigured = (env: NodeJS.ProcessEnv = process.env) => Boolean(resendApiKey(env) && emailFrom(env));
