"use client";

import { useEffect, useState, type ReactNode } from "react";
import { formatSirahMoney } from "@/lib/sirah/catalog";
import {
  sirahMethodLabel,
  type SirahPaymentTotals,
} from "@/lib/sirah/payment-totals";
import styles from "./admin-payment-totals.module.css";

const signedMoney = (amount: number, currency: string) => amount < 0 ? `-${formatSirahMoney(-amount, currency)}` : formatSirahMoney(amount, currency);
const count = (value: number) => value.toLocaleString("en-GB");
const day = (value: string) =>
  new Date(`${value}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
function period(from: string | null, to: string | null) {
  if (from && to) return from === to ? day(from) : `${day(from)} to ${day(to)}`;
  if (from) return `from ${day(from)}`;
  if (to) return `up to ${day(to)}`;
  return "all dates";
}

/**
 * Read-only reconciliation panel: money received for the records matching the
 * query, by currency and then payment method. Never sums currencies.
 * `query` is a filter query (no page number) for /api/admin/sirah/totals.
 */
export function SirahPaymentTotalsPanel({
  query,
  reloadKey,
  countedView,
  caption,
  filters,
}: {
  query: string;
  reloadKey: number;
  /** False on the Excluded / Archive views, which are never counted. */
  countedView: boolean;
  /** Replaces the default caption; receives the period being shown. */
  caption?: (period: string) => ReactNode;
  /** Controls shown under the heading (e.g. a date range). */
  filters?: ReactNode;
}) {
  const [totals, setTotals] = useState<SirahPaymentTotals | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!countedView) return;
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/admin/sirah/totals?${query}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const result = await response.json();
        if (!response.ok) throw Error(result.error || "Could not load payment totals.");
        if (!controller.signal.aborted) {
          setTotals(result);
          setError("");
        }
      } catch (cause) {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : "Could not load payment totals.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, reloadKey, countedView]);

  return (
    <section className={styles.panel} aria-labelledby="sirah-payment-totals-title">
      <div className={styles.head}>
        <div>
          <h3 id="sirah-payment-totals-title">Payments received</h3>
          <p className={styles.caption}>
            {countedView && caption ? (
              caption(totals ? period(totals.from, totals.to) : "…")
            ) : countedView ? (
              <>
                Verified payments for the records matching these filters,{" "}
                {totals ? period(totals.from, totals.to) : "…"} (UTC). Pending,
                awaiting review, rejected and unpaid registrations and test
                records are not counted.
              </>
            ) : (
              <>Excluded and archived records are never counted in payment totals.</>
            )}
          </p>
        </div>
        {countedView && (
          <a className="ga-admin-outline-btn" href={`/api/admin/sirah/totals?${query}&format=csv`}>
            Export payments (CSV)
          </a>
        )}
      </div>

      {filters}

      {countedView && error && (
        <p className="ga-admin-error-banner" role="alert">
          {error}
        </p>
      )}
      {countedView && !totals && !error && (
        <p className="ga-admin-loading" role="status">
          Adding up payments…
        </p>
      )}
      {countedView && totals && !error && (
        <div aria-busy={loading} className={loading ? styles.stale : undefined}>
          {totals.truncated && (
            <p className="ga-admin-error-banner" role="alert">
              Too many payments to add up in one view. Narrow the dates or
              filters for an exact figure.
            </p>
          )}
          {totals.currencies.length === 0 ? (
            <p className={styles.none}>No payments received for these filters.</p>
          ) : (
            <>
              <p className={styles.summary}>
                {count(totals.currencies.reduce((sum, c) => sum + c.payments, 0))}{" "}
                payments from {count(totals.students)}{" "}
                {totals.students === 1 ? "student" : "students"}
                {totals.currencies.length > 1 &&
                  ` in ${totals.currencies.length} currencies, totalled separately`}
                .
              </p>
              <div className={styles.grid}>
                {totals.currencies.map((currency) => {
                  const refunds = currency.refundedMinor > 0;
                  return (
                    <article key={currency.currency} className={styles.card}>
                      <div className={styles.cardHead}>
                        <span className={styles.code}>{currency.currency}</span>
                        <span className={styles.big}>
                          {signedMoney(currency.netMinor, currency.currency)}
                        </span>
                        <span className={styles.sub}>
                          {refunds && <>Refunded: {formatSirahMoney(currency.refundedMinor, currency.currency)} - </>}{count(currency.payments)}{" "}
                          {currency.payments === 1 ? "payment" : "payments"} received
                        </span>
                      </div>
                      <table className={styles.table}>
                        <caption className={styles.srOnly}>
                          {currency.currency} payments by method
                        </caption>
                        <thead>
                          <tr>
                            <th scope="col">Method</th>
                            <th scope="col" className={styles.num}>Payments</th>
                            <th scope="col" className={styles.num}>Received</th>
                            {refunds && <th scope="col" className={styles.num}>Refunded</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {currency.methods.map((row) => (
                            <tr key={row.method}>
                              <th scope="row">{sirahMethodLabel(row.method)}</th>
                              <td className={styles.num}>{count(row.payments)}</td>
                              <td className={styles.num}>
                                {signedMoney(row.receivedMinor - row.refundedMinor, currency.currency)}
                              </td>
                              {refunds && (
                                <td className={styles.num}>
                                  {row.refundedMinor
                                    ? formatSirahMoney(row.refundedMinor, currency.currency)
                                    : "–"}
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <th scope="row">Total {currency.currency}</th>
                            <td className={styles.num}>{count(currency.payments)}</td>
                            <td className={styles.num}>
                              {signedMoney(currency.netMinor, currency.currency)}
                            </td>
                            {refunds && (
                              <td className={styles.num}>
                                {formatSirahMoney(currency.refundedMinor, currency.currency)}
                              </td>
                            )}
                          </tr>

                        </tfoot>
                      </table>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * Payments received for the Overview page: every counted record, narrowed
 * only by the date the payment was recorded (From / To, UTC). Same endpoint,
 * same totals and the same per-payment CSV as before.
 */
export function SirahPaymentsReceived() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const query = new URLSearchParams({ from, to }).toString();
  return (
    <SirahPaymentTotalsPanel
      query={query}
      reloadKey={0}
      countedView
      caption={(shown) => (
        <>
          Verified payments received, {shown} (UTC), totalled by currency and
          then by payment method. Pending, awaiting review, rejected and unpaid
          registrations and excluded test records are not counted.
        </>
      )}
      filters={
        <div className={styles.range} role="group" aria-label="Date range (UTC)">
          <label>
            From
            <input
              type="date"
              aria-label="Payments from (UTC)"
              value={from}
              max={to || undefined}
              onChange={(event) => setFrom(event.target.value)}
            />
          </label>
          <span className={styles.rangeDash} aria-hidden="true">
            –
          </span>
          <label>
            To
            <input
              type="date"
              aria-label="Payments to (UTC)"
              value={to}
              min={from || undefined}
              onChange={(event) => setTo(event.target.value)}
            />
          </label>
          {(from || to) && (
            <button
              type="button"
              className={styles.rangeClear}
              onClick={() => {
                setFrom("");
                setTo("");
              }}
            >
              All dates
            </button>
          )}
        </div>
      }
    />
  );
}
