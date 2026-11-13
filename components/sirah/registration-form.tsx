"use client";
import { prepareSirahReceipt } from "@/lib/sirah/receipt-upload";
import { PersonalDiscount, personalDiscountAvailable } from "./personal-discount";
import {
  sirahAccessConsentsComplete,
  type SirahAccessConsents,
} from "@/lib/sirah/access-consent";
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
  minorToDecimal,
  type SirahPlan,
  type SirahMethod,
} from "@/lib/sirah/catalog";
import { sirahRegistrationSchema } from "@/lib/sirah/validation";
import { ConsultationAction } from "@/components/seerah/consultation-action";
import { PasswordFields } from "./password-fields";
import { AnnualPriceSummary } from "./annual-price-summary";
import { PaymentMethods } from "./payment-methods";
import { ManualPaymentFields } from "./manual-payment-fields";
import { sirahManualSenderSchema } from "@/lib/sirah/registration-payment";
import { priceFor } from "@/lib/sirah/catalog";
import { PhoneControl } from "./phone-control";
export type RegistrationControls = {
  setPreferences: (choice: {
    country?: string;
    plan?: SirahPlan;
    requireBillingCountry?: boolean;
  }) => void;
};
const methodLabel = (method: SirahMethod) =>
  ({
    STRIPE: "Pay by debit/credit card, Google Pay or Apple Pay",
    PAYPAL: "Pay with PayPal",
    BANK_TRANSFER: "Pay by bank transfer",
    JAZZCASH: "Pay with JazzCash",
  })[method];
// Presentment currencies Stripe's PayPal payment method supports. The PayPal
// hint must not appear for currencies it cannot charge in (e.g. PKR, INR).
const STRIPE_PAYPAL_CURRENCIES = new Set([
  "AUD", "CAD", "CHF", "CZK", "DKK", "EUR", "GBP",
  "HKD", "NOK", "NZD", "PLN", "SEK", "SGD", "USD",
]);
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
  accessConsents,
  onAccessConsentChange,
}: {
  order: Pick<Order, "terms" | "plan">;
  accepted: boolean;
  onChange: (v: boolean) => void;
  accessConsents: SirahAccessConsents;
  onAccessConsentChange: (v: SirahAccessConsents) => void;
}) {
  return order.terms ? (
    <div className={styles.terms}>
      <details className={styles.paymentTermsDetails}>
        <summary>Payment, cancellation &amp; access terms</summary>
        {["commitment", "cancellation", "refund", "access", "tax"].map(
          (key) => (
            <p key={key}>
              <strong>{key[0].toUpperCase() + key.slice(1)}: </strong>
              {order.terms![key as keyof typeof order.terms]}
            </p>
          ),
        )}
        {order.plan === "MONTHLY" && (
          <p>
            Monthly payments are voluntary renewals, not an obligation to make
            twelve payments. The programme has a maximum of twelve monthly
            billing cycles. Cancel future renewals from this saved registration
            using “Cancel future payments”. Cancellation does not automatically
            refund completed monthly periods; statutory rights still apply.
            {order.terms.cancellationTiming === "PERIOD_END" &&
              " Your verified current paid period remains accessible until its scheduled expiry."}
          </p>
        )}
        <small>Terms version {order.terms.version}.</small>
      </details>
      {order.terms.earlyServiceRequestText && (
        <label className={styles.check}>
          <input
            type="checkbox"
            id="sirah-consent-early-service"
            checked={accessConsents.earlyServiceRequested === true}
            onChange={(event) =>
              onAccessConsentChange({
                ...accessConsents,
                earlyServiceRequested: event.target.checked,
              })
            }
          />
          {order.terms.earlyServiceRequestText}
        </label>
      )}
      {order.terms.digitalContentConsentText && (
        <label className={styles.check}>
          <input
            type="checkbox"
            id="sirah-consent-digital-content"
            checked={accessConsents.digitalContentConsented === true}
            onChange={(event) =>
              onAccessConsentChange({
                ...accessConsents,
                digitalContentConsented: event.target.checked,
              })
            }
          />
          {order.terms.digitalContentConsentText}
        </label>
      )}
      {(order.terms.earlyServiceRequestText ||
        order.terms.digitalContentConsentText) && (
        <small>
          Contact TGA before paying if you need a later start. Your statutory
          rights and course-start refund protection are unchanged.
        </small>
      )}
      <label className={styles.check}>
        <input
          type="checkbox"
          id="sirah-accept-terms"
          checked={accepted}
          onChange={(event) => onChange(event.target.checked)}
        />
        I have read and agree to the payment and access terms.
      </label>
    </div>
  ) : (
    <p className={styles.notice}>
      Payment is not available for this selection. Contact TGA before
      registering.
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
  const [residenceOverride, setResidenceOverride] = useState(
    !getCountries().includes(
      (initialCountry && initialCountry in countries
        ? initialCountry
        : suggestedResidence) as CountryCode,
    ),
  );
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
  const [couponCode, setCouponCode] = useState("");
  const [discountAttempt, setDiscountAttempt] = useState(0);
  const pricingEmail = couponCode ? email.trim().toLowerCase() : "";

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
    email: string;
    couponCode: string;
    discount: { label: string; originalAmountMinor: number; amountMinor: number } | null;
    method: SirahMethod | "";
    plan: SirahPlan;
    currency: string;
    amountMinor: number;
    totalMinor: number;
    cardAvailable: boolean;
    methods: SirahMethod[];
    terms: Order["terms"];
    manualAccounts: Order["manualAccounts"];
    cohort: Order["cohort"];
  } | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<SirahMethod | "">("");
  const [resumeProblem, setResumeProblem] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const [plan, setPlan] = useState<SirahPlan>(initialPlan || "MONTHLY");
  useEffect(() => { setCouponCode(""); }, [email, billing, plan, selectedMethod]);
  const [available, setAvailable] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [accessConsents, setAccessConsents] = useState<SirahAccessConsents>({});
  useEffect(() => {
    setAccessConsents({});
    setManualConfirmed(false);
  }, [order?.id, order?.terms?.version, billing, plan, selectedMethod]);
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
        if (choice.requireBillingCountry && !choice.country) {
          // "Overseas": no assumed country. Open asking the visitor to choose
          // their billing country; show no Pakistan/PKR defaults.
          setBilling("");
          setResidenceOverride(true);
          setBillingEdited(true);
          setResidenceConfirmed(false);
          setAccepted(false);
        } else if (choice.country) {
          setBilling(choice.country in countries ? choice.country : "");
          if (getCountries().includes(choice.country as CountryCode)) {
            setPhoneCountry(choice.country as CountryCode);
            setResidenceOverride(false);
          } else setResidenceOverride(true);
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
    if (!billingEdited && !initialCountry && !requireBillingCountry && !order) {
      if (getCountries().includes(suggestedResidence as CountryCode)) {
        setPhoneCountry(suggestedResidence as CountryCode);
      } else {
        setBilling(suggestedResidence);
        setResidenceOverride(true);
      }
    }
  }, [
    suggestedResidence,
    billingEdited,
    initialCountry,
    requireBillingCountry,
    order,
  ]);
  useEffect(() => {
    if (!order && !residenceOverride) {
      setBilling(phoneCountry in countries ? phoneCountry : "");
    }
  }, [phoneCountry, residenceOverride, order]);
  useEffect(() => {
    // A late location suggestion must never inherit confirmation of another residence.
    setResidenceConfirmed(false);
    setAccepted(false);
  }, [billing]);
  useEffect(() => {
    if (!ready || order || !billing || !(billing in countries)) return;
    const controller = new AbortController();
    setQuote(null);
    void api("/api/pricing", {
      method: "POST",
      signal: controller.signal,
      body: JSON.stringify({
        courseSlug: "seerah-course",
        countryCode: billing,
        plan,
        method: selectedMethod || null,
        ...(couponCode ? { email: pricingEmail, couponCode } : {}),
      }),
    })
      .then((result) => {
        if (!controller.signal.aborted) {
          setQuoteError("");
          if (!selectedMethod || !result.methods?.includes(selectedMethod)) {
            setSelectedMethod(
              result.methods?.includes("STRIPE")
                ? "STRIPE"
                : result.methods?.[0] || "",
            );
          }
          setQuote({
            country: billing,
            email: pricingEmail,
            couponCode,
            discount: result.pricing.discount || null,
            method: selectedMethod,
            plan,
            currency: result.pricing.currency,
            amountMinor: result.pricing.amountMinor,
            totalMinor: result.pricing.totalMinor,
            cardAvailable: Boolean(result.cardAvailable),
            methods: result.methods || [],
            cohort: result.cohort,
            terms: result.terms,
            manualAccounts: result.manualAccounts || [],
          });
        }
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setQuoteError(cause.message);
      });
    return () => controller.abort();
  }, [ready, order, billing, plan, selectedMethod, pricingEmail, couponCode, discountAttempt]);
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
          residenceOverride,
          selectedMethod,
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
    residenceOverride,
    selectedMethod,
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
            if (!initialCountry && getCountries().includes(saved.phoneCountry))
              setPhoneCountry(saved.phoneCountry);
            if (
              !initialCountry &&
              saved.residenceOverride &&
              saved.billing in countries
            ) {
              setResidenceOverride(true);
              setBilling(saved.billing);
            }
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
            if (
              ["STRIPE", "PAYPAL", "BANK_TRANSFER", "JAZZCASH"].includes(
                saved.selectedMethod,
              )
            )
              setSelectedMethod(saved.selectedMethod);
            if (saved.billingEdited) setBillingEdited(true);
          }
        } catch {}
        const fragment = new URLSearchParams(window.location.hash.slice(1));
        const paymentToken = fragment.get("payment");
        if (paymentToken) {
          // Remove bearer link before any subsequent navigation or analytics.
          window.history.replaceState(
            null,
            "",
            window.location.pathname + window.location.search,
          );
          try {
            const resumed = await api("/api/sirah/payment-resume", {
              method: "POST",
              body: JSON.stringify({ token: paymentToken }),
            });
            if (!active) return;
            setUser(resumed.user);
            setName(resumed.user.fullName);
            setEmail(resumed.user.email);
            setOrder(resumed.order);
            const url = new URL(window.location.href);
            url.searchParams.set("order", resumed.order.id);
            window.history.replaceState(null, "", url);
          } catch (cause) {
            if (active) {
              setResumeProblem(true);
              setError(
                cause instanceof Error
                  ? cause.message
                  : "Request a fresh payment link.",
              );
            }
          }
          return;
        }
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
        const id =
          new URL(window.location.href).searchParams.get("order") ||
          result.resumeOrderId;
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
  useEffect(() => {
    if (!order) return;
    setName(order.fullName);
    setEmail(order.email);
    const parsed = parsePhoneNumberFromString(order.phoneE164);
    setPhoneCountry(order.phoneCountry as CountryCode);
    setPhone(parsed?.nationalNumber || order.phoneE164);
    // Restore the saved record once, without overwriting in-progress edits on status polling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id]);
  const selectedRouteAvailable = Boolean(
    order?.method && order.methods.includes(order.method as SirahMethod),
  );
  // Changing payment method clears the student's confirmations; remember that
  // so the checklist can say they must be ticked again.
  const [methodSwitched, setMethodSwitched] = useState(false);
  // What still blocks a saved-booking receipt submission, in page order.
  const evidenceMissing = order
    ? [
        !accepted && {
          id: "sirah-accept-terms",
          label: "Agree to the payment and access terms (“I have read and agree…”)",
        },
        order.terms?.earlyServiceRequestText &&
          accessConsents.earlyServiceRequested !== true && {
            id: "sirah-consent-early-service",
            label: "Request that teaching can start now (“I expressly request teaching…”)",
          },
        order.terms?.digitalContentConsentText &&
          accessConsents.digitalContentConsented !== true && {
            id: "sirah-consent-digital-content",
            label: "Consent to immediate recording access (“I expressly consent…”)",
          },
        !manualConfirmed && {
          id: "sirah-confirm-manual-amount",
          label: `Confirm the payment amount of ${formatSirahMoney(order.amountMinor, order.currency)}`,
        },
      ].filter((item): item is { id: string; label: string } => Boolean(item))
    : [];
  function focusField(id: string) {
    const field = document.getElementById(id);
    field?.scrollIntoView({ block: "center", behavior: "smooth" });
    field?.focus({ preventScroll: true });
  }
  // True only when the provider's last check showed a genuinely in-flight
  // settlement; false (default) means checkout was started but not completed.
  const [settlementPending, setSettlementPending] = useState(false);
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
        setSettlementPending(Boolean(result.settlementPending));
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
    setAccepted(false);
    setResidenceConfirmed(false);
    setBillingEdited(true);
    if (!residenceOverride) {
      setBilling(code in countries ? code : "");
      saveResidence(code);
    }
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
    if (!selectedMethod) {
      setFields({ method: ["Choose an available payment method."] });
      return;
    }
    if (
      !quote?.terms ||
      quote.country !== billing ||
      quote.plan !== plan ||
      quote.method !== selectedMethod ||
      quote.couponCode !== couponCode ||
      (Boolean(couponCode) && quote.email !== email.trim().toLowerCase()) ||
      !accepted ||
      !sirahAccessConsentsComplete(quote.terms, accessConsents)
    ) {
      setError(
        "Review your selected fee and accept the required payment and access choices.",
      );
      return;
    }
    const manual = ["BANK_TRANSFER", "JAZZCASH"].includes(selectedMethod);
    if (manual && !manualConfirmed) {
      setError("Confirm the manual payment amount.");
      return;
    }
    saveResidence(billing);
    const data = new FormData(event.currentTarget);
    const manualResult = manual
      ? sirahManualSenderSchema.safeParse({
          payerName: data.get("payerName"),
          senderAccount: data.get("senderAccount"),
          transactionReference: data.get("transactionReference"),
          paymentDate: data.get("paymentDate"),
        })
      : null;
    if (manualResult && !manualResult.success) {
      setFields(manualResult.error.flatten().fieldErrors);
      return;
    }
    const receipt = data.get("receipt");
    if (manual && (!(receipt instanceof File) || !receipt.size)) {
      setFields({ receipt: ["Upload your payment receipt."] });
      return;
    }
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
      method: selectedMethod || null,
      ...(couponCode ? { couponCode } : {}),
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
      const details = {
        ...parsed.data,
        residenceConfirmed: true,
        acceptedTermsVersion: quote.terms!.version,
        ...accessConsents,
        ...(manualResult?.success
          ? { manualPayment: manualResult.data, manualAmountConfirmed: true }
          : {}),
      };
      let body: string | FormData = JSON.stringify(details);
      if (manual && receipt instanceof File) {
        const multipart = new FormData();
        multipart.set("details", JSON.stringify(details));
        multipart.set("receipt", await prepareSirahReceipt(receipt));
        body = multipart;
      }
      const result = await api("/api/sirah/orders", { method: "POST", body });
      try {
        sessionStorage.removeItem(draftKey);
      } catch {}
      setOrder(result.order);
      setUser(
        (current) =>
          current || {
            fullName: name,
            email,
            phoneCountryCode: `+${getCountryCallingCode(phoneCountry)}`,
            phoneNumber: phone,
          },
      );
      setMessage(result.message);
      const url = new URL(window.location.href);
      if (url.pathname === "/seerah/register") {
        url.searchParams.set("order", result.order.id);
        window.history.replaceState(null, "", url);
      }
      const sameAgreement = Boolean(
        quote &&
        quote.method === selectedMethod &&
        quote.country === result.order.countryCode &&
        quote.plan === result.order.plan &&
        quote.amountMinor === result.order.amountMinor &&
        quote.currency === result.order.currency &&
        quote.terms?.version === result.order.terms?.version,
      );
      if (!sameAgreement) setAccepted(false);
      if (
        accepted &&
        sameAgreement &&
        result.order.terms &&
        result.order.method === selectedMethod &&
        ["STRIPE", "PAYPAL"].includes(selectedMethod) &&
        ["UNPAID", "FAILED", "REJECTED"].includes(result.order.paymentState)
      ) {
        await openCheckout(result.order, result.order.terms.version);
      }
    });
  }
  async function reprice(
    countryCode: string,
    nextPlan: SirahPlan,
    method: SirahMethod | null,
    code?: string,
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
          ...(code ? { couponCode: code } : {}),
        }),
      });
      setOrder(result.order);
      saveResidence(countryCode);
      setAccepted(false);
      setManualConfirmed(false);
      if (method !== order.method) setMethodSwitched(true);
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
      setSettlementPending(Boolean(result.settlementPending));
      setMessage(
        result.order.paymentState === "PAID"
          ? "Payment verified. Your enrolment status is shown below."
          : result.settlementPending
            ? "We are confirming your payment, this updates automatically."
            : "Your payment is not completed yet. If you just paid it will update shortly. Otherwise you can retry or choose another method like JazzCash or Meezan.",
      );
    });
  }
  async function openCheckout(saved: Order, acceptedTermsVersion: string) {
    try {
      const result = await api(`/api/sirah/orders/${saved.id}/checkout`, {
        method: "POST",
        body: JSON.stringify({
          revision: saved.revision,
          acceptedTermsVersion,
          ...accessConsents,
        }),
      });
      if (!result.url) throw Error("No payment destination is available yet.");
      window.location.assign(result.url);
    } catch (cause) {
      // A lost response can still mean the provider created a checkout. Reconcile the
      // saved status before displaying another attempt; the server also locks retries.
      try {
        const current = await api(`/api/sirah/orders/${saved.id}`);
        setOrder(current.order);
      } catch {}
      throw cause;
    }
  }
  async function checkout() {
    if (
      !order ||
      !accepted ||
      !order.terms ||
      !sirahAccessConsentsComplete(order.terms, accessConsents)
    )
      return;
    await run(() => openCheckout(order, order.terms!.version));
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
  // One step from an unfinished card/PayPal checkout to a manual transfer. The
  // server first confirms with the provider that nothing was paid and closes
  // the checkout; the manual method is then selected on the reset revision.
  async function switchToManual(method: "BANK_TRANSFER" | "JAZZCASH") {
    if (!order) return;
    await run(async () => {
      const reset = await api(`/api/sirah/orders/${order.id}/reset-checkout`, {
        method: "POST",
        body: "{}",
      });
      try {
        const result = await api(`/api/sirah/orders/${order.id}/quote`, {
          method: "POST",
          body: JSON.stringify({
            revision: reset.order.revision,
            countryCode: reset.order.countryCode,
            plan: reset.order.plan,
            method,
          }),
        });
        setOrder(result.order);
      } catch (cause) {
        // The checkout is already closed; show that state so they can pick again.
        setOrder(reset.order);
        throw cause;
      }
      setAccepted(false);
      setManualConfirmed(false);
      setMethodSwitched(true);
      setMessage(
        `${methodLabel(method)} selected. Pay using the details below, then upload your receipt.`,
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
  async function resumeRenewals() {
    if (
      !order?.terms ||
      !window.confirm(
        `Resume future voluntary renewals of ${formatSirahMoney(order.amountMinor, order.currency)} per month on your existing PayPal subscription? This does not confirm payment or restore access.`,
      )
    )
      return;
    await run(async () => {
      const result = await api(`/api/sirah/orders/${order.id}/billing`, {
        method: "POST",
        body: JSON.stringify({
          action: "RESUME",
          revision: order.revision,
          acceptedTermsVersion: order.terms!.version,
        }),
      });
      setMessage(result.message);
    });
  }
  async function requestRefundReview() {
    if (!order) return;
    const reason = window.prompt(
      "Reason for requesting an upfront payment refund review:",
    );
    if (!reason) return;
    await run(async () => {
      const result = await api(`/api/sirah/orders/${order.id}/refund-request`, {
        method: "POST",
        body: JSON.stringify({ revision: order.revision, reason }),
      });
      setMessage(result.message);
    });
  }
  async function submitEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!order) return;
    if (
      evidenceMissing.length ||
      !sirahAccessConsentsComplete(order.terms, accessConsents)
    ) {
      feedbackScroll.current = false;
      setMessage("");
      setError(
        `Before submitting, please tick: ${evidenceMissing.map((item) => item.label).join("; ")}.`,
      );
      if (evidenceMissing[0]) focusField(evidenceMissing[0].id);
      return;
    }
    const data = new FormData(event.currentTarget);
    await run(async () => {
      const details = {
        revision: order.revision,
        method: order.method,
        route: "UPLOAD",
        payerName: data.get("payerName"),
        senderAccount: data.get("senderAccount"),
        transactionReference: data.get("transactionReference") || undefined,
        paymentDate: data.get("paymentDate") || undefined,
        amount: data.get("amount") || undefined,
        note: data.get("note") || undefined,
      };
      data.set("details", JSON.stringify(details));
      data.set("acceptedTermsVersion", order.terms?.version || "");
      data.set(
        "earlyServiceRequested",
        String(accessConsents.earlyServiceRequested === true),
      );
      data.set(
        "digitalContentConsented",
        String(accessConsents.digitalContentConsented === true),
      );
      const receipt = data.get("receipt");
      if (!(receipt instanceof File) || !receipt.size) throw new Error("Upload your payment receipt.");
      data.set("receipt", await prepareSirahReceipt(receipt));
      const result = await api(`/api/sirah/orders/${order.id}/evidence`, {
        method: "POST",
        body: data,
      });
      setMessage(result.message);
      const current = await api(`/api/sirah/orders/${order.id}`);
      setOrder(current.order);
    });
  }
  // Saved-booking view: one primary action, one secondary, the rest under
  // "More options". These only decide placement; the handlers are unchanged.
  const [showMethods, setShowMethods] = useState(false);
  useEffect(() => {
    setShowMethods(false);
  }, [order?.id, order?.method]);
  // An unfinished card/PayPal checkout that the existing checkout() can reopen.
  const checkoutResumable = Boolean(
    order?.paymentState === "PROCESSING" &&
      ["STRIPE", "PAYPAL"].includes(order.method || "") &&
      !settlementPending &&
      selectedRouteAvailable,
  );
  const manualAlternatives = (["JAZZCASH", "BANK_TRANSFER"] as const).filter(
    (method) => order?.methods.includes(method),
  );
  const renewalNeedsBilling = Boolean(
    order?.paymentState === "FAILED" && order.hasBillingProfile,
  );
  // Same checks checkout() already makes, but said out loud instead of a
  // silently disabled button.
  function completePayment() {
    if (!order) return;
    const missing = evidenceMissing.filter(
      (item) => item.id !== "sirah-confirm-manual-amount",
    );
    if (missing.length || !sirahAccessConsentsComplete(order.terms, accessConsents)) {
      feedbackScroll.current = false;
      setMessage("");
      setError(
        `Before paying, please tick: ${missing.map((item) => item.label).join("; ")}.`,
      );
      if (missing[0]) focusField(missing[0].id);
      return;
    }
    void checkout();
  }
  // Errors and confirmations sit next to the action that caused them, and an
  // error scrolls into view (unless focus was just moved to a checkbox).
  const feedbackRef = useRef<HTMLDivElement>(null);
  const feedbackScroll = useRef(true);
  useEffect(() => {
    if (error && feedbackScroll.current)
      feedbackRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    feedbackScroll.current = true;
  }, [error]);
  const feedback =
    error || message ? (
      <div ref={feedbackRef} className={styles.feedback}>
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
    ) : null;
  const freshLinkForm = (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        void run(async () => {
          const result = await api("/api/sirah/payment-resume/request", {
            method: "POST",
            body: JSON.stringify({ email: data.get("email") }),
          });
          setMessage(result.message);
        });
      }}
    >
      <label>
        Registration email
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={email}
        />
      </label>
      <button type="submit" disabled={busy}>
        Send a fresh link
      </button>
    </form>
  );
  return (
    <div className={styles.experience}>
      <p className={styles.eyebrow}>
        The Global Awakening · Course registration
      </p>
      <h2>Sīrah | Beyond Chronology</h2>
      <p className={styles.introduction}>
        Create your account and choose your payment plan.
      </p>
      {ready && (order?.cohort || quote?.cohort) && (
        <div className={styles.notice} role="status">
          <strong>First paid class: </strong>
          {(order?.cohort || quote?.cohort)?.commencementDate
            ? new Date(
                `${(order?.cohort || quote?.cohort)!.commencementDate}T12:00:00Z`,
              ).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              })
            : "Pending publication of the confirmed cohort date."}
          {order?.terms?.cohortCommencementDate &&
            order.terms.cohortCommencementDate !==
              order.cohort.commencementDate && (
              <p>
                This saved booking retains {order.terms.cohortCommencementDate}{" "}
                for its recorded refund protection. A schedule correction does
                not shorten that protection.
              </p>
            )}
          {(order?.cohort || quote?.cohort)?.confirmed ? (
            <p>
              Course-start full-refund protection through{" "}
              {(order?.cohort || quote?.cohort)!.courseStartFullRefundThrough}{" "}
              inclusive (Pakistan date). Statutory rights remain unchanged.
            </p>
          ) : (
            <p>
              The free orientation is separate. You can save a pending
              registration; payments requiring the teaching date remain closed
              until the confirmed schedule is available here.
            </p>
          )}
        </div>
      )}
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
            <p className={styles.notice} role="note">
              If you are not living in Pakistan, select your country of
              residence below so you are charged the correct fee for your
              region.
            </p>
            <div className={styles.phoneAndResidence}>
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
                  phoneError ||
                  fieldError("phone") ||
                  fieldError("phoneCountry")
                }
              />
              <div className={styles.residenceCompact}>
                <input type="hidden" name="countryCode" value={billing} />
                {(residenceOverride || !billing) && (
                  <label>
                    Country of residence
                    <select
                      aria-label="Country of residence"
                      autoComplete="country"
                      value={billing}
                      onChange={(event) => {
                        const value = event.target.value;
                        setBilling(value);
                        saveResidence(value);
                        // Keep the phone dialling code in step with the chosen
                        // country so it never lingers on a default (e.g. +92).
                        if (getCountries().includes(value as CountryCode))
                          setPhoneCountry(value as CountryCode);
                        setAccepted(false);
                        setResidenceConfirmed(false);
                        setResidenceOverride(true);
                        setBillingEdited(true);
                        clearField("countryCode");
                      }}
                      required
                    >
                      <option value="" disabled>
                        Choose your residence
                      </option>
                      {residenceCountries.map((c) => (
                        <option value={c.code} key={c.code}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className={styles.residenceConfirmation}>
                  <span>
                    <input
                      type="checkbox"
                      checked={residenceConfirmed}
                      required
                      aria-describedby={
                        fieldError("countryCode")
                          ? "sirah-error-countryCode"
                          : undefined
                      }
                      onChange={(event) => {
                        setResidenceConfirmed(event.target.checked);
                        clearField("countryCode");
                      }}
                    />
                    I confirm that{" "}
                    {(billing &&
                      countries[billing as keyof typeof countries]?.name) ||
                      "the selected country"}{" "}
                    is my current country of residence.
                  </span>
                </label>
                {errorText("countryCode")}
                <button
                  type="button"
                  className={styles.residenceChange}
                  onClick={() => {
                    setResidenceOverride(!residenceOverride);
                    setResidenceConfirmed(false);
                    setAccepted(false);
                    if (residenceOverride)
                      setBilling(phoneCountry in countries ? phoneCountry : "");
                  }}
                >
                  {residenceOverride
                    ? "Use my phone country"
                    : "I live in another country"}
                </button>
              </div>
            </div>
            <div className={styles.planChoice}>
              <label>
                Payment plan
                <select
                  name="plan"
                  aria-label="Payment plan"
                  value={plan}
                  onChange={(event) => {
                    setAccepted(false);
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
                {quote?.country === billing &&
                quote.plan === plan &&
                quote.method === selectedMethod ? (
                  <>
                    {plan === "ANNUAL" ? (
                      <AnnualPriceSummary
                        country={billing}
                        currency={quote.currency}
                        amountMinor={quote.amountMinor}
                      />
                    ) : (
                      <strong>
                        {formatSirahMoney(quote.amountMinor, quote.currency)}
                      </strong>
                    )}
                    <span>Charge currency: {quote.currency}</span>
                    {plan === "MONTHLY" && (
                      <span>
                        {billing === "PK"
                          ? selectedMethod === "BANK_TRANSFER" ||
                            selectedMethod === "JAZZCASH" ||
                            (!selectedMethod && !quote.cardAvailable)
                            ? "Per month · manual payment"
                            : "Per month · automatic card"
                          : "Per month"}
                      </span>
                    )}
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
            <div className={styles.paymentOptions}>
              {billing === "PK" && (
                <p className={styles.notice} role="note">
                  Paying from Pakistan? Card payments are often declined by
                  Pakistani banks on international transactions. For a smooth
                  payment we recommend JazzCash or Meezan Bank transfer.
                </p>
              )}
              <PaymentMethods
                methods={
                  quote?.country === billing && quote.plan === plan
                    ? quote.methods
                    : []
                }
                value={selectedMethod}
                disabled={
                  busy || quote?.country !== billing || quote?.plan !== plan
                }
                onChange={(method) => {
                  setSelectedMethod(method);
                  setAccepted(false);
                }}
              />
              {quote?.country === billing &&
                quote.plan === plan &&
                quote.methods.includes("STRIPE") &&
                !quote.methods.includes("PAYPAL") &&
                STRIPE_PAYPAL_CURRENCIES.has(quote.currency) && (
                  <p>
                    Prefer PayPal? Choose Card and you can pay with PayPal on
                    the payment page.
                  </p>
                )}
              {billing === "IN" &&
                quote?.country === billing &&
                quote.plan === plan &&
                quote.methods.includes("STRIPE") && (
                  <p>
                    Using an Indian card? Please switch on International and
                    Online payments in your bank app first, then pay by Card.
                  </p>
                )}
              <PersonalDiscount email={email} country={billing} plan={plan} method={selectedMethod} applied={Boolean(quote?.discount)} disabled={busy} onApply={code => { setCouponCode(code); setDiscountAttempt(value => value + 1); setAccepted(false); setManualConfirmed(false); }} />
              {selectedMethod === "STRIPE" && <p>No Stripe account needed. Wallets appear on eligible devices.</p>}
              {selectedMethod === "STRIPE" && (
                <p>
                  Because our card processor is based abroad, your bank may add
                  international transaction charges and government taxes to card
                  payments. These are not charged by TGA.
                </p>
              )}
              {billing === "PK" && plan === "MONTHLY" && selectedMethod && (
                <p>
                  Manual transfers require receipt verification.
                </p>
              )}
              {quote?.country === billing &&
                quote?.plan === plan &&
                !quote.methods.length && (
                  <p>
                    Registration cannot be submitted until an approved payment
                    method is available for this country and plan. Contact TGA
                    for help.
                  </p>
                )}
              {errorText("method")}
              {["BANK_TRANSFER", "JAZZCASH"].includes(selectedMethod) &&
                quote?.country === billing &&
                quote.plan === plan &&
                quote.method === selectedMethod && (
                  <div className={styles.manualPayment}>
                    {quote.manualAccounts
                      .filter((account) => account.method === selectedMethod)
                      .map((account) => (
                        <div className={styles.notice} key={account.method}>
                          <strong>{account.service}</strong>
                          <p>
                            Account holder: <strong>{account.holder}</strong>
                            <br />
                            Account number: <strong>{account.account}</strong>
                            {account.iban && (
                              <>
                                <br />
                                IBAN: <strong>{account.iban}</strong>
                              </>
                            )}
                          </p>
                          <p>
                            Transfer{" "}
                            {formatSirahMoney(
                              quote.amountMinor,
                              quote.currency,
                            )}
                            . Include SIRAH BEYOND CHRONOLOGY and your full name
                            in the payment remarks.
                          </p>
                        </div>
                      ))}
                    <ManualPaymentFields
                      payerName={name}
                      amount={minorToDecimal(quote.amountMinor, quote.currency)}
                      errors={fields}
                    />
                    <label className={styles.residenceConfirmation}>
                      <span>
                        <input
                          type="checkbox"
                          required
                          checked={manualConfirmed}
                          onChange={(event) =>
                            setManualConfirmed(event.target.checked)
                          }
                        />
                        I confirm the manual payment amount of{" "}
                        {formatSirahMoney(quote.amountMinor, quote.currency)}
                        {plan === "MONTHLY" ? " per month" : " upfront"}.
                      </span>
                    </label>
                  </div>
                )}
              {selectedMethod &&
                quote?.country === billing &&
                quote?.plan === plan && (
                  <Terms
                    order={{ terms: quote.terms, plan }}
                    accepted={accepted}
                    onChange={setAccepted}
                    accessConsents={accessConsents}
                    onAccessConsentChange={setAccessConsents}
                  />
                )}
            </div>
            <button
              className={`${styles.primary} ${styles.submitRegistration}`}
              type="submit"
              disabled={
                busy ||
                !ready ||
                !selectedMethod ||
                !residenceConfirmed ||
                !accepted ||
                !sirahAccessConsentsComplete(
                  quote?.terms || null,
                  accessConsents,
                ) ||
                quote?.country !== billing ||
                quote?.plan !== plan ||
                quote?.method !== selectedMethod ||
                quote?.couponCode !== couponCode ||
                (Boolean(couponCode) && quote?.email !== email.trim().toLowerCase()) ||
                Boolean(quoteError) ||
                (["BANK_TRANSFER", "JAZZCASH"].includes(selectedMethod) &&
                  !manualConfirmed)
              }
            >
              {busy
                ? "Submitting registration & payment…"
                : !selectedMethod
                  ? "Choose an available payment method"
                  : ["STRIPE", "PAYPAL"].includes(selectedMethod)
                    ? "Continue to secure payment"
                    : "Submit registration & transfer receipt"}
            </button>
          </form>
          {feedback}
        </>
      ) : (
        <section aria-label="Your course registration">
          <p>
            <strong>
              {order.paymentState === "AWAITING_REVIEW"
                ? "Transfer submitted for verification"
                : ["UNPAID", "PROCESSING", "FAILED", "REJECTED"].includes(
                      order.paymentState,
                    ) && ["PENDING", "ACTIVE"].includes(order.enrolmentState)
                  ? "Payment required"
                  : "Your registration"}{" "}
              · {order.reference}
            </strong>
          </p>
          <div className={styles.status}>
            <p>
              Payment:{" "}
              <strong>
                {["UNPAID", "PROCESSING"].includes(order.paymentState)
                  ? "Payment pending"
                  : order.paymentState === "AWAITING_REVIEW"
                    ? "Awaiting bank transfer verification"
                    : order.paymentState.replaceAll("_", " ")}
              </strong>
            </p>
            <p>
              Enrolment: <strong>{order.enrolmentState}</strong>
            </p>
          </div>
          {order.paymentState === "PROCESSING" &&
            (settlementPending ? (
              <p role="status">
                We are confirming your payment, this updates automatically.
              </p>
            ) : (
              <p role="status">
                Your payment is not completed yet. If you just paid it will
                update shortly.{" "}
                {order.methods.some((method) =>
                  ["JAZZCASH", "BANK_TRANSFER"].includes(method),
                )
                  ? "Otherwise complete the payment below, or switch to JazzCash or Meezan bank transfer and upload your receipt."
                  : "Otherwise complete the payment below, or change payment method."}
              </p>
            ))}
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
          <div className={styles.summary}>
            {order.nextBillingAt && <p>Next renewal: {new Date(order.nextBillingAt).toLocaleDateString()}.</p>}
            {order.programmeEnd && (
              <p>
                Programme access end:{" "}
                {new Date(order.programmeEnd).toLocaleDateString()}.
              </p>
            )}
            {order.plan === "ANNUAL" ? (
              <AnnualPriceSummary
                country={order.countryCode}
                currency={order.currency}
                amountMinor={order.amountMinor}
              />
            ) : (
              <h3>
                {formatSirahMoney(order.amountMinor, order.currency)}{" "}
                <small>per month</small>
              </h3>
            )}
            <p>
              Charge currency: {order.currency}.{" "}
              {order.marketCode === "OTHER"
                ? "Your bank’s local conversion may vary."
                : order.discount ? "Personal discount applied." : "Fixed regional fee."}
            </p>
            {order.plan === "MONTHLY" && (
              <p>
                12-payment comparison:{" "}
                {formatSirahMoney(order.totalMinor, order.currency)}. Renewals are voluntary.
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
          {order.paymentState === "REJECTED" && order.manualEvidenceAllowed && (
            <p className={styles.notice} role="status">
              Your previous payment evidence was not accepted. Check TGA’s
              review email for details, then submit a corrected or clearer
              receipt below, or contact payment support. Your earlier receipts
              remain on this registration.
            </p>
          )}
          {order.paymentState === "AWAITING_REVIEW" && (
            <p className={styles.notice}>
              Awaiting bank transfer verification. TGA will check your transfer
              details and confirm enrolment after receipt is verified.
            </p>
          )}
          {order.paymentState === "FAILED" && order.hasBillingProfile && (
            <p className={styles.notice} role="status">
              Update payment details for your existing subscription below. Do
              not start another subscription. Access is restored after verified
              payment.
              {order.accessEndsAt &&
                ` Current access or grace expires on ${new Date(order.accessEndsAt).toLocaleDateString()}.`}
            </p>
          )}
          {order.cancelledAt && order.accessEndsAt && (
            <p className={styles.notice} role="status">
              Future payments are cancelled. Current paid access ends on{" "}
              {new Date(order.accessEndsAt).toLocaleDateString()}.
            </p>
          )}
          {["PROCESSING", "REFUND_PENDING"].includes(order.paymentState) && (
            <div className={styles.nextStep}>
              {checkoutResumable ? (
                <>
                  <Terms
                    order={order}
                    accepted={accepted}
                    onChange={setAccepted}
                    accessConsents={accessConsents}
                    onAccessConsentChange={setAccessConsents}
                  />
                  <button
                    type="button"
                    className={styles.primary}
                    disabled={busy}
                    onClick={completePayment}
                  >
                    Complete payment
                  </button>
                  {manualAlternatives.length > 0 ? (
                    <div className={styles.secondaryActions}>
                      <p>Card payment didn’t go through? Pay by transfer instead and upload your receipt here:</p>
                      {manualAlternatives.map((method) => (
                        <button
                          key={method}
                          type="button"
                          disabled={busy}
                          onClick={() => void switchToManual(method)}
                        >
                          {method === "JAZZCASH"
                            ? "Pay with JazzCash instead"
                            : "Pay by Meezan Bank transfer instead"}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.secondaryActions}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void resetCheckout()}
                      >
                        Change payment method
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  className={styles.primary}
                  disabled={busy}
                  onClick={() => void checkPayment()}
                >
                  Check payment status
                </button>
              )}
            </div>
          )}
          {["UNPAID", "REJECTED", "FAILED"].includes(order.paymentState) &&
            ["PENDING", "ACTIVE"].includes(order.enrolmentState) && (
              <div className={styles.nextStep}>
                {renewalNeedsBilling ? (
                  <button
                    type="button"
                    className={styles.primary}
                    disabled={busy}
                    onClick={() => void manageBilling()}
                  >
                    Update payment details
                  </button>
                ) : (
                  <>
                    {(!order.method || showMethods) && (
                      <>
                        {order.countryCode === "PK" && (
                          <p className={styles.notice} role="note">
                            Paying from Pakistan? Card payments are often declined by
                            Pakistani banks on international transactions. For a smooth
                            payment we recommend JazzCash or Meezan Bank transfer.
                          </p>
                        )}
                        <PaymentMethods
                          methods={order.methods as SirahMethod[]}
                          value={(order.method || "") as SirahMethod | ""}
                          disabled={busy}
                          describedBy={
                            order.countryCode === "PK" && order.plan === "MONTHLY"
                              ? "sirah-pk-method-pricing"
                              : undefined
                          }
                          onChange={(method) =>
                            void reprice(
                              order.countryCode,
                              order.plan as SirahPlan,
                              method,
                            )
                          }
                        />
                      </>
                    )}
                    {order.countryCode === "IN" &&
                      order.methods.includes("STRIPE") && (
                        <p>
                          Using an Indian card? Please switch on International and
                          Online payments in your bank app first, then pay by Card.
                        </p>
                      )}
                    {order.manualEvidenceAllowed &&
                      !selectedRouteAvailable &&
                      order.method && (
                        <p>
                          {methodLabel(order.method as SirahMethod)} · saved
                          instructions only
                        </p>
                      )}
                    {order.countryCode === "PK" && order.plan === "MONTHLY" && (
                      <p className={styles.notice} id="sirah-pk-method-pricing">
                        Your selected fee is shown above. Manual transfers require receipt verification.
                      </p>
                    )}
                    {order.method === "STRIPE" && <p>No Stripe account needed. Wallets appear on eligible devices.</p>}
                    {order.method === "STRIPE" && (
                      <p>
                        Because our card processor is based abroad, your bank may
                        add international transaction charges and government taxes
                        to card payments. These are not charged by TGA.
                      </p>
                    )}
                    {personalDiscountAvailable(
                      order.countryCode,
                      order.plan,
                      order.method || "",
                    ) && (
                      <details
                        className={styles.discountToggle}
                        open={Boolean(order.discount) || undefined}
                      >
                        <summary>
                          {order.discount
                            ? "Discount code applied"
                            : "Have a discount code?"}
                        </summary>
                        <PersonalDiscount email={order.email} country={order.countryCode} plan={order.plan} method={order.method || ""} applied={Boolean(order.discount)} disabled={busy} onApply={code => { void reprice(order.countryCode, order.plan as SirahPlan, order.method as SirahMethod, code); }} />
                      </details>
                    )}
                    {(selectedRouteAvailable || order.manualEvidenceAllowed) && (
                      <Terms
                        order={order}
                        accepted={accepted}
                        onChange={setAccepted}
                        accessConsents={accessConsents}
                        onAccessConsentChange={setAccessConsents}
                      />
                    )}
                    {order.manualEvidenceAllowed && !selectedRouteAvailable && (
                      <p className={styles.notice} role="status">
                        This method is closed to new payments. If you already
                        transferred using the instructions issued for this
                        registration, accept your saved terms and submit your
                        receipt below. Do not make another transfer; contact TGA if
                        you need help.
                      </p>
                    )}
                    {!order.methods.length && !order.manualEvidenceAllowed && (
                      <p className={styles.notice}>
                        Your registration is saved. Payment is pending until an
                        approved method is available for this country and plan.
                        Return using the secure “Complete my payment” email link or
                        open this saved registration again. Enrolment follows
                        verified payment.
                      </p>
                    )}
                    {selectedRouteAvailable &&
                      !order.hasBillingProfile &&
                      order.method &&
                      ["STRIPE", "PAYPAL"].includes(order.method) && (
                        <button
                          type="button"
                          className={styles.primary}
                          disabled={busy}
                          onClick={completePayment}
                        >
                          Complete payment
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
                                  id="sirah-confirm-manual-amount"
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
                              {selectedRouteAvailable
                                ? "Add SIRAH BEYOND CHRONOLOGY and your registration reference in the payment remarks. After paying, upload your private receipt here. WhatsApp is available if you need payment support."
                                : "Use the reference below when submitting proof of a transfer you already made."}{" "}
                              Include your full name, registered email and
                              registration reference. Staff must verify receipt
                              before enrolment is confirmed.
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
                            Payment support on WhatsApp ↗
                          </a>
                          <form onSubmit={submitEvidence} className={styles.form}>
                            <ManualPaymentFields
                              payerName={user?.fullName || name}
                              amount={minorToDecimal(
                                order.amountMinor,
                                order.currency,
                              )}
                            />
                            <label>
                              Notes, if needed
                              <textarea name="note" maxLength={1500} />
                            </label>
                            {evidenceMissing.length > 0 && (
                              <div
                                className={styles.notice}
                                id="sirah-evidence-checklist"
                                role="status"
                                aria-live="polite"
                              >
                                <p>
                                  <strong>
                                    {methodSwitched
                                      ? "You changed payment method, so please tick these again before submitting:"
                                      : "Before you submit, please tick:"}
                                  </strong>
                                </p>
                                <ul>
                                  {evidenceMissing.map((item) => (
                                    <li key={item.id}>
                                      <a
                                        href={`#${item.id}`}
                                        onClick={(event) => {
                                          event.preventDefault();
                                          focusField(item.id);
                                        }}
                                      >
                                        {item.label}
                                      </a>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            <button
                              className={styles.primary}
                              type="submit"
                              disabled={busy}
                              aria-describedby={
                                evidenceMissing.length
                                  ? "sirah-evidence-checklist"
                                  : undefined
                              }
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
                    {order.method &&
                      !showMethods &&
                      order.methods.some((method) => method !== order.method) && (
                      <div className={styles.secondaryActions}>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setShowMethods(true)}
                        >
                          Change payment method
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          {feedback}
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
          <details className={styles.moreOptions}>
            <summary>More options</summary>
            <div className={styles.moreOptionsBody}>
              {checkoutResumable && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void checkPayment()}
                >
                  Check verified payment status
                </button>
              )}
              {order.paymentState === "PROCESSING" &&
                ["STRIPE", "PAYPAL"].includes(order.method || "") &&
                !(checkoutResumable && manualAlternatives.length === 0) && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void resetCheckout()}
                  >
                    Close an unpaid checkout to change payment method
                  </button>
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
              <details className={styles.savedDetails}>
                <summary>
                  {order.fullName} · {order.email} · Edit registration details
                </summary>
                <form
                  className={styles.form}
                  onSubmit={(event) => {
                    event.preventDefault();
                    void run(async () => {
                      const result = await api(`/api/sirah/orders/${order.id}`, {
                        method: "PATCH",
                        body: JSON.stringify({
                          revision: order.revision,
                          fullName: name,
                          phoneCountry,
                          callingCode: `+${getCountryCallingCode(phoneCountry)}`,
                          phone,
                        }),
                      });
                      setOrder(result.order);
                      setMessage("Registration details saved.");
                    });
                  }}
                >
                  <label>
                    Full name
                    <input
                      aria-label="Saved full name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      minLength={2}
                      maxLength={120}
                      required
                    />
                  </label>
                  <label>
                    Email
                    <input
                      aria-label="Saved email"
                      type="email"
                      value={order.email}
                      readOnly
                    />
                    <small>
                      For an email correction, contact TGA or update your account
                      after signing in.
                    </small>
                  </label>
                  <PhoneControl
                    country={phoneCountry}
                    value={phone}
                    onCountryChange={setPhoneCountry}
                    onChange={setPhone}
                  />
                  <button
                    type="submit"
                    disabled={
                      busy ||
                      !["UNPAID", "REJECTED", "FAILED"].includes(order.paymentState)
                    }
                  >
                    Save details
                  </button>
                </form>
              </details>
              {order.hasBillingProfile && !renewalNeedsBilling && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void manageBilling()}
                >
                  Manage billing / payment details
                </button>
              )}
              {order.plan === "ANNUAL" && order.paymentState === "PAID" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void requestRefundReview()}
                >
                  Request a refund review
                </button>
              )}
              {order.paymentState === "FAILED" &&
                order.hasBillingProfile &&
                order.method === "PAYPAL" &&
                selectedRouteAvailable &&
                !order.cancelledAt && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void resumeRenewals()}
                  >
                    Resume existing PayPal renewals
                  </button>
                )}
              {!order.cancelledAt &&
                order.enrolmentState !== "CANCELLED" &&
                order.enrolmentState !== "COMPLETED" &&
                (order.terms || order.paymentState === "UNPAID") && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void cancelRegistration()}
                  >
                    {order.plan === "MONTHLY"
                      ? "Cancel future payments"
                      : "Request cancellation"}
                  </button>
                )}
              <button type="button" disabled={busy} onClick={() => void refresh()}>
                Refresh registration status
              </button>
              <details className={styles.resumeHelp}>
                <summary>Need a fresh payment link?</summary>
                {freshLinkForm}
              </details>
              <p>
                <a href="/dashboard">Student dashboard</a> ·{" "}
                <a href={`/seerah/register?order=${order.id}`}>
                  Open this registration page
                </a>
              </p>
            </div>
          </details>
        </section>
      )}
      {!order && (
        <details className={styles.resumeHelp} open={resumeProblem || undefined}>
          <summary>Need a fresh payment link?</summary>
          {freshLinkForm}
        </details>
      )}
      {(!ready || !available) && feedback}
    </div>
  );
}
