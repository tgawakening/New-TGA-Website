import { FIRST_PERIOD_MIN_DAYS, cycleCopy, cycleDateLabel, ordinal, type BillingCycle } from "@/lib/sirah/billing-cycle";

/* How a monthly Sīrah renewal works for this student. Always shown (not a
 * dismissible banner) wherever the registration or dashboard shows a monthly
 * order. Display only: it reads stored dates and never decides access.
 *
 * - On the cohort cycle: "Renewal due: 7th of each month", "Grace period:
 *   until the 15th", one plain sentence, the next renewal date, and, when it
 *   applies, the student's grace or pause state.
 * - Not paid yet: what will apply for the chosen method (the cohort cycle for
 *   bank transfer, JazzCash and card; PayPal renews on its own date).
 * - Legacy (paid before the cycle, or PayPal): the true renewal day, from the
 *   provider's own next billing date. */

type When = string | Date | null | undefined;

export type RenewalCycleProps = {
  plan: string;
  method: string | null;
  /** The order's own cycle, if it follows one. */
  cycle: BillingCycle | null;
  /** The cohort's cycle, for an order not paid yet. */
  cohortCycle?: BillingCycle | null;
  paid: boolean;
  paymentState: string;
  enrolmentState: string;
  cancelled?: boolean;
  nextBillingAt?: When;
  accessEndsAt?: When;
  className?: string;
};

const date = (v: When) => (v ? new Date(v) : null);
/** The last day of access: accessEndsAt is the first instant without it. */
const lastDay = (end: Date) => cycleDateLabel(new Date(end.getTime() - 1));
const pktDay = (d: Date) => Number(new Intl.DateTimeFormat("en-GB", { day: "numeric", timeZone: "Asia/Karachi" }).format(d));

function CycleLines({ cycle }: { cycle: BillingCycle }) {
  const copy = cycleCopy(cycle);
  return (
    <>
      <p>
        <strong>{copy.due}</strong>
      </p>
      <p>
        <strong>{copy.grace}</strong>
      </p>
      <p>{copy.explain}</p>
    </>
  );
}

export function RenewalCycle(props: RenewalCycleProps) {
  if (props.plan !== "MONTHLY" || props.cancelled) return null;
  const next = date(props.nextBillingAt);
  const end = date(props.accessEndsAt);
  const box = (children: React.ReactNode) => (
    <div className={props.className} role="group" aria-label="Monthly renewal">
      {children}
    </div>
  );

  if (props.cycle) {
    const inGrace =
      props.paid &&
      props.enrolmentState === "ACTIVE" &&
      ["UNPAID", "FAILED", "AWAITING_REVIEW", "REJECTED"].includes(props.paymentState) &&
      // Still ACTIVE means inside grace: the maintenance sweep pauses it after.
      !!end;
    const paused = props.paid && props.enrolmentState === "PENDING";
    return box(
      <>
        <CycleLines cycle={props.cycle} />
        {next && !inGrace && !paused && <p>Next renewal: {cycleDateLabel(next)}.</p>}
        {inGrace && next && end && (
          <p>
            {props.paymentState === "AWAITING_REVIEW"
              ? `Your ${cycleDateLabel(next)} renewal is being verified. Your access continues until the end of ${lastDay(end)}.`
              : `Your ${cycleDateLabel(next)} renewal has not been paid yet. Your access continues until the end of ${lastDay(end)}.`}
          </p>
        )}
        {paused && <p>Your access is paused until your renewal payment is received.</p>}
      </>,
    );
  }

  if (!props.paid) {
    if (props.method === "PAYPAL")
      return box(<p>PayPal renews your monthly payment on the same date each month as your first payment.</p>);
    return props.cohortCycle
      ? box(
          <>
            <CycleLines cycle={props.cohortCycle} />
            <p>
              Your first payment covers you until the next {ordinal(props.cohortCycle.billingDay)}, or, if that is less than{" "}
              {FIRST_PERIOD_MIN_DAYS} days away, until the {ordinal(props.cohortCycle.billingDay)} of the month after.
            </p>
          </>,
        )
      : null;
  }

  // Legacy schedule: renews on the provider's (or original) monthly date.
  if (!next) return null;
  return box(
    <>
      <p>
        <strong>Renewal: the {ordinal(pktDay(next))} of each month</strong>
        {props.method === "STRIPE" || props.method === "PAYPAL" ? ", the date your card subscription renews." : "."}
      </p>
      <p>Next renewal: {cycleDateLabel(next)}.</p>
    </>,
  );
}
