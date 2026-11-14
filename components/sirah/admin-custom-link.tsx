"use client";
import { useMemo, useState, type FormEvent } from "react";

type CountryOption = {
  code: string;
  name: string;
  currency: string;
  catalogAnnual: string;
  catalogMonthly: string;
};
type Created = {
  orderId: string;
  reference: string;
  url: string;
  expiresAt: string;
  plan: "ANNUAL" | "MONTHLY";
  amount: string;
  catalogAmount: string;
  newAccount: boolean;
  accountEmail: "SENT" | "SKIPPED" | "FAILED" | "NOT_NEEDED";
};

const accountEmailText: Record<Created["accountEmail"], string> = {
  SENT: "New account created; the temporary password was emailed to the student.",
  SKIPPED: "New account created, but email sending is not configured, so the temporary password was NOT sent. Resolve email delivery before the student needs to sign in.",
  FAILED: "New account created, but the temporary password email failed to send. Check the email log before the student needs to sign in.",
  NOT_NEEDED: "The student already had an account; no password email was sent.",
};

/** Admin tab: issue a Stripe card link at a custom amount (sponsorship,
 * in-person or group booking): one-time for the full programme, or a monthly
 * subscription. Paying it enrols the student automatically. */
export function SirahAdminCustomLink({
  countries,
  currencies,
}: {
  countries: CountryOption[];
  currencies: string[];
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<Created | null>(null);
  const [copied, setCopied] = useState(false);
  const [country, setCountry] = useState("GB");
  const [currency, setCurrency] = useState("");
  const [plan, setPlan] = useState<"ANNUAL" | "MONTHLY">("ANNUAL");
  const monthly = plan === "MONTHLY";
  const selected = useMemo(
    () => countries.find((option) => option.code === country),
    [countries, country],
  );
  const labelStyle = { color: "#3d668f" };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) || "").trim();
    const chargeCurrency = currency || selected?.currency || "";
    if (
      !window.confirm(
        monthly
          ? `Create a monthly ${chargeCurrency} ${text("amount")} card subscription link for ${text("fullName")} (${text("email")})? The card is charged ${chargeCurrency} ${text("amount")} every month for up to 12 months, and the first payment enrols the student.`
          : `Create a one-time ${chargeCurrency} ${text("amount")} card link for ${text("fullName")} (${text("email")})? Paying it enrols the student for the full programme.`,
      )
    )
      return;
    const formEl = event.currentTarget;
    setBusy(true);
    setError("");
    setCreated(null);
    setCopied(false);
    try {
      const phoneNumber = text("phone");
      const response = await fetch("/api/admin/sirah/custom-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: text("fullName"),
          email: text("email"),
          plan,
          countryCode: country,
          currency: currency || undefined,
          amount: text("amount"),
          sponsorLabel: text("sponsorLabel") || undefined,
          note: text("note") || undefined,
          phone: phoneNumber
            ? { country: text("phoneCountry").toUpperCase() || country, callingCode: text("callingCode"), number: phoneNumber }
            : undefined,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw Error(result.error || "Could not create the payment link.");
      setCreated(result as Created);
      formEl.reset();
      setCurrency("");
      setPlan("ANNUAL");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the payment link.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="ga-admin-shell">
      <section className="ga-admin-workspace-card">
        <div className="ga-admin-workspace-head">
          <div>
            <p className="ga-admin-kicker">Current batch · full programme or monthly</p>
            <h2>Custom payment link</h2>
            <p>
              Create a card payment link at an agreed price for a sponsorship,
              in-person or group booking, or a student stuck on the monthly
              plan: one-time for the full programme, or a monthly subscription
              at the agreed monthly amount. Payment goes through the Sīrah
              Stripe account, and the student is enrolled automatically when
              the first payment is made.
            </p>
          </div>
        </div>

        <form className="ga-admin-filter-row ga-admin-field-grid" onSubmit={submit} aria-busy={busy}>
          <label>
            <span className="ga-admin-label" style={labelStyle}>Student full name</span>
            <input className="ga-admin-search" name="fullName" required minLength={2} maxLength={120} autoComplete="off" />
          </label>
          <label>
            <span className="ga-admin-label" style={labelStyle}>Student email</span>
            <input className="ga-admin-search" name="email" type="email" required maxLength={254} autoComplete="off" />
          </label>
          <label>
            <span className="ga-admin-label" style={labelStyle}>Plan</span>
            <select
              className="ga-admin-search"
              name="plan"
              value={plan}
              onChange={(event) => setPlan(event.target.value === "MONTHLY" ? "MONTHLY" : "ANNUAL")}
            >
              <option value="ANNUAL">Full programme (one-time)</option>
              <option value="MONTHLY">Monthly subscription (up to 12 months)</option>
            </select>
          </label>
          <label>
            <span className="ga-admin-label" style={labelStyle}>Student country</span>
            <select className="ga-admin-search" value={country} onChange={(event) => setCountry(event.target.value)}>
              {countries.map((option) => (
                <option key={option.code} value={option.code}>{option.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="ga-admin-label" style={labelStyle}>Charge currency</span>
            <select className="ga-admin-search" value={currency} onChange={(event) => setCurrency(event.target.value)}>
              <option value="">{selected ? `${selected.currency} (catalog for ${selected.name})` : "Catalog currency"}</option>
              {currencies.map((code) => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="ga-admin-label" style={labelStyle}>
              {monthly ? "Custom amount per month" : "Custom amount"}
              {selected
                ? ` (catalog: ${monthly ? `${selected.catalogMonthly}/month` : selected.catalogAnnual})`
                : ""}
            </span>
            <input className="ga-admin-search" name="amount" required inputMode="decimal" pattern="\d+(\.\d{1,3})?" placeholder="150.00" />
          </label>
          <label>
            <span className="ga-admin-label" style={labelStyle}>Sponsor / label (optional)</span>
            <input className="ga-admin-search" name="sponsorLabel" maxLength={120} placeholder="e.g. Masjid group booking" />
          </label>
          <label>
            <span className="ga-admin-label" style={labelStyle}>Internal note (optional)</span>
            <input className="ga-admin-search" name="note" maxLength={1000} />
          </label>
          <label>
            <span className="ga-admin-label" style={labelStyle}>Phone (optional)</span>
            <input className="ga-admin-search" name="phone" maxLength={30} autoComplete="off" placeholder="7700 900123" />
          </label>
          <label>
            <span className="ga-admin-label" style={labelStyle}>Phone country / calling code</span>
            <span style={{ display: "flex", gap: "0.5rem" }}>
              <input className="ga-admin-search" name="phoneCountry" maxLength={2} placeholder={country} style={{ width: "4.5rem" }} />
              <input className="ga-admin-search" name="callingCode" maxLength={5} placeholder="+44" style={{ width: "6rem" }} />
            </span>
          </label>
          <div className="ga-admin-actions">
            <button className="ga-admin-primary-btn" type="submit" disabled={busy}>
              {busy ? "Creating…" : "Create payment link"}
            </button>
          </div>
        </form>

        <p className="ga-admin-workspace-head" style={{ marginTop: "1rem" }}>
          The link is valid for about 23 hours. To replace an unpaid or expired
          link, submit the same email again; the previous link is closed first. The
          student cannot change this price from the website.
        </p>

        {created && (
          <div
            className="ga-admin-row"
            role="status"
            style={{ marginTop: "1rem", display: "grid", gridTemplateColumns: "1fr", gap: "0.85rem", alignItems: "start" }}
          >
            <strong style={{ fontSize: "1rem", color: "#17324d" }}>
              {created.plan === "MONTHLY"
                ? `Monthly subscription link ready for ${created.amount}/month (catalog ${created.catalogAmount}/month)`
                : `Link ready for ${created.amount} (catalog ${created.catalogAmount})`}{" "}
              · {created.reference}
            </strong>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.75rem" }}>
              <code style={{ fontSize: "0.95rem", wordBreak: "break-all" }}>{created.url}</code>
              <button type="button" className="ga-admin-outline-btn" onClick={copyLink}>
                {copied ? "Copied" : "Copy link"}
              </button>
            </div>
            <span style={{ color: "#17324d" }}>
              Expires {new Date(created.expiresAt).toLocaleString("en-GB")}. {accountEmailText[created.accountEmail]}
            </span>
            <a href={`/admin/sirah?order=${encodeURIComponent(created.orderId)}`} className="ga-admin-outline-btn" style={{ justifySelf: "start" }}>
              Open enrolment record
            </a>
          </div>
        )}
        {error && (
          <p className="ga-admin-row" role="alert" style={{ marginTop: "1rem", display: "grid", gridTemplateColumns: "1fr" }}>
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
