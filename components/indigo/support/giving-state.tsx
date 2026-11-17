"use client";

import { createContext, useContext, useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { GivingFrequency, MissionPurpose } from "@/lib/mission-support";
import { amounts, missionPurposes, storageKey } from "./content";

/* The giving state, shared by the form and every "support" button on the page.
 * Behaviour is the live components/support/mission-support-experience.tsx,
 * line for line: same defaults, same session storage, same ?purpose= override,
 * same return-from-checkout confirmation and billing-portal calls. The one
 * difference: return parameters arrive as props from the server page instead
 * of useSearchParams, so the page renders on the server. */

export type Method = "STRIPE" | "PAYPAL" | "BANK_TRANSFER" | "JAZZCASH";
export type Receipt = { status: string; amountGbp: number; frequency: string; purpose: string; reference: string; managementToken?: string };
export type ReturnParams = { payment?: string; provider?: string; token?: string; donationId?: string; session_id?: string; manage?: string; purpose?: string };

type Setter<T> = Dispatch<SetStateAction<T>>;
type Giving = {
  frequency: GivingFrequency; setFrequency: Setter<GivingFrequency>;
  amount: number | "other"; setAmount: Setter<number | "other">;
  customAmount: string; setCustomAmount: Setter<string>;
  purpose: MissionPurpose; setPurpose: Setter<MissionPurpose>;
  paymentMethod: Method; setPaymentMethod: Setter<Method>;
  loading: boolean; setLoading: Setter<boolean>;
  error: string; setError: Setter<string>;
  receipt: Receipt | null;
  confirmationMessage: string; setConfirmationMessage: Setter<string>;
  managementToken: string;
  activeAmount: number;
  formattedAmount: string;
  stickyVisible: boolean;
  formRef: React.RefObject<HTMLElement | null>;
  purposeRef: React.RefObject<HTMLSelectElement | null>;
  scrollToGiving: (nextPurpose?: MissionPurpose, monthly?: boolean) => void;
  manageSupport: () => Promise<void>;
};

const Ctx = createContext<Giving | null>(null);
export function useGiving() {
  const g = useContext(Ctx);
  if (!g) throw new Error("useGiving outside GivingProvider");
  return g;
}

export const gbp = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);

export function GivingProvider({ params, children }: { params: ReturnParams; children: ReactNode }) {
  const formRef = useRef<HTMLElement>(null);
  const purposeRef = useRef<HTMLSelectElement>(null);
  const [frequency, setFrequency] = useState<GivingFrequency>("MONTHLY");
  const [amount, setAmount] = useState<number | "other">(25);
  const [customAmount, setCustomAmount] = useState("");
  const [purpose, setPurpose] = useState<MissionPurpose>("WHERE_NEEDED");
  const [paymentMethod, setPaymentMethod] = useState<Method>("STRIPE");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const [stickyVisible, setStickyVisible] = useState(false);
  const [restored, setRestored] = useState(false);
  const [managementToken, setManagementToken] = useState("");
  const activeAmount = amount === "other" ? Number(customAmount) : amount;
  const formattedAmount = gbp(Number.isFinite(activeAmount) ? activeAmount : 0);

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || "null");
      if (saved?.frequency === "MONTHLY" || saved?.frequency === "ONE_TIME") setFrequency(saved.frequency);
      if (saved?.amount === "other" || (amounts as readonly number[]).includes(saved?.amount)) setAmount(saved.amount);
      if (typeof saved?.customAmount === "string") setCustomAmount(saved.customAmount.slice(0, 12));
      if (missionPurposes.some(p => p.id === saved?.purpose)) setPurpose(saved.purpose);
    } catch { /* Browser storage is optional. */ }
    const requestedPurpose = new URLSearchParams(window.location.search).get("purpose");
    if (missionPurposes.some(p => p.id === requestedPurpose)) setPurpose(requestedPurpose as MissionPurpose);
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    try { sessionStorage.setItem(storageKey, JSON.stringify({ frequency, amount, customAmount, purpose })); } catch { /* Continue without storage. */ }
  }, [frequency, amount, customAmount, purpose, restored]);

  useEffect(() => {
    if (!formRef.current) return;
    const observer = new IntersectionObserver(([entry]) => setStickyVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0), { threshold: 0 });
    observer.observe(formRef.current);
    return () => observer.disconnect();
  }, []);

  // Return from Stripe / PayPal: identical to the live confirmation flow.
  const { payment, provider, token: orderId, donationId, session_id: sessionId, manage } = params;
  useEffect(() => {
    if (payment === "cancelled") setConfirmationMessage("Checkout was cancelled. No payment has been confirmed. Your selections are saved below.");
    if (manage) setManagementToken(manage);
    if (payment !== "success") return;
    if (provider === "paypal") {
      if (!orderId || !donationId) { setConfirmationMessage("A return URL alone cannot confirm a contribution. Please contact TGA."); return; }
      let cancelled = false;
      setConfirmationMessage("We are checking your PayPal payment. Please keep this page open.");
      void fetch("/api/mission-support/paypal/capture-order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId, donationId }) }).then(async response => { const result = await response.json(); if (cancelled) return; if (!response.ok || result.status !== "confirmed") throw new Error(result.error || "PayPal has not confirmed this contribution."); setReceipt(result); setConfirmationMessage("JazakAllahu khair. Your PayPal contribution is confirmed. Thank you for supporting meaningful learning."); }).catch(cause => { if (!cancelled) setConfirmationMessage(cause instanceof Error ? cause.message : "Payment confirmation is unavailable."); });
      return () => { cancelled = true; };
    }
    if (!sessionId) { setConfirmationMessage("A return URL alone cannot confirm a contribution. Please check your provider receipt or contact TGA."); return; }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let attempts = 0;
    setConfirmationMessage("We're checking your payment confirmation. Please keep this page open.");
    const check = async () => {
      try {
        const response = await fetch(`/api/mission-support/confirmation?session_id=${encodeURIComponent(sessionId)}`, { cache: "no-store" });
        const data = await response.json();
        if (cancelled) return;
        if (!response.ok) throw new Error(data.error || "We couldn't verify this contribution yet.");
        if (data.status === "confirmed") {
          setReceipt(data);
          setManagementToken(data.managementToken || "");
          setConfirmationMessage("JazakAllahu khair. Your contribution has been confirmed. Thank you for supporting meaningful learning.");
        } else if (data.status === "failed") setConfirmationMessage("This payment was not confirmed. You can retry below or contact our team.");
        else if (++attempts < 8) timer = setTimeout(check, 2500);
        else setConfirmationMessage("Your payment is awaiting confirmation. Keep your provider receipt; contact TGA if confirmation does not arrive.");
      } catch (cause) { if (!cancelled) setConfirmationMessage(cause instanceof Error ? cause.message : "Payment confirmation is not yet available."); }
    };
    void check();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [payment, provider, orderId, donationId, sessionId, manage]);

  function scrollToGiving(nextPurpose?: MissionPurpose, monthly = false) {
    if (nextPurpose) setPurpose(nextPurpose);
    if (monthly) { setFrequency("MONTHLY"); if (paymentMethod === "PAYPAL") setPaymentMethod("STRIPE"); }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    formRef.current?.scrollIntoView({ behavior: reduced ? "instant" : "smooth", block: "start" });
    purposeRef.current?.focus({ preventScroll: true });
  }

  async function manageSupport() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/mission-support/billing-portal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: managementToken }) });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error || "We couldn't open support management.");
      const url = new URL(data.url);
      if (url.protocol !== "https:" || url.hostname !== "billing.stripe.com") throw new Error("Invalid management destination.");
      window.location.assign(url.toString());
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Please contact TGA for help managing support."); }
    finally { setLoading(false); }
  }

  return (
    <Ctx.Provider value={{ frequency, setFrequency, amount, setAmount, customAmount, setCustomAmount, purpose, setPurpose, paymentMethod, setPaymentMethod, loading, setLoading, error, setError, receipt, confirmationMessage, setConfirmationMessage, managementToken, activeAmount, formattedAmount, stickyVisible, formRef, purposeRef, scrollToGiving, manageSupport }}>
      {children}
    </Ctx.Provider>
  );
}
