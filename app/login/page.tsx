import Link from "next/link";
import { redirect } from "next/navigation";
import LoginForm from "@/components/auth/login-form";
import { getCurrentUser } from "@/lib/auth/session";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="ga-page">
      <section className="ga-section">
        <div className="ga-container ga-login-shell">
          <article className="ga-login-copy">
            <p className="ga-dashboard-kicker">Student access</p>
            <h1 className="ga-heading">Login to your Seerah dashboard</h1>
            <p className="ga-copy" style={{ marginTop: "0.8rem" }}>
              Use the same email and password you created during registration. Once your payment is
              approved, your dashboard and LMS access open automatically.
            </p>
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
          </article>

          <article className="ga-dashboard-card">
            <h2 className="ga-dashboard-card-title">Sign In</h2>
            <LoginForm />
            <p className="ga-dashboard-muted" style={{ marginTop: "1rem" }}>
              No account yet? <Link href="/seerah/register">Create your registration</Link>
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
