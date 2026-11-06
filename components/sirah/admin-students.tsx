"use client";
import { useEffect, useState, type FormEvent } from "react";
import type { listSirahAdmin } from "@/services/sirah-admin.service";
import { formatSirahMoney, minorToDecimal } from "@/lib/sirah/catalog";
import styles from "./registration.module.css";
type Snapshot = Awaited<ReturnType<typeof listSirahAdmin>>;
export function SirahAdminStudents({
  initialOrder = "",
}: {
  initialOrder?: string;
}) {
  const [data, setData] = useState<Snapshot | null>(null);
  const [q, setQ] = useState(initialOrder);
  const [payment, setPayment] = useState("");
  const [enrolment, setEnrolment] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const query = new URLSearchParams({
    q,
    payment,
    enrolment,
    page: String(page),
  }).toString();
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void fetch(`/api/admin/sirah?${query}`, { signal: controller.signal })
        .then(async (response) => {
          const result = await response.json();
          if (!response.ok)
            throw Error(result.error || "Could not load students.");
          setData(result);
          setError("");
        })
        .catch((cause) => {
          if (cause.name !== "AbortError") setError(cause.message);
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);
  async function act(
    event: FormEvent<HTMLFormElement>,
    row: Snapshot["rows"][number],
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const action = String(form.get("action"));
    if (
      !window.confirm(
        `${action} registration ${row.reference}? Payment and enrolment status are separate.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const body = {
        orderId: row.id,
        revision: row.revision,
        action,
        note: String(form.get("note") || "") || undefined,
        verifiedAmount: String(form.get("verifiedAmount") || "") || undefined,
        currency: String(form.get("currency") || "") || undefined,
        transactionReference:
          String(form.get("transactionReference") || "") || undefined,
        refundReference: String(form.get("refundReference") || "") || undefined,
        paymentEventId: String(form.get("paymentEventId") || "") || undefined,
        providerReference:
          String(form.get("providerReference") || "") || undefined,
        verifiedTransfer: form.get("verifiedTransfer") === "on",
      };
      const response = await fetch("/api/admin/sirah", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "Action failed.");
      setMessage("Action recorded. Status and audit history refreshed.");
      const fresh = await fetch(`/api/admin/sirah?${query}`).then((r) =>
        r.json(),
      );
      setData(fresh);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={`${styles.experience} ${styles.adminPage}`}>
      <h1>Sīrah | Beyond Chronology Students</h1>
      <p>
        Current batch registrations, verified payment ledger, protected receipt
        evidence and notification delivery.
      </p>
      <p>
        <a href="/api/admin/sirah/legacy">
          Historical Sīrah records (read-only, original agreed amounts)
        </a>
      </p>
      <p>
        <a href="/admin">← Main admin dashboard</a> ·{" "}
        <a href={`/api/admin/sirah?${query}&format=csv`}>
          Export this results page (CSV)
        </a>
      </p>
      <div className={styles.filters}>
        <label>
          Search name, email, phone or reference
          <input
            type="search"
            value={q}
            onChange={(event) => {
              setQ(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          Payment status
          <select
            value={payment}
            onChange={(event) => {
              setPayment(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All payments</option>
            {[
              "UNPAID",
              "PROCESSING",
              "AWAITING_REVIEW",
              "PAID",
              "REJECTED",
              "FAILED",
              "REFUNDED",
            ].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Enrolment status
          <select
            value={enrolment}
            onChange={(event) => {
              setEnrolment(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All enrolments</option>
            {["PENDING", "ACTIVE", "CANCELLED", "COMPLETED"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
      </div>
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
      {!data ? (
        <p role="status">Loading students…</p>
      ) : (
        <>
          <p>
            {data.total} registrations · Page {data.page}
          </p>
          <div className={styles.tableWrap}>
            <table className={styles.adminTable}>
              <thead>
                <tr>
                  <th>Student / reference</th>
                  <th>Plan / amount</th>
                  <th>States</th>
                  <th>Evidence and actions</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.user.fullName}</strong>
                      <p>
                        {row.user.email}
                        <br />
                        {row.phoneE164}
                        <br />
                        {row.countryName}
                      </p>
                      <code>{row.reference}</code>
                      <p>{row.batchCode}</p>
                    </td>
                    <td>
                      <strong>{row.plan}</strong>
                      <p>{row.method || "Method not selected"}</p>
                      <p>
                        Expected:{" "}
                        {formatSirahMoney(row.amountMinor, row.currency)}
                        <br />
                        Paid: {formatSirahMoney(row.paidMinor, row.currency)}
                        <br />
                        Refunded:{" "}
                        {formatSirahMoney(row.refundedMinor, row.currency)}
                      </p>
                      <p>
                        Payments: {row.paidCount}
                        <br />
                        Next billing:{" "}
                        {row.nextBillingAt
                          ? new Date(row.nextBillingAt).toLocaleString()
                          : "Not scheduled"}
                        <br />
                        Programme end:{" "}
                        {row.programmeEnd
                          ? new Date(row.programmeEnd).toLocaleString()
                          : "Not started"}
                      </p>
                      <code>{row.pricingVersion}</code>
                    </td>
                    <td>
                      Payment: <strong>{row.paymentState}</strong>
                      <p>
                        Enrolment: <strong>{row.enrolmentState}</strong>
                      </p>
                    </td>
                    <td>
                      {row.receipts.map((receipt) => (
                        <p key={receipt.id}>
                          <a href={`/api/sirah/receipts/${receipt.id}`}>
                            Receipt v{receipt.revision}: {receipt.filename}
                          </a>
                        </p>
                      ))}
                      <details>
                        <summary>Review / update registration</summary>
                        <form onSubmit={(event) => void act(event, row)}>
                          <label>
                            Action
                            <select name="action">
                              <option value="APPROVE">
                                Approve a verified manual transfer
                              </option>
                              <option value="REJECT">
                                Reject manual evidence
                              </option>
                              <option value="CANCEL">
                                Cancel enrolment / provider billing
                              </option>
                              <option value="COMPLETE">
                                Mark course completed (does not mark payment
                                paid)
                              </option>
                              <option value="RECONCILE_PROVIDER">
                                Reconcile an existing provider checkout
                                (verifies actual settlement)
                              </option>
                              <option value="REFUND">
                                Issue / record verified refund
                              </option>
                              <option value="RETRY_NOTIFICATIONS">
                                Retry notification delivery
                              </option>
                            </select>
                          </label>
                          <label>
                            Verified amount
                            <input
                              name="verifiedAmount"
                              inputMode="decimal"
                              defaultValue={minorToDecimal(
                                row.amountMinor,
                                row.currency,
                              )}
                            />
                          </label>
                          <label>
                            Currency
                            <input
                              name="currency"
                              defaultValue={row.currency}
                              maxLength={3}
                            />
                          </label>
                          <label>
                            Verified transfer transaction reference
                            <input
                              name="transactionReference"
                              maxLength={150}
                            />
                          </label>
                          <label className={styles.check}>
                            <input name="verifiedTransfer" type="checkbox" />I
                            independently verified this transfer in the merchant
                            account. The receipt alone is not proof.
                          </label>
                          <label>
                            Online payment to refund
                            <select name="paymentEventId">
                              <option value="">
                                Choose a verified payment
                              </option>
                              {row.events
                                .filter((e) =>
                                  ["FIRST", "RENEWAL"].includes(e.kind),
                                )
                                .map((e) => (
                                  <option key={e.id} value={e.id}>
                                    {e.id} ·{" "}
                                    {formatSirahMoney(
                                      e.amountMinor,
                                      e.currency,
                                    )}
                                  </option>
                                ))}
                            </select>
                          </label>
                          <label>
                            Actual provider checkout / subscription reference
                            <input name="providerReference" />
                          </label>
                          <label>
                            Real manual refund reference, if applicable
                            <input name="refundReference" />
                          </label>
                          <label>
                            Reason / review note
                            <textarea name="note" maxLength={1500} />
                          </label>
                          <button
                            className={styles.primary}
                            type="submit"
                            disabled={busy}
                          >
                            Record authorised action
                          </button>
                        </form>
                      </details>
                      <details>
                        <summary>
                          Email delivery ({row.notifications.length})
                        </summary>
                        {row.notifications.map((n) => (
                          <p key={n.id}>
                            {n.kind}: <strong>{n.state}</strong> · Attempts{" "}
                            {n.attempts}
                            {n.error ? ` · ${n.error}` : ""}
                          </p>
                        ))}
                      </details>
                      <details>
                        <summary>Audit history</summary>
                        <div className={styles.history}>
                          {row.audits.map((a, i) => (
                            <div key={i}>
                              <strong>{a.action}</strong> · {a.actor} ·{" "}
                              {new Date(a.createdAt).toLocaleString()}
                              <pre>{JSON.stringify(a.detail, null, 2)}</pre>
                            </div>
                          ))}
                        </div>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.pager}>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Previous page
            </button>
            <span>
              Page {page} / {Math.max(1, Math.ceil(data.total / data.pageSize))}
            </span>
            <button
              type="button"
              disabled={page * data.pageSize >= data.total}
              onClick={() => setPage(page + 1)}
            >
              Next page
            </button>
          </div>
        </>
      )}
    </div>
  );
}
