"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { countries } from "countries-list";
import {
  getCountries,
  getCountryCallingCode,
  type CountryCode,
} from "libphonenumber-js/max";
import {
  SIRAH_TITLE,
  formatSirahMoney,
  type SirahPlan,
  type SirahMethod,
} from "@/lib/sirah/catalog";
import { normalizeSirahPhone } from "@/lib/sirah/phone";
import type { publicSirahOrder } from "@/services/sirah-registration.service";
import styles from "./registration.module.css";
type Order = Awaited<ReturnType<typeof publicSirahOrder>>;
type User = {
  fullName: string;
  email: string;
  phoneCountryCode: string;
  phoneNumber: string;
};
const phoneCountries = getCountries()
  .map((code) => ({
    code,
    name: countries[code as keyof typeof countries]?.name || code,
    calling: `+${getCountryCallingCode(code)}`,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));
const residenceCountries = Object.entries(countries)
  .map(([code, c]) => ({ code, name: c.name }))
  .sort((a, b) => a.name.localeCompare(b.name));
async function api(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });
  const result = await response.json();
  if (!response.ok) {
    const fields = result.fields
      ? Object.values(result.fields).flat().join(" ")
      : "";
    throw Error(
      `${result.error || "Please try again."}${fields ? ` ${fields}` : ""}`,
    );
  }
  return result;
}
function Terms({
  order,
  accepted,
  onChange,
}: {
  order: Order;
  accepted: boolean;
  onChange: (v: boolean) => void;
}) {
  return order.terms ? (
    <div className={styles.terms}>
      <h3>Before making a payment</h3>
      {["commitment", "cancellation", "refund", "access", "tax"].map((key) => (
        <p key={key}>
          <strong>{key[0].toUpperCase() + key.slice(1)}: </strong>
          {order.terms![key as keyof typeof order.terms]}
        </p>
      ))}
      {order.plan === "MONTHLY" && (
        <p>
          The next billing date will be displayed by the payment provider before
          you confirm payment. Billing ends within the agreed 12-month
          programme.
        </p>
      )}
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={accepted}
          onChange={(event) => onChange(event.target.checked)}
        />
        I have read and agree to these payment and access terms (version{" "}
        {order.terms.version}).
      </label>
    </div>
  ) : (
    <p className={styles.notice}>
      Payment methods will open after their payment, cancellation, refund and
      access terms are approved. Your registration can still be recorded.
    </p>
  );
}
export function SirahRegistrationForm({
  initialCountry,
  initialPlan,
  requireBillingCountry = false,
}: {
  initialCountry?: string;
  initialPlan?: SirahPlan;
  requireBillingCountry?: boolean;
} = {}) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [orders, setOrders] = useState<
    {
      id: string;
      reference: string;
      paymentState: string;
      enrolmentState: string;
    }[]
  >([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneCountry, setPhoneCountry] = useState<CountryCode>("GB");
  const [phone, setPhone] = useState("");
  const [billing, setBilling] = useState(
    requireBillingCountry
      ? ""
      : initialCountry && initialCountry in countries
        ? initialCountry
        : "GB",
  );
  const [billingEdited, setBillingEdited] = useState(
    Boolean(
      requireBillingCountry || (initialCountry && initialCountry in countries),
    ),
  );
  const [search, setSearch] = useState("");
  const [plan, setPlan] = useState<SirahPlan>(initialPlan || "MONTHLY");
  const [available, setAvailable] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [evidenceRoute, setEvidenceRoute] = useState("UPLOAD");
  const [invitation, setInvitation] = useState<{
    message: string;
    groupUrl: string | null;
  } | null>(null);
  const requestKey = useRef("");
  useEffect(() => {
    let active = true;
    void api("/api/sirah/session")
      .then(async (result) => {
        if (!active) return;
        if (result.available === false) {
          setAvailable(false);
          return;
        }
        setUser(result.user);
        if (result.user) {
          setName(result.user.fullName);
          setEmail(result.user.email);
        }
        const id = new URL(window.location.href).searchParams.get("order");
        if (id && result.user) {
          const current = await api(
            `/api/sirah/orders/${encodeURIComponent(id)}`,
          );
          if (active) setOrder(current.order);
        } else if (result.user) {
          const list = await api("/api/sirah/orders");
          if (active) setOrders(list.orders);
        }
      })
      .catch((cause) => {
        if (active) setError(cause.message);
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    if (
      order?.paymentState === "PAID" &&
      ["ACTIVE", "COMPLETED"].includes(order.enrolmentState)
    )
      void api(`/api/sirah/orders/${order.id}/confirmation`)
        .then((result) => {
          if (active) setInvitation(result);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [order?.id, order?.paymentState, order?.enrolmentState]);
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await work();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  function choosePhoneCountry(code: CountryCode) {
    setPhoneCountry(code);
    setPhoneError("");
    if (!billingEdited) setBilling(code);
  }
  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      normalizeSirahPhone(
        phoneCountry,
        `+${getCountryCallingCode(phoneCountry)}`,
        phone,
      );
      setPhoneError("");
    } catch (cause) {
      setPhoneError(
        cause instanceof Error ? cause.message : "Check your phone number.",
      );
      return;
    }
    await run(async () => {
      requestKey.current ||= crypto.randomUUID();
      const result = await api("/api/sirah/orders", {
        method: "POST",
        body: JSON.stringify({
          fullName: name,
          email,
          ...(!user
            ? {
                password: data.get("password"),
                confirmPassword: data.get("confirmPassword"),
              }
            : {}),
          phoneCountry,
          callingCode: `+${getCountryCallingCode(phoneCountry)}`,
          phone,
          countryCode: billing,
          plan,
          requestKey: requestKey.current,
        }),
      });
      setOrder(result.order);
      setMessage(result.message);
      const url = new URL(window.location.href);
      if (url.pathname === "/seerah/register") {
        url.searchParams.set("order", result.order.id);
        window.history.replaceState(null, "", url);
      }
    });
  }
  async function reprice(
    countryCode: string,
    nextPlan: SirahPlan,
    method: SirahMethod | null,
  ) {
    if (!order) return;
    await run(async () => {
      const result = await api(`/api/sirah/orders/${order.id}/quote`, {
        method: "POST",
        body: JSON.stringify({
          revision: order.revision,
          countryCode,
          plan: nextPlan,
          method,
        }),
      });
      setOrder(result.order);
      setAccepted(false);
    });
  }
  async function refresh() {
    if (!order) return;
    await run(async () => {
      const result = await api(`/api/sirah/orders/${order.id}`);
      setOrder(result.order);
    });
  }
  async function checkPayment() {
    if (!order) return;
    await run(async () => {
      const result = await api(`/api/sirah/orders/${order.id}/verify`, {
        method: "POST",
        body: "{}",
      });
      setOrder(result.order);
      setMessage(
        result.order.paymentState === "PAID"
          ? "Payment verified. Your enrolment status is shown below."
          : "The payment is still processing. Course access follows verified payment.",
      );
    });
  }
  async function checkout() {
    if (!order || !accepted) return;
    await run(async () => {
      const result = await api(`/api/sirah/orders/${order.id}/checkout`, {
        method: "POST",
        body: JSON.stringify({
          revision: order.revision,
          acceptedTermsVersion: order.terms?.version,
        }),
      });
      if (!result.url) throw Error("No payment destination is available yet.");
      window.location.assign(result.url);
    });
  }
  async function resetCheckout() {
    if (!order) return;
    await run(async () => {
      const result = await api(`/api/sirah/orders/${order.id}/reset-checkout`, {
        method: "POST",
        body: "{}",
      });
      setOrder(result.order);
      setAccepted(false);
      setMessage(
        "The unsettled checkout is closed. Choose an available payment method; Pakistan manual monthly payments use PKR 3,500.",
      );
    });
  }
  async function manageBilling() {
    if (!order) return;
    await run(async () => {
      const result = await api(`/api/sirah/orders/${order.id}/billing`, {
        method: "POST",
        body: JSON.stringify({ action: "PORTAL", revision: order.revision }),
      });
      window.location.assign(result.url);
    });
  }
  async function cancelRegistration() {
    if (!order) return;
    const reason = window.prompt(
      "Reason for cancellation (the approved terms apply):",
    );
    if (!reason) return;
    if (
      !window.confirm(
        "Request cancellation under the displayed approved terms?",
      )
    )
      return;
    await run(async () => {
      await api(`/api/sirah/orders/${order.id}/billing`, {
        method: "POST",
        body: JSON.stringify({
          action: "CANCEL",
          revision: order.revision,
          reason,
        }),
      });
      const fresh = await api(`/api/sirah/orders/${order.id}`);
      setOrder(fresh.order);
      setMessage("Cancellation has been recorded under the approved terms.");
    });
  }
  async function submitEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!order) return;
    const data = new FormData(event.currentTarget);
    await run(async () => {
      const details = {
        revision: order.revision,
        method: order.method,
        route: evidenceRoute,
        payerName: data.get("payerName"),
        transactionReference: data.get("transactionReference") || undefined,
        paymentDate: data.get("paymentDate") || undefined,
        amount: data.get("amount") || undefined,
        note: data.get("note") || undefined,
      };
      data.set("details", JSON.stringify(details));
      data.set("acceptedTermsVersion", order.terms?.version || "");
      const result = await api(`/api/sirah/orders/${order.id}/evidence`, {
        method: "POST",
        body: data,
      });
      setMessage(result.message);
      const current = await api(`/api/sirah/orders/${order.id}`);
      setOrder(current.order);
    });
  }
  return (
    <div className={styles.experience}>
      <p className={styles.eyebrow}>
        The Global Awakening · Course registration
      </p>
      <h2>{SIRAH_TITLE}</h2>
      <p>12 months · Live online teaching and Q&A</p>
      <p>
        Registration records your application and account. Enrolment and course
        access follow verified payment or admin approval.
      </p>
      {!ready ? (
        <p role="status">Loading registration…</p>
      ) : !available ? (
        <div className={styles.notice} role="status">
          <p>
            Registration setup is being completed. You can enquire with the team
            while registration is unavailable.
          </p>
          <a
            href="https://wa.me/923262055614"
            target="_blank"
            rel="noopener noreferrer"
          >
            Enquire on WhatsApp ↗
          </a>
        </div>
      ) : !order ? (
        <>
          {orders.length > 0 && (
            <div className={styles.notice}>
              <h3>Your existing registration</h3>
              {orders.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const result = await api(`/api/sirah/orders/${item.id}`);
                      setOrder(result.order);
                    })
                  }
                >
                  {item.reference} · {item.paymentState}
                </button>
              ))}
            </div>
          )}
          <form onSubmit={register} className={styles.form}>
            <label>
              Full name
              <input
                value={name}
                readOnly={!!user}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                minLength={2}
                maxLength={120}
                required
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={email}
                readOnly={!!user}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </label>
            {!user ? (
              <>
                <p>
                  Already registered an account? <a href="/login">Sign in</a>{" "}
                  with your existing email and password.
                </p>
                <div className={styles.grid}>
                  <label>
                    Create password
                    <input
                      name="password"
                      type="password"
                      minLength={8}
                      maxLength={72}
                      autoComplete="new-password"
                      required
                    />
                  </label>
                  <label>
                    Confirm password
                    <input
                      name="confirmPassword"
                      type="password"
                      minLength={8}
                      maxLength={72}
                      autoComplete="new-password"
                      required
                    />
                  </label>
                </div>
              </>
            ) : (
              <p>
                Using your signed-in account. No additional password is needed.
              </p>
            )}
            <label>
              Search phone countries
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Country name or calling code"
              />
            </label>
            <div className={styles.grid}>
              <label>
                Phone country
                <select
                  aria-label="Phone country"
                  value={phoneCountry}
                  onChange={(event) =>
                    choosePhoneCountry(event.target.value as CountryCode)
                  }
                >
                  {phoneCountries
                    .filter(
                      (c) =>
                        c.code === phoneCountry ||
                        `${c.name} ${c.calling}`
                          .toLowerCase()
                          .includes(search.toLowerCase()),
                    )
                    .map((c) => (
                      <option value={c.code} key={c.code}>
                        {c.name} ({c.calling})
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Phone / WhatsApp
                <input
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(event) => {
                    setPhone(event.target.value);
                    setPhoneError("");
                  }}
                  placeholder="National or international number"
                  required
                  aria-invalid={!!phoneError}
                  aria-describedby="sirah-phone-help"
                />
              </label>
            </div>
            <p id="sirah-phone-help">
              {phoneError ||
                "We validate the number format for your selected country. This does not verify phone ownership or WhatsApp availability."}
            </p>
            <label>
              Country of residence / billing country
              <select
                aria-label="Country of residence / billing country"
                required
                value={billing}
                onChange={(event) => {
                  setBilling(event.target.value);
                  setBillingEdited(true);
                }}
              >
                <option value="" disabled>
                  Select your billing country
                </option>
                {residenceCountries.map((c) => (
                  <option value={c.code} key={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <p>
              The phone country suggests your billing country initially. Change
              billing country if you live elsewhere; fees use your billing
              country, not the calling prefix.
            </p>
            <label>
              Preferred payment plan
              <select
                aria-label="Preferred payment plan"
                value={plan}
                onChange={(event) => setPlan(event.target.value as SirahPlan)}
              >
                <option value="MONTHLY">Monthly payment</option>
                <option value="ANNUAL">
                  Annual upfront — one payment for 12 months
                </option>
              </select>
            </label>
            <button className={styles.primary} type="submit" disabled={busy}>
              {busy ? "Recording registration…" : "Register for the Course"}
            </button>
          </form>
        </>
      ) : (
        <section aria-label="Your course registration">
          <p>
            <strong>Reference: {order.reference}</strong>
          </p>
          <div className={styles.status}>
            <p>
              Payment:{" "}
              <strong>{order.paymentState.replaceAll("_", " ")}</strong>
            </p>
            <p>
              Enrolment: <strong>{order.enrolmentState}</strong>
            </p>
          </div>
          {invitation &&
            order.paymentState === "PAID" &&
            ["ACTIVE", "COMPLETED"].includes(order.enrolmentState) && (
              <div className={styles.notice} role="status">
                <p>{invitation.message}</p>
                {invitation.groupUrl && (
                  <a
                    className={styles.primary}
                    href={invitation.groupUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Join your assigned course group
                  </a>
                )}
              </div>
            )}
          <div className={styles.grid}>
            <label>
              Country of residence / billing country
              <select
                aria-label="Country of residence / billing country"
                value={order.countryCode}
                disabled={
                  busy ||
                  !["UNPAID", "REJECTED", "FAILED"].includes(order.paymentState)
                }
                onChange={(event) =>
                  void reprice(
                    event.target.value,
                    order.plan as SirahPlan,
                    null,
                  )
                }
              >
                <option value="" disabled>
                  Select your billing country
                </option>
                {residenceCountries.map((c) => (
                  <option value={c.code} key={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Payment plan
              <select
                aria-label="Payment plan"
                value={order.plan}
                disabled={
                  busy ||
                  !["UNPAID", "REJECTED", "FAILED"].includes(order.paymentState)
                }
                onChange={(event) =>
                  void reprice(
                    order.countryCode,
                    event.target.value as SirahPlan,
                    null,
                  )
                }
              >
                <option value="MONTHLY">Monthly payment</option>
                <option value="ANNUAL">Annual upfront</option>
              </select>
            </label>
          </div>
          <div className={styles.summary}>
            <p>
              Next billing date:{" "}
              {order.nextBillingAt
                ? new Date(order.nextBillingAt).toLocaleDateString()
                : order.paymentState === "UNPAID"
                  ? "Shown before payment is confirmed"
                  : "No further billing date is scheduled"}
              .
            </p>
            {order.programmeEnd && (
              <p>
                Programme access end:{" "}
                {new Date(order.programmeEnd).toLocaleDateString()}.
              </p>
            )}
            <h3>
              {formatSirahMoney(order.amountMinor, order.currency)}{" "}
              <small>
                {order.plan === "ANNUAL"
                  ? "one payment for 12 months"
                  : "per month"}
              </small>
            </h3>
            <p>
              Charge currency: {order.currency}.{" "}
              {order.marketCode === "OTHER"
                ? "Your bank’s local conversion may vary."
                : "Fixed regional fee."}
            </p>
            {order.plan === "MONTHLY" ? (
              <p>
                12-payment comparison:{" "}
                {formatSirahMoney(order.totalMinor, order.currency)}. This
                comparison does not define cancellation or commitment terms.
              </p>
            ) : (
              <p>
                Annual upfront is approximately 10% less than 12 online monthly
                payments.
              </p>
            )}
            {order.countryCode === "PK" &&
              order.plan === "MONTHLY" &&
              !order.methods.includes("STRIPE") &&
              !order.methods.includes("PAYPAL") && (
                <p>
                  Pakistan’s manual monthly rate is shown. The PKR 3,000
                  recurring option remains unavailable until verified for the
                  configured billing route.
                </p>
              )}
          </div>
          {["PROCESSING", "REFUND_PENDING"].includes(order.paymentState) ? (
            <div className={styles.notice}>
              <p>
                Payment is processing. A return URL or approved checkout does
                not confirm payment.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void checkPayment()}
              >
                Check verified payment status
              </button>
              {order.method === "STRIPE" &&
                order.paymentState === "PROCESSING" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void resetCheckout()}
                  >
                    Close an unpaid checkout to change payment method
                  </button>
                )}
            </div>
          ) : null}
          {["UNPAID", "REJECTED", "FAILED"].includes(order.paymentState) &&
            ["PENDING", "ACTIVE"].includes(order.enrolmentState) && (
              <>
                <label>
                  Available payment method
                  <select
                    aria-label="Available payment method"
                    value={order.method || ""}
                    disabled={busy || !order.methods.length}
                    onChange={(event) =>
                      void reprice(
                        order.countryCode,
                        order.plan as SirahPlan,
                        event.target.value as SirahMethod,
                      )
                    }
                  >
                    <option value="">Choose a verified payment route</option>
                    {order.methods.map((method) => (
                      <option value={method} key={method}>
                        {method === "BANK_TRANSFER"
                          ? "Meezan Bank"
                          : method === "JAZZCASH"
                            ? "JazzCash"
                            : method === "STRIPE"
                              ? "Card (Stripe)"
                              : "PayPal"}
                      </option>
                    ))}
                  </select>
                </label>
                <Terms
                  order={order}
                  accepted={accepted}
                  onChange={setAccepted}
                />
                {!order.methods.length && (
                  <p className={styles.notice}>
                    Your registration is recorded. No payment route is currently
                    approved for this selection. Contact TGA for the next step;
                    no payment has been taken.
                  </p>
                )}
                {order.method &&
                  ["STRIPE", "PAYPAL"].includes(order.method) && (
                    <button
                      type="button"
                      className={styles.primary}
                      disabled={busy || !accepted}
                      onClick={() => void checkout()}
                    >
                      Continue to secure payment
                    </button>
                  )}
                {order.method &&
                  ["BANK_TRANSFER", "JAZZCASH"].includes(order.method) &&
                  order.manualEvidenceAllowed && (
                    <>
                      <div className={styles.notice}>
                        {order.manualAccounts
                          .filter((a) => a.method === order.method)
                          .map((account) => (
                            <div key={account.method}>
                              <h3>{account.service}</h3>
                              {[
                                ["Account holder", account.holder],
                                ["Account number", account.account],
                                ...(account.iban
                                  ? [["IBAN", account.iban]]
                                  : []),
                              ].map(([label, value]) => (
                                <p key={label}>
                                  {label}: <strong>{value}</strong>{" "}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void navigator.clipboard
                                        .writeText(value)
                                        .then(() =>
                                          setMessage(`${label} copied.`),
                                        )
                                        .catch(() =>
                                          setError(
                                            "Copy failed. Select and copy the account detail manually.",
                                          ),
                                        )
                                    }
                                  >
                                    Copy
                                  </button>
                                </p>
                              ))}
                            </div>
                          ))}
                        <p>
                          Amount due:{" "}
                          {formatSirahMoney(order.amountMinor, order.currency)}
                        </p>
                        <p>
                          Add SIRAH BEYOND CHRONOLOGY and your registration
                          reference in the payment remarks.
                        </p>
                        <p>
                          <strong>
                            SIRAH BEYOND CHRONOLOGY {order.reference}
                          </strong>{" "}
                          <button
                            type="button"
                            onClick={() =>
                              void navigator.clipboard
                                .writeText(
                                  `SIRAH BEYOND CHRONOLOGY ${order.reference}`,
                                )
                                .then(() =>
                                  setMessage("Payment reference copied."),
                                )
                            }
                          >
                            Copy reference
                          </button>
                        </p>
                      </div>
                      <p>
                        After payment, upload your receipt here or send your
                        screenshot to 03262055614 on WhatsApp. Include your
                        registration reference, full name and registered email.
                      </p>
                      <a
                        href={order.paymentSupportUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Send payment evidence on WhatsApp ↗
                      </a>
                      <form onSubmit={submitEvidence} className={styles.form}>
                        <label>
                          Submission route
                          <select
                            aria-label="Submission route"
                            value={evidenceRoute}
                            onChange={(event) =>
                              setEvidenceRoute(event.target.value)
                            }
                          >
                            <option value="UPLOAD">
                              Upload a private receipt
                            </option>
                            <option value="WHATSAPP">
                              I will send / have sent the screenshot on WhatsApp
                            </option>
                          </select>
                        </label>
                        {evidenceRoute === "UPLOAD" && (
                          <label>
                            Receipt (JPG, PNG or PDF, up to 4 MB)
                            <input
                              type="file"
                              name="receipt"
                              accept="image/jpeg,image/png,application/pdf"
                              required
                            />
                          </label>
                        )}
                        <label>
                          Payer name, if available
                          <input
                            name="payerName"
                            defaultValue={user?.fullName || name}
                            required
                            minLength={2}
                            maxLength={120}
                          />
                        </label>
                        <div className={styles.grid}>
                          <label>
                            Payment date, if available
                            <input type="date" name="paymentDate" />
                          </label>
                          <label>
                            Amount sent, if available
                            <input
                              name="amount"
                              inputMode="decimal"
                              pattern="[0-9]+([.][0-9]{1,3})?"
                            />
                          </label>
                        </div>
                        <label>
                          Transaction reference, if available
                          <input name="transactionReference" maxLength={120} />
                        </label>
                        <label>
                          Notes, if needed
                          <textarea name="note" maxLength={1500} />
                        </label>
                        <button
                          className={styles.primary}
                          type="submit"
                          disabled={busy || !accepted}
                        >
                          {busy
                            ? "Submitting evidence…"
                            : "Submit for admin review"}
                        </button>
                        <p>
                          Evidence is reviewed by an admin. A screenshot does
                          not automatically confirm payment.
                        </p>
                      </form>
                    </>
                  )}
              </>
            )}
          {order.paymentState === "AWAITING_REVIEW" && (
            <p className={styles.notice}>
              Your payment submission has been received. Enrolment confirmation
              follows admin approval.
            </p>
          )}
          {order.receipts.length > 0 && (
            <div>
              <h3>Your private receipts</h3>
              {order.receipts.map((receipt) => (
                <p key={receipt.id}>
                  <a href={`/api/sirah/receipts/${receipt.id}`}>
                    {receipt.filename} · evidence version {receipt.revision}
                  </a>
                </p>
              ))}
            </div>
          )}
          {order.hasBillingProfile && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void manageBilling()}
            >
              Manage billing / payment details
            </button>
          )}
          {order.enrolmentState !== "CANCELLED" &&
            order.enrolmentState !== "COMPLETED" &&
            (order.terms || order.paymentState === "UNPAID") && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void cancelRegistration()}
              >
                Request cancellation
              </button>
            )}
          <button type="button" disabled={busy} onClick={() => void refresh()}>
            Refresh registration status
          </button>
          <p>
            <a href="/dashboard">Student dashboard</a> ·{" "}
            <a href={`/seerah/register?order=${order.id}`}>
              Open this registration page
            </a>
          </p>
        </section>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className={styles.notice} role="status">
          {message}
        </p>
      )}
    </div>
  );
}
