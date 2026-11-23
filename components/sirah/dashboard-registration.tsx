import Link from "next/link";
import { formatSirahMoney, SIRAH_TITLE } from "@/lib/sirah/catalog";
import s from "@/components/dashboard/student-dashboard.module.css";

/** Read-only summary of a Sīrah order, loaded by the dashboard server page. */
export type SirahDashboardOrder = {
  id: string;
  reference: string;
  plan: string;
  method: string | null;
  currency: string;
  amountMinor: number;
  paymentState: string;
  enrolmentState: string;
  createdAt: string;
  paidCount?: number;
  cancelled?: boolean;
  nextBillingAt?: string | null;
  accessEndsAt?: string | null;
  renewalCycle?: { billingDay: number; graceDay: number } | null;
};

type StatusKind = "PAY" | "VERIFYING" | "ACTIVE" | "CLOSED";

// Display only: this mirrors stored states and never changes them.
export function sirahOrderStatus(order: SirahDashboardOrder): {
  kind: StatusKind;
  label: string;
} {
  if (order.enrolmentState === "ACTIVE") return { kind: "ACTIVE", label: "Enrolled" };
  if (order.enrolmentState === "COMPLETED") return { kind: "CLOSED", label: "Completed" };
  if (order.enrolmentState === "CANCELLED") return { kind: "CLOSED", label: "Cancelled" };
  if (["UNPAID", "FAILED", "REJECTED"].includes(order.paymentState))
    return { kind: "PAY", label: "Pending payment" };
  if (["AWAITING_REVIEW", "PROCESSING"].includes(order.paymentState))
    return { kind: "VERIFYING", label: "Payment received, being verified" };
  if (order.paymentState === "PAID")
    return { kind: "VERIFYING", label: "Paid, enrolment being confirmed" };
  return { kind: "CLOSED", label: "Closed" };
}

export function sirahOrderHref(order: Pick<SirahDashboardOrder, "id">) {
  return `/seerah/register?order=${encodeURIComponent(order.id)}`;
}

const methodLabels: Record<string, string> = {
  STRIPE: "Card",
  PAYPAL: "PayPal",
  BANK_TRANSFER: "Bank transfer",
  JAZZCASH: "JazzCash",
};

export function sirahPlanLabel(order: SirahDashboardOrder) {
  return order.plan === "MONTHLY" ? "Monthly" : "Full course (one payment)";
}

export function sirahMethodLabel(order: SirahDashboardOrder) {
  return order.method ? methodLabels[order.method] ?? order.method : "Not chosen yet";
}

export function sirahAmountLabel(order: SirahDashboardOrder) {
  const amount = formatSirahMoney(order.amountMinor, order.currency);
  return order.plan === "MONTHLY" ? `${amount} / month` : amount;
}

/** Top-of-dashboard card. An unpaid booking gets a prominent call to action. */
export function SirahDashboardRegistration({ orders }: { orders: SirahDashboardOrder[] }) {
  if (!orders.length) return null;
  return (
    <>
      {orders.map((order) => {
        const status = sirahOrderStatus(order);
        const pay = status.kind === "PAY";
        return (
          <section key={order.id} className={`${s.card} ${pay ? s.cardAttention : ""}`} aria-label={SIRAH_TITLE}>
            <p className={s.cardTitle}>{SIRAH_TITLE}</p>
            {pay ? (
              <>
                <h2 className={s.cardHeading}>You have a registration pending payment</h2>
                <p className={s.muted}>
                  Your place is saved. Complete your payment to confirm your enrolment.
                  {order.paymentState === "FAILED"
                    ? " Your last payment attempt did not go through."
                    : order.paymentState === "REJECTED"
                      ? " Your last receipt could not be verified."
                      : ""}
                </p>
              </>
            ) : (
              <p className={s.muted}>
                Status: <strong>{status.label}</strong>
              </p>
            )}
            <dl className={s.facts}>
              <div className={s.fact}>
                <dt>Plan</dt>
                <dd>
                  {sirahPlanLabel(order)} · {sirahAmountLabel(order)}
                </dd>
              </div>
              <div className={s.fact}>
                <dt>Reference</dt>
                <dd>{order.reference}</dd>
              </div>
            </dl>
            <div className={`${s.actions} ${s.cardActions}`}>
              <Link href={sirahOrderHref(order)} className={pay ? s.btn : s.btnGhost}>
                {pay ? "Complete your payment" : "View your registration"}
              </Link>
            </div>
          </section>
        );
      })}
    </>
  );
}
