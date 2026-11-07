"use client";
import { useResidence, saveResidence } from "@/lib/sirah/use-residence";
import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type FormEvent,
  type Ref,
} from "react";
import { countries } from "countries-list";
import {
  getCountries,
  parsePhoneNumberFromString,
  getCountryCallingCode,
  type CountryCode,
} from "libphonenumber-js/max";
import {
  formatSirahMoney,
  type SirahPlan,
  type SirahMethod,
} from "@/lib/sirah/catalog";
import { sirahRegistrationSchema } from "@/lib/sirah/validation";
import Image from "next/image";
import { ConsultationAction } from "@/components/seerah/consultation-action";
import { PasswordFields } from "./password-fields";
import { priceFor } from "@/lib/sirah/catalog";
import { PhoneControl, countryFlagImage } from "./phone-control";
export type RegistrationControls = {
  setPreferences: (choice: { country?: string; plan?: SirahPlan }) => void;
};
const draftKey = "tga-sirah-registration-draft-v1";
class ApiError extends Error {
  fields?: Record<string, string[]>;
}
import type { publicSirahOrder } from "@/services/sirah-registration.service";
import styles from "./registration.module.css";
type Order = Awaited<ReturnType<typeof publicSirahOrder>>;
type User = {
  fullName: string;
  email: string;
  phoneCountryCode: string;
  phoneNumber: string;
};
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
    const error = new ApiError(result.error || "Please try again.");
    error.fields =
      result.fields ||
      (response.status === 409 && /email/i.test(result.error || "")
        ? { email: [result.error] }
        : undefined);
    throw error;
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
  detectedCountry,
  initialPlan,
  requireBillingCountry = false,
  controlRef,
}: {
  initialCountry?: string;
  detectedCountry?: string;
  initialPlan?: SirahPlan;
  requireBillingCountry?: boolean;
  controlRef?: Ref<RegistrationControls>;
} = {}) {
  const suggestedResidence = useResidence(detectedCountry);
  const [residenceConfirmed, setResidenceConfirmed] = useState(false);
  const [manualConfirmed, setManualConfirmed] = useState(false);
  const [passwordForManager, setPasswordForManager] = useState("");
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
  const [phoneCountry, setPhoneCountry] = useState<CountryCode>(
    initialCountry && getCountries().includes(initialCountry as CountryCode)
      ? (initialCountry as CountryCode)
      : getCountries().includes(suggestedResidence as CountryCode)
        ? (suggestedResidence as CountryCode)
        : "PK",
  );
  const [phone, setPhone] = useState("");
  const [billing, setBilling] = useState(
    requireBillingCountry
      ? ""
      : initialCountry && initialCountry in countries
        ? initialCountry
        : suggestedResidence,
  );
  const [billingEdited, setBillingEdited] = useState(
    Boolean(
      requireBillingCountry || (initialCountry && initialCountry in countries),
    ),
  );
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [quote, setQuote] = useState<{
    country: string;
    plan: SirahPlan;
    currency: string;
    amountMinor: number;
    totalMinor: number;
    cardAvailable: boolean;
  } | null>(null);
  const [quoteError, setQuoteError] = useState("");
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
    contactUrl?: string | null;
  } | null>(null);
  const initialPreferences = useRef({
    initialCountry,
    initialPlan,
    requireBillingCountry,
  });
  const requestKey = useRef("");
  const submitLock = useRef(false);
  useImperativeHandle(
    controlRef,
    () => ({
      setPreferences(choice) {
        if (order) return;
        if (choice.country) {
          setBilling(choice.country in countries ? choice.country : "");
          setBillingEdited(true);
          setResidenceConfirmed(false);
          saveResidence(choice.country);
        }
        if (choice.plan) setPlan(choice.plan);
      },
    }),
    [order],
  );
  useEffect(() => {
    if (!billingEdited && !initialCountry && !requireBillingCountry && !order)
      setBilling(suggestedResidence);
  }, [
    suggestedResidence,
    billingEdited,
    initialCountry,
    requireBillingCountry,
    order,
  ]);
  useEffect(() => {
    if (!ready || order || !billing || !(billing in countries)) return;
    const controller = new AbortController();
    void api("/api/pricing", {
      method: "POST",
      signal: controller.signal,
      body: JSON.stringify({
        courseSlug: "seerah-course",
        countryCode: billing,
        plan,
      }),
    })
      .then((result) => {
        if (!controller.signal.aborted) {
          setQuoteError("");
          setQuote({
            country: billing,
            plan,
            currency: result.pricing.currency,
            amountMinor: result.pricing.amountMinor,
            totalMinor: result.pricing.totalMinor,
            cardAvailable: Boolean(result.cardAvailable),
          });
        }
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setQuoteError(cause.message);
      });
    return () => controller.abort();
  }, [ready, order, billing, plan]);
  useEffect(() => {
    if (!ready || order) return;
    try {
      sessionStorage.setItem(
        draftKey,
        JSON.stringify({
          name,
          email,
          phoneCountry,
          phone,
          billing,
          plan,
          billingEdited,
        }),
      );
    } catch {}
  }, [
    ready,
    order,
    name,
    email,
    phoneCountry,
    phone,
    billing,
    plan,
    billingEdited,
  ]);
  function fieldError(key: string) {
    return fields[key]?.[0];
  }
  function clearField(key: string) {
    setFields((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }
  function errorText(key: string) {
    return fieldError(key) ? (
      <small
        id={`sirah-error-${key}`}
        className={styles.fieldError}
        role="alert"
      >
        {fieldError(key)}
      </small>
    ) : null;
  }

  useEffect(() => {
    const { initialCountry, initialPlan, requireBillingCountry } =
      initialPreferences.current;
    let active = true;
    void api("/api/sirah/session")
      .then(async (result) => {
        if (!active) return;
        if (result.available === false) {
          setAvailable(false);
          return;
        }
        let restoredPhone = false;
        try {
          const saved = JSON.parse(sessionStorage.getItem(draftKey) || "null");
          if (saved) {
            if (!result.user) {
              if (typeof saved.name === "string") setName(saved.name);
              if (typeof saved.email === "string") setEmail(saved.email);
            }
            if (typeof saved.phone === "string") {
              setPhone(saved.phone);
              restoredPhone = !!saved.phone;
            }
            if (getCountries().includes(saved.phoneCountry))
              setPhoneCountry(saved.phoneCountry);
            if (
              !initialCountry &&
              !requireBillingCountry &&
              !localStorage.getItem("tga-sirah-residence-v1") &&
              saved.billingEdited &&
              saved.billing in countries
            )
              setBilling(saved.billing);
            if (!initialPlan && ["MONTHLY", "ANNUAL"].includes(saved.plan))
              setPlan(saved.plan);
            if (saved.billingEdited) setBillingEdited(true);
          }
        } catch {}
        setUser(result.user);
        if (result.user) {
          setName(result.user.fullName);
          setEmail(result.user.email);
          if (!restoredPhone && result.user.phoneNumber) {
            const value = result.user.phoneNumber.trim();
            setPhone(value);
            const parsed = parsePhoneNumberFromString(
              value.startsWith("+")
                ? value
                : `${result.user.phoneCountryCode}${value}`,
            );
            if (parsed?.country) setPhoneCountry(parsed.country);
          }
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
  const processingOrderId =
    order?.paymentState === "PROCESSING" &&
    ["STRIPE", "PAYPAL"].includes(order.method || "")
      ? order.id
      : null;
  useEffect(() => {
    if (!processingOrderId) return;
    let active = true;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout>;
    const id = processingOrderId;
    async function recheck() {
      attempts++;
      try {
        const result = await api(`/api/sirah/orders/${id}/verify`, {
          method: "POST",
          body: "{}",
        });
        if (!active) return;
        setOrder(result.order);
        if (result.order.paymentState !== "PROCESSING") return;
      } catch {
        /* Leave the manual check available if a provider is delayed. */
      }
      if (active && attempts < 5) timer = setTimeout(recheck, 5000);
    }
    timer = setTimeout(recheck, 1500);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [processingOrderId]);
  async function run(work: () => Promise<void>) {
    if (submitLock.current) return;
    submitLock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await work();
    } catch (cause) {
      if (cause instanceof ApiError && cause.fields && !order) {
        setFields(cause.fields);
        setError("");
      } else
        setError(
          cause instanceof Error
            ? `${cause.message}${cause instanceof ApiError && cause.fields ? ` ${Object.values(cause.fields).flat().join(" ")}` : ""}`
            : "Please try again.",
        );
    } finally {
      submitLock.current = false;
      setBusy(false);
    }
  }
  function choosePhoneCountry(code: CountryCode) {
    setPhoneCountry(code);
    setBilling(code);
    setBillingEdited(true);
    setResidenceConfirmed(false);
    saveResidence(code);
    clearField("countryCode");
    setPhoneError("");
    clearField("phone");
  }
  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!residenceConfirmed) {
      setFields({
        countryCode: ["Please confirm your current country of residence."],
      });
      return;
    }
    saveResidence(billing);
    const data = new FormData(event.currentTarget);
    requestKey.current ||= crypto.randomUUID();
    const input = {
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
    };
    const parsed = sirahRegistrationSchema.safeParse(input);
    if (!parsed.success) {
      const next = parsed.error.flatten().fieldErrors;
      setFields(next);
      setPhoneError("");
      const first = event.currentTarget.querySelector<HTMLElement>(
        `[name="${Object.keys(next)[0]}"]`,
      );
      first?.focus();
      return;
    }
    setFields({});
    setPhoneError("");
    await run(async () => {
      const result = await api("/api/sirah/orders", {
        method: "POST",
        body: JSON.stringify(parsed.data),
      });
      try {
        sessionStorage.removeItem(draftKey);
      } catch {}
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
      saveResidence(countryCode);
      setAccepted(false);
      setManualConfirmed(false);
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
      setManualConfirmed(false);
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
    if (!order || !manualConfirmed) return;
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
      <h2>Sīrah | Beyond Chronology</h2>
      <p className={styles.introduction}>
        Create your account and choose your payment plan.
      </p>
      {ready && !user && (
        <p className={styles.signIn}>
          Already have an account?{" "}
          <a
            href={`/login?next=${encodeURIComponent(`/seerah/register?country=${billing}&plan=${plan}`)}`}
          >
            Sign in
          </a>
        </p>
      )}
      {ready && user && (
        <p className={styles.signIn}>Signed in as {user.email}</p>
      )}
      {!ready ? (
        <p role="status">Loading registration…</p>
      ) : !available ? (
        <div className={styles.notice} role="status">
          <p>
            Registration setup is being completed. You can enquire with the team
            while registration is unavailable.
          </p>
          <ConsultationAction
            className={styles.primary}
            placement="registration-unavailable"
            countryOverride={billing || undefined}
          />
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
          <form
            onSubmit={register}
            noValidate
            className={`${styles.form} ${styles.compactForm}`}
            aria-busy={busy}
          >
            <label>
              Full name
              <input
                name="fullName"
                aria-label="Full name"
                value={name}
                readOnly={!!user}
                onChange={(event) => {
                  setName(event.target.value);
                  clearField("fullName");
                }}
                autoComplete="name"
                minLength={2}
                maxLength={120}
                required
                aria-invalid={!!fieldError("fullName")}
                aria-describedby={
                  fieldError("fullName") ? "sirah-error-fullName" : undefined
                }
              />
              {errorText("fullName")}
            </label>
            <label>
              Email
              <input
                name="email"
                aria-label="Email"
                type="email"
                value={email}
                readOnly={!!user}
                onChange={(event) => {
                  setEmail(event.target.value);
                  clearField("email");
                }}
                autoComplete="email"
                required
                aria-invalid={!!fieldError("email")}
                aria-describedby={
                  fieldError("email") ? "sirah-error-email" : undefined
                }
              />
              {errorText("email")}
            </label>
            {!user && (
              <PasswordFields
                errors={fields}
                onEdit={clearField}
                onPassword={setPasswordForManager}
              />
            )}
            <PhoneControl
              country={phoneCountry}
              value={phone}
              onCountryChange={choosePhoneCountry}
              onChange={(value) => {
                setPhone(value);
                setPhoneError("");
                clearField("phone");
              }}
              error={
                phoneError || fieldError("phone") || fieldError("phoneCountry")
              }
            />
            <label>
              Country of residence
              <span className={styles.residenceControl}>
                {billing && (
                  <Image
                    src={countryFlagImage(billing)}
                    width={24}
                    height={18}
                    alt=""
                    unoptimized
                  />
                )}
                <select
                  name="countryCode"
                  autoComplete="country"
                  aria-label="Country of residence"
                  required
                  value={billing}
                  onChange={(event) => {
                    setBilling(event.target.value);
                    saveResidence(event.target.value);
                    setResidenceConfirmed(false);
                    setBillingEdited(true);
                    clearField("countryCode");
                  }}
                  aria-invalid={!!fieldError("countryCode")}
                  aria-describedby={
                    fieldError("countryCode")
                      ? "sirah-error-countryCode"
                      : undefined
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
              </span>
              {errorText("countryCode")}
            </label>
            <label className={styles.residenceConfirmation}>
              <span>
                <input
                  type="checkbox"
                  checked={residenceConfirmed}
                  onChange={(event) =>
                    setResidenceConfirmed(event.target.checked)
                  }
                  required
                />{" "}
                I confirm that{" "}
                {billing && countries[billing as keyof typeof countries]?.name}{" "}
                is my current country of residence.
              </span>
            </label>
            <div className={styles.planChoice}>
              <label>
                Payment plan
                <select
                  name="plan"
                  aria-label="Payment plan"
                  value={plan}
                  onChange={(event) => {
                    setPlan(event.target.value as SirahPlan);
                    clearField("plan");
                  }}
                >
                  <option value="MONTHLY">Monthly payment</option>
                  <option value="ANNUAL">Annual upfront · 12 months</option>
                </select>
                {errorText("plan")}
              </label>
              <div
                className={styles.pricePreview}
                role="status"
                aria-live="polite"
              >
                {billing && plan === "ANNUAL" && (
                  <>
                    <s>
                      {formatSirahMoney(
                        priceFor(billing, "MONTHLY", "STRIPE").amountMinor * 12,
                        priceFor(billing, "ANNUAL", null).currency,
                      )}
                    </s>
                  </>
                )}
                {quote?.country === billing && quote.plan === plan ? (
                  <>
                    <strong>
                      {formatSirahMoney(quote.amountMinor, quote.currency)}
                    </strong>
                    <span>Charge currency: {quote.currency}</span>
                    <span>
                      {plan === "ANNUAL"
                        ? "One payment · 12 months"
                        : billing === "PK"
                          ? quote.cardAvailable
                            ? "Per month · automatic card"
                            : "Per month · manual payment"
                          : "Per month"}
                    </span>
                  </>
                ) : (
                  <span>
                    {quoteError ||
                      (billing
                        ? `${formatSirahMoney(priceFor(billing, plan, billing === "PK" ? "BANK_TRANSFER" : null).amountMinor, priceFor(billing, plan, null).currency)} · confirming fee…`
                        : "Choose your billing country")}
                  </span>
                )}
              </div>
            </div>
            <div className={styles.planNotes} aria-live="polite">
              {billing && plan === "ANNUAL" && (
                <p>
                  Save approximately 10% compared with 12 online monthly
                  payments. One payment covers the full 12 months.
                </p>
              )}
              {quote?.country === billing && quote.plan === plan && (
                <>
                  {plan === "MONTHLY" && (
                    <p>
                      {formatSirahMoney(quote.totalMinor, quote.currency)}{" "}
                      across 12 months.
                    </p>
                  )}
                  {!quote.cardAvailable && (
                    <p>
                      Card payments are currently unavailable for this
                      selection.
                    </p>
                  )}
                </>
              )}
            </div>
            <div className={styles.cardIntroduction}>
              <strong>Pay by debit or credit card</strong>
              <small>No Stripe account needed.</small>
            </div>
            <button
              className={`${styles.primary} ${styles.submitRegistration}`}
              type="submit"
              disabled={busy || !ready}
            >
              {busy
                ? "Creating your registration…"
                : user
                  ? "Continue registration"
                  : "Create account & continue"}
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
          {order.paymentState === "PROCESSING" && (
            <p role="status">
              Confirming your payment with the provider. This page will recheck
              safely; you can also check the verified payment status below.
            </p>
          )}
          {passwordForManager && (
            <div className={styles.notice}>
              <p>
                Your account is created. Use your browser’s password manager to
                keep your login for course access.
              </p>
              <button
                type="button"
                onClick={async () => {
                  const PasswordCredential = (
                    window as unknown as {
                      PasswordCredential?: new (data: {
                        id: string;
                        password: string;
                        name: string;
                      }) => Credential;
                    }
                  ).PasswordCredential;
                  if (!PasswordCredential || !navigator.credentials) {
                    setMessage(
                      "Your browser controls password saving. Use its password manager to save the login you created.",
                    );
                    return;
                  }
                  try {
                    await navigator.credentials.store(
                      new PasswordCredential({
                        id: email,
                        password: passwordForManager,
                        name,
                      }),
                    );
                    setMessage(
                      "Your login was offered to your browser’s password manager.",
                    );
                  } catch {
                    setMessage(
                      "Use your browser’s password manager to save your login.",
                    );
                  }
                }}
              >
                Save login securely
              </button>
            </div>
          )}
          {invitation &&
            order.paymentState === "PAID" &&
            ["ACTIVE", "COMPLETED"].includes(order.enrolmentState) && (
              <div className={styles.notice} role="status">
                <h3>Payment confirmed.</h3>
                <p>{invitation.message}</p>
                {invitation.groupUrl && (
                  <a
                    className={styles.primary}
                    href={invitation.groupUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Join the Course Group
                  </a>
                )}
                {!invitation.groupUrl && invitation.contactUrl && (
                  <a
                    href={invitation.contactUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Contact the course team ↗
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
                    aria-describedby={
                      order.countryCode === "PK" && order.plan === "MONTHLY"
                        ? "sirah-pk-method-pricing"
                        : undefined
                    }
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
                          ? "Pay by bank transfer · Meezan Bank"
                          : method === "JAZZCASH"
                            ? "JazzCash"
                            : method === "STRIPE"
                              ? "Pay by debit or credit card"
                              : "PayPal"}
                      </option>
                    ))}
                  </select>
                </label>
                {order.countryCode === "PK" && order.plan === "MONTHLY" && (
                  <p className={styles.notice} id="sirah-pk-method-pricing">
                    Automatic card payments are PKR 3,000 per month. Manual bank
                    transfer or JazzCash payments are PKR 3,500 per month. Your
                    amount updates when you select a payment method.
                  </p>
                )}
                {order.method === "STRIPE" && <p>No Stripe account needed.</p>}
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
                        {order.countryCode === "PK" &&
                          order.plan === "MONTHLY" && (
                            <p>
                              Manual payments are PKR 3,500 per month. The PKR
                              3,000 rate applies to automatic card payments.
                            </p>
                          )}
                        <label className={styles.residenceConfirmation}>
                          <span>
                            <input
                              type="checkbox"
                              checked={manualConfirmed}
                              onChange={(event) =>
                                setManualConfirmed(event.target.checked)
                              }
                            />{" "}
                            I confirm the manual payment amount of{" "}
                            {formatSirahMoney(
                              order.amountMinor,
                              order.currency,
                            )}
                            {order.plan === "MONTHLY"
                              ? " per month"
                              : " for 12 months"}
                            .
                          </span>
                        </label>
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
                          reference in the payment remarks. After paying, upload
                          your receipt here or send it to 03262055614 on
                          WhatsApp. Include your full name, registered email and
                          registration reference. We’ll confirm your enrolment
                          after reviewing your payment.
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
                          disabled={busy || !accepted || !manualConfirmed}
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
