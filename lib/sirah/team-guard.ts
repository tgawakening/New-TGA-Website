/** Server-side guards for Sīrah access management (pure; no I/O). */

export const SIRAH_TEAM_ROLES = ["SIRAH_VIEWER", "SIRAH_REVIEWER"] as const;
type GuardEnv = Record<string, string | undefined>;

function normalizeEmail(value: string | undefined | null) {
  let text = (value || "").trim();
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  )
    text = text.slice(1, -1).trim();
  return text.toLowerCase();
}

/** The env Super Admin (ADMIN_DASHBOARD_EMAIL) can never be provisioned as a
 * team account, demoted or revoked: not by anyone, including itself. */
export function isProtectedSuperAdminEmail(
  email: string,
  env: GuardEnv = process.env,
) {
  const protectedEmail = normalizeEmail(env.ADMIN_DASHBOARD_EMAIL);
  return !!protectedEmail && normalizeEmail(email) === protectedEmail;
}

export type TeamTarget = { email: string; role: string; status: string };

/** Returns a refusal message, or null when the change is allowed. */
export function teamChangeRefusal(
  action: "DEMOTE" | "REVOKE" | "PROMOTE",
  target: TeamTarget,
  env: GuardEnv = process.env,
) {
  if (isProtectedSuperAdminEmail(target.email, env))
    return "The Super Admin account cannot be demoted, revoked or changed here.";
  if (!(SIRAH_TEAM_ROLES as readonly string[]).includes(target.role))
    return "Only Sīrah team accounts (Manager or Community Lead) can be changed here.";
  if (action === "DEMOTE" && target.role !== "SIRAH_REVIEWER")
    return "Only a Manager can be demoted to Community Lead.";
  if (action === "PROMOTE" && target.role !== "SIRAH_VIEWER")
    return "Only a Community Lead can be promoted to Manager.";
  if (action !== "REVOKE" && target.status !== "ACTIVE")
    return "This account is suspended. Re-add it as a Community Lead to restore access.";
  if (action === "REVOKE" && target.status !== "ACTIVE")
    return "This account's access is already revoked.";
  return null;
}
