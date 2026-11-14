import Link from "next/link";
import { formatSirahMoney, SIRAH_TITLE } from "@/lib/sirah/catalog";

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
          <section
            key={order.id}
            className="ga-dashboard-card"
            style={pay ? { borderColor: "#0f5e91", borderWidth: 2, borderStyle: "solid" } : undefined}
          >
            <p className="ga-dashboard-card-title">{SIRAH_TITLE}</p>
            {pay ? (
              <>
                <h2 className="ga-heading" style={{ fontSize: "1.4rem", margin: "0.4rem 0" }}>
                  You have a registration pending payment
                </h2>
                <p className="ga-dashboard-muted">
                  Your place is saved. Complete your payment to confirm your enrolment.
                  {order.paymentState === "FAILED"
                    ? " Your last payment attempt did not go through."
                    : order.paymentState === "REJECTED"
                      ? " Your last receipt could not be verified."
                      : ""}
                </p>
              </>
            ) : (
              <p className="ga-dashboard-muted" style={{ marginTop: "0.4rem" }}>
                Status: <strong>{status.label}</strong>
              </p>
            )}
            <div className="ga-dashboard-stack" style={{ marginTop: "0.8rem" }}>
              <p>Plan: {sirahPlanLabel(order)} · {sirahAmountLabel(order)}</p>
              <p style={{ overflowWrap: "anywhere" }}>Reference: {order.reference}</p>
            </div>
            <div className="ga-dashboard-actions" style={{ marginTop: "1rem" }}>
              <Link
                href={sirahOrderHref(order)}
                className={pay ? "ga-btn ga-btn-primary" : "ga-btn ga-btn-outline"}
              >
                {pay ? "Complete your payment" : "View your registration"}
              </Link>
            </div>
          </section>
        );
      })}
    </>
  );
}
