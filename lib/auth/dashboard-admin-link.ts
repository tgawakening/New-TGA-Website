/**
 * Whether the student dashboard should show the "Admin Panel" link.
 *
 * Decided by the SIGNED-IN account, not the browser: the super-admin cookie
 * (ga_admin_session) is browser-wide, so on its own it would show the link to
 * any student account signed in on a machine where the admin is also logged
 * in. The link shows only for a Sīrah team account, or when the admin
 * session belongs to the same email as the signed-in account.
 */
export function canSeeDashboardAdminLink(
  user: { email: string; role: string },
  adminSessionEmail: string | null | undefined,
) {
  if (user.role === "SIRAH_VIEWER" || user.role === "SIRAH_REVIEWER") return true;
  return (
    !!adminSessionEmail &&
    adminSessionEmail.trim().toLowerCase() === user.email.trim().toLowerCase()
  );
}
