import { requireCourseRevenueAccess } from "@/lib/sirah/course-revenue-access";
import { formatSirahMoney } from "@/lib/sirah/catalog";
import type { MoneyGroup } from "@/lib/sirah/course-revenue";
import { courseRevenueReport } from "@/services/course-revenue.service";
import styles from "@/components/sirah/course-revenue.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function money(amount: number, currency: string) {
  try { return formatSirahMoney(amount, currency); } catch { return `${currency} ${amount} minor units`; }
}
function amounts(rows: MoneyGroup[]) { return rows.length ? rows.map(row => money(row.amountMinor, row.currency)).join(" · ") : "None"; }
function date(value: Date | null) { return value ? value.toISOString().slice(0, 10) : "Not recorded"; }

export default async function PaymentsByCoursePage() {
  await requireCourseRevenueAccess();
  const report = await courseRevenueReport();
  return <div className={styles.report}>
    <section className="ga-admin-workspace-card">
      <p className="ga-admin-kicker">Super admin · Read-only</p>
      <h2>Payments by course</h2>
      <p>Verified gross receipts and pending payments, kept in their original currencies. No currency conversion or refund deduction is applied.</p>
      <p className={styles.muted}>Gen Mumin registrations use a separate system. Its external feed does not provide the payment transactions needed for this report. Any course rows listed here reflect only this app’s database.</p>
    </section>
    <section className="ga-admin-workspace-card">
      <h3>Combined across programs</h3>
      <div className={styles.summary}>
        <div className={styles.card}><h4>Received</h4><p>{amounts(report.totals.received)}</p></div>
        <div className={styles.card}><h4>Pending and upcoming</h4><p>{amounts(report.totals.pendingUpcoming)}</p></div>
        <div className={styles.card}><h4>Pending registrations</h4><p>{amounts(report.totals.pending)}</p></div>
        <div className={styles.card}><h4>Plan amounts due</h4><p>{amounts(report.totals.due)}</p></div>
        <div className={styles.card}><h4>Next future plan dues</h4><p>{amounts(report.totals.upcoming)}</p></div>
        <div className={styles.card}><h4>Payments for review</h4><p>{amounts(report.totals.ambiguous)}</p></div>
      </div>
      <p className={styles.muted}>Pending registration amounts exclude orders with a monthly plan to avoid counting their plan dues twice. Due includes unpaid current and overdue plan periods; upcoming includes only the next future due per plan. Cancelled and completed plans are excluded. Forecasts are not guaranteed collections.</p>
      <p className={styles.muted}>Ledger entries on orders with payment events cannot reliably be matched to those events. They are shown separately for review and excluded from received totals, except a uniquely identifiable duplicate from an admin-created paid registration. Older online payments without evidence of settlement are also shown for review; an active PayPal subscription alone does not establish payment. These received totals may therefore understate actual receipts.</p>
      <p className={styles.muted}>The legacy registration model stores at most one payment per registration; separate historical renewal transactions are not available to this report.</p>
    </section>
    {report.programs.map(program => <section className="ga-admin-workspace-card" key={program.id}>
      <h3>{program.title}</h3>
      <div className={styles.summary}>
        <div className={styles.card}><h4>Received</h4><p>{amounts(program.received)}</p></div>
        <div className={styles.card}><h4>Pending registrations ({program.pendingCount})</h4><p>{amounts(program.pending)}</p></div>
        <div className={styles.card}><h4>Plan amounts due</h4><p>{amounts(program.due)}</p></div>
        <div className={styles.card}><h4>Next future plan dues</h4><p>{amounts(program.upcoming)}</p></div>
        <div className={styles.card}><h4>Latest included payment date</h4><p>{date(program.latest)}</p></div>
      </div>
      <h4>Received by currency and method</h4>
      {program.methods.length ? <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Currency</th><th>Method</th><th>Received</th></tr></thead><tbody>{program.methods.map(item => <tr key={`${item.currency}-${item.method}`}><td>{item.currency}</td><td>{item.method.replaceAll("_", " ")}</td><td>{money(item.amountMinor, item.currency)}</td></tr>)}</tbody></table></div> : <p>None recorded.</p>}
      {program.review.length > 0 && <details><summary>{program.review.length} {program.review.length === 1 ? "payment" : "payments"} for reconciliation — {amounts(program.ambiguous)}</summary><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Registration</th><th>Date recorded</th><th>Method</th><th>Amount</th></tr></thead><tbody>{program.review.map(entry => <tr key={entry.id}><td>{entry.reference}</td><td>{date(entry.receivedAt)}</td><td>{entry.method.replaceAll("_", " ")}</td><td>{money(entry.amountMinor, entry.currency)}</td></tr>)}</tbody></table></div></details>}
    </section>)}
    <p className={styles.muted}>Latest dates exclude entries for reconciliation. Older entries with no payment date are not assigned an estimated date. Excluded and archived Sīrah orders are omitted. Legacy and newer Seerah are shown separately because they share a course record.</p>
  </div>;
}
