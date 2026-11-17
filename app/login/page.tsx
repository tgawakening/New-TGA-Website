import Link from "next/link";
import { redirect } from "next/navigation";
import LoginForm from "@/components/auth/login-form";
import { SirahNotice } from "@/components/sirah/sirah-notice";
import { getCurrentUser } from "@/lib/auth/session";

// True only for a same-site return to a saved Sirah booking (?order=...).
function isUnfinishedRegistration(next: string | string[] | undefined) {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//"))
    return false;
  const url = new URL(next, "https://local.invalid");
  return url.pathname === "/seerah/register" && Boolean(url.searchParams.get("order"));
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; reset?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) {
    redirect("/dashboard");
  }
  const params = await searchParams;
  const finishing = isUnfinishedRegistration(params.next);
  const passwordReset = params.reset === "1";

  return (
    <main className="ga-page">
      <SirahNotice placement="page" />
      <section className="ga-section">
        <div className="ga-container ga-login-shell">
          <article className="ga-login-copy">
            <p className="ga-dashboard-kicker">
              {finishing ? "Finish your registration" : "Student access"}
            </p>
            <h1 className="ga-heading">
              {finishing ? "Sign in to complete your payment" : "Login to your Seerah dashboard"}
            </h1>
            <p className="ga-copy" style={{ marginTop: "0.8rem" }}>
              {finishing
                ? "Your booking is saved. Sign in with the email and password you used when you registered, and you will go straight back to it to complete your payment."
                : "Use the same email and password you created during registration. Once your payment is approved, your dashboard and LMS access open automatically."}
            </p>
            {finishing ? null : (
            <div className="ga-dashboard-list" style={{ marginTop: "1.2rem" }}>
              <div className="ga-dashboard-list-item">
                <div>
                  <strong>Pending manual payment?</strong>
                  <p>You will receive an email once admin confirms it from the backend.</p>
                </div>
              </div>
              <div className="ga-dashboard-list-item">
                <div>
                  <strong>Need a new registration?</strong>
                  <p>Open the course registration flow again and choose your payment method.</p>
                </div>
              </div>
            </div>
            )}
          </article>

          <article className="ga-dashboard-card">
            <h2 className="ga-dashboard-card-title">
              {finishing ? "Sign in to continue" : "Sign In"}
            </h2>
            {passwordReset ? (
              <p role="status" className="ga-dashboard-muted" style={{ marginTop: "0.9rem" }}>
                Your password has been changed. Sign in with the new one.
              </p>
            ) : null}
            <LoginForm />
            <p className="ga-dashboard-muted" style={{ marginTop: "1rem" }}>
              <Link href="/forgot-password">Forgot password?</Link>
            </p>
            <p className="ga-dashboard-muted" style={{ marginTop: "0.5rem" }}>
              No account yet? <Link href="/seerah/register">Create your registration</Link>
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
