import { requireCourseRevenueAccess } from "@/lib/sirah/course-revenue-access";
import type { MoneyGroup } from "@/lib/sirah/course-revenue";
import { courseRevenueReport } from "@/services/course-revenue.service";
import { formattedAmounts, outstandingNow } from "@/components/sirah/course-revenue-display";
import { CourseRevenueExport, type ExportRow } from "@/components/sirah/course-revenue-export";
import styles from "@/components/sirah/course-revenue.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function Amounts({ values }: { values: string[] }) {
  return values.length ? <div className={styles.amounts}>{values.map((value, index) => <span key={index}>{value}</span>)}</div> : <span className={styles.empty}>—</span>;
}
function amount(rows: MoneyGroup[]) { return formattedAmounts(rows).join(" · ") || "None"; }
function date(value: Date | null) { return value ? value.toISOString().slice(0, 10) : "Not recorded"; }

export default async function PaymentsByCoursePage() {
  await requireCourseRevenueAccess();
  const report = await courseRevenueReport();
  const rows: ExportRow[] = report.programs.map(program => ({
    title: program.title,
    received: formattedAmounts(program.received),
    outstanding: formattedAmounts(outstandingNow(program.pending, program.due)),
    upcoming: formattedAmounts(program.upcoming),
  }));
  const totals: ExportRow = {
    title: "Total across programs",
    received: formattedAmounts(report.totals.received),
    outstanding: formattedAmounts(outstandingNow(report.totals.pending, report.totals.due)),
    upcoming: formattedAmounts(report.totals.upcoming),
  };

  return <div className={styles.report}>
    <section className="ga-admin-workspace-card">
      <div className={styles.header}>
        <div><p className="ga-admin-kicker">Super Admin · read-only</p><h2>Payments by course</h2><p>Verified gross receipts and amounts due, in their original currencies.</p></div>
        <CourseRevenueExport rows={[...rows, totals]} />
      </div>
    </section>

    <section className="ga-admin-workspace-card">
      <h3>Per-course breakdown</h3>
      <p className={styles.muted}>Upcoming is the next future plan due: a forecast, not guaranteed.</p>
      <div className={styles.tableWrap}><table className={`${styles.table} ${styles.breakdown}`}>
        <thead><tr><th scope="col">Program</th><th scope="col">Received <small>Verified gross</small></th><th scope="col">Outstanding now</th><th scope="col">Upcoming <small>Forecast, not guaranteed</small></th></tr></thead>
        <tbody>{rows.map((row, index) => <tr key={report.programs[index].id}><th scope="row">{row.title}</th><td><Amounts values={row.received} /></td><td><Amounts values={row.outstanding} /></td><td><Amounts values={row.upcoming} /></td></tr>)}</tbody>
      </table></div>
    </section>

    <section className="ga-admin-workspace-card">
      <h3>Combined across programs</h3>
      <div className={styles.summary}>
        <div className={styles.card}><h4>Received</h4><Amounts values={totals.received} /></div>
        <div className={styles.card}><h4>Outstanding now</h4><Amounts values={totals.outstanding} /></div>
        <div className={styles.card}><h4>Upcoming</h4><Amounts values={totals.upcoming} /><small>Forecast, not guaranteed</small></div>
      </div>
      <p className={styles.muted}>Needs review amounts are excluded; received totals may understate actual receipts.</p>
      <details className={styles.review}>
        <summary>Needs review — {amount(report.totals.ambiguous)} · excluded from totals</summary>
        <p className={styles.muted}>These received totals may understate actual receipts. Ambiguous ledger entries and older online payments without evidence of settlement are excluded until reviewed.</p>
        {report.programs.filter(program => program.review.length > 0).map(program => <div key={program.id}>
          <h4>{program.title} — {amount(program.ambiguous)}</h4>
          <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Registration</th><th>Date recorded</th><th>Method</th><th>Amount</th></tr></thead><tbody>{program.review.map(entry => <tr key={entry.id}><td>{entry.reference}</td><td>{date(entry.receivedAt)}</td><td>{entry.method.replaceAll("_", " ")}</td><td>{amount([{ amountMinor: entry.amountMinor, currency: entry.currency }])}</td></tr>)}</tbody></table></div>
        </div>)}
      </details>
    </section>

    <details className={`ga-admin-workspace-card ${styles.details}`}>
      <summary>Payment methods, latest dates and report notes</summary>
      {report.programs.map(program => <div className={styles.program} key={program.id}>
        <h4>{program.title}</h4><p className={styles.muted}>Latest included payment: {date(program.latest)}</p>
        {program.methods.length ? <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Currency</th><th>Method</th><th>Received</th></tr></thead><tbody>{program.methods.map(item => <tr key={`${item.currency}-${item.method}`}><td>{item.currency}</td><td>{item.method.replaceAll("_", " ")}</td><td>{amount([item])}</td></tr>)}</tbody></table></div> : <p className={styles.muted}>No received payments recorded.</p>}
      </div>)}
      <div className={styles.muted}>
        <p>Outstanding now combines pending registrations with unpaid current and overdue plan periods. Registrations with a monthly plan are excluded from pending registrations to avoid counting their plan dues twice. Upcoming includes only the next future due per plan. Cancelled and completed plans are excluded.</p>
        <p>Ledger entries on orders with payment events cannot reliably be matched to those events. They are excluded from received totals, except a uniquely identifiable duplicate from an admin-created paid registration. An active PayPal subscription alone does not establish payment.</p>
        <p>No currency conversion or refund deduction is applied. The legacy registration model stores at most one payment per registration; separate historical renewal transactions are not available. Latest dates exclude entries for reconciliation; older entries without a payment date are not assigned an estimated date. Excluded and archived Sīrah orders are omitted. Legacy and newer Seerah are shown separately because they share a course record.</p>
        <p>Gen Mumin registrations use a separate system. Its external feed does not provide the payment transactions needed for this report. Rows here reflect only this app’s database.</p>
      </div>
    </details>
  </div>;
}
