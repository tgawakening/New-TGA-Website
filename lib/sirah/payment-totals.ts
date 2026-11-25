/**
 * Read-only payment reconciliation for the Sīrah admin. Pure helpers shared by
 * the totals endpoint, the payments CSV and the admin list UI.
 *
 * Source of truth: the payment ledger (SirahPaymentEvent). A FIRST or RENEWAL
 * event is written only when a payment is verified (Stripe / PayPal settled,
 * or a bank / JazzCash receipt approved), in the same transaction that marks
 * the order paid, so each one is money actually received. REFUND events are
 * money returned. Amounts are never added across currencies.
 */

export type SirahLedgerLine = {
  orderId: string;
  provider: string;
  kind: string;
  amountMinor: number;
  currency: string;
};

export type SirahMethodTotal = {
  method: string;
  payments: number;
  receivedMinor: number;
  refunds: number;
  refundedMinor: number;
};

export type SirahCurrencyTotal = SirahMethodTotal & {
  currency: string;
  netMinor: number;
  methods: SirahMethodTotal[];
};

export type SirahPaymentTotals = {
  currencies: SirahCurrencyTotal[];
  /** Distinct students (orders) with at least one payment received. */
  students: number;
  /** True when the ledger had more lines than one request reads. */
  truncated: boolean;
  /** The From / To filter applied, echoed back for the panel caption. */
  from: string | null;
  to: string | null;
};

const METHOD_LABELS: Record<string, string> = {
  STRIPE: "Stripe",
  PAYPAL: "PayPal",
  BANK_TRANSFER: "Bank transfer",
  JAZZCASH: "JazzCash",
};
export const sirahMethodLabel = (method: string) =>
  METHOD_LABELS[method] ||
  method.charAt(0) + method.slice(1).toLowerCase().replaceAll("_", " ");

const METHOD_ORDER = ["JAZZCASH", "BANK_TRANSFER", "STRIPE", "PAYPAL"];
const methodRank = (method: string) => {
  const index = METHOD_ORDER.indexOf(method);
  return index === -1 ? METHOD_ORDER.length : index;
};

const empty = (method: string): SirahMethodTotal => ({
  method,
  payments: 0,
  receivedMinor: 0,
  refunds: 0,
  refundedMinor: 0,
});

/** Group ledger lines by currency, then by payment method. */
export function sumSirahLedger(
  lines: SirahLedgerLine[],
  receivedKinds: readonly string[],
): Pick<SirahPaymentTotals, "currencies" | "students"> {
  const byCurrency = new Map<string, Map<string, SirahMethodTotal>>();
  const students = new Set<string>();
  for (const line of lines) {
    const received = receivedKinds.includes(line.kind);
    if (!received && !["REFUND", "REFUND_PENDING"].includes(line.kind)) continue;
    const methods = byCurrency.get(line.currency) ?? new Map();
    byCurrency.set(line.currency, methods);
    const total = methods.get(line.provider) ?? empty(line.provider);
    methods.set(line.provider, total);
    if (received) {
      total.payments += 1;
      total.receivedMinor += line.amountMinor;
      students.add(line.orderId);
    } else {
      total.refunds += 1;
      total.refundedMinor += line.amountMinor;
    }
  }
  const currencies = [...byCurrency.entries()]
    .map(([currency, methods]): SirahCurrencyTotal => {
      const rows = [...methods.values()].sort(
        (a, b) => methodRank(a.method) - methodRank(b.method) || a.method.localeCompare(b.method),
      );
      const sum = (key: keyof Omit<SirahMethodTotal, "method">) =>
        rows.reduce((acc, row) => acc + row[key], 0);
      const receivedMinor = sum("receivedMinor");
      const refundedMinor = sum("refundedMinor");
      return {
        currency,
        method: "ALL",
        payments: sum("payments"),
        receivedMinor,
        refunds: sum("refunds"),
        refundedMinor,
        netMinor: receivedMinor - refundedMinor,
        methods: rows,
      };
    })
    // Largest number of payments first (PKR for the manual Pakistan flow).
    .sort((a, b) => b.payments - a.payments || a.currency.localeCompare(b.currency));
  return { currencies, students: students.size };
}
