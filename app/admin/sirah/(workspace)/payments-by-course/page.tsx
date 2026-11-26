import { requireCourseRevenueAccess } from "@/lib/sirah/course-revenue-access";
import { courseRevenueReport } from "@/services/course-revenue.service";
import { formattedAmounts, formattedNetAmounts, netReceived, outstandingNow } from "@/components/sirah/course-revenue-display";
import { previousMonth, reportPeriod } from "@/lib/sirah/course-revenue-period";
import { CourseRevenueExport, type ExportRow } from "@/components/sirah/course-revenue-export";
import { CourseRevenueCalculator } from "@/components/sirah/course-revenue-calculator";
import { MoneyRows } from "@/components/sirah/course-revenue-money";
import styles from "@/components/sirah/course-revenue.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function date(value: Date | null) { return value ? value.toISOString().slice(0, 10) : "Not recorded"; }

export default async function PaymentsByCoursePage({ searchParams }: { searchParams: Promise<{ period?: string | string[] }> }) {
  await requireCourseRevenueAccess();
  const params = await searchParams;
  const period = reportPeriod(typeof params.period === "string" ? params.period : undefined);
  const report = await courseRevenueReport(period);
  const programs = report.programs.map(program => ({ ...program, net: netReceived(program.received, program.refunds), outstanding: outstandingNow(program.pending, program.due) }));
  const totals = { ...report.totals, net: netReceived(report.totals.received, report.totals.refunds), outstanding: outstandingNow(report.totals.pending, report.totals.due) };
  const exportRows: ExportRow[] = [...programs, { ...totals, title: "Total across programs" }].map(row => ({ title: row.title, received: formattedAmounts(row.received), net: formattedNetAmounts(row.net), outstanding: formattedAmounts(row.outstanding), upcoming: formattedAmounts(row.upcoming) }));
  const currencies = [...new Set(programs.flatMap(program => [...program.received, ...program.net, ...program.outstanding, ...program.upcoming, ...program.ambiguous].filter(value => value.amountMinor !== 0).map(value => value.currency)))].sort();
  const lastMonth = previousMonth(period.current);

  return <div className={styles.report}>
    <header className={styles.header}>
      <div><p className={styles.eyebrow}>Super Admin · read-only</p><h2>Payments by course</h2><p>See what each course has received, what is due, and what is coming up.</p></div>
      <CourseRevenueExport rows={exportRows} periodKey={period.key} periodLabel={period.label} undatedRefunds={totals.undatedRefunds} />
    </header>

    <section className={`ga-admin-workspace-card ${styles.periodBar}`} aria-label="Report period">
      <div><p className={styles.eyebrow}>Report period · Asia/Karachi</p><h3>{period.label}</h3><p>Received amounts use payment dates. Balances and upcoming payments show the current position.</p></div>
      <div className={styles.periodForms}>
        <form method="get" className={styles.periodForm}><label className={styles.field}>Period<select name="period" defaultValue={period.key}>
          <option value={period.current}>This month</option><option value={lastMonth}>Last month</option>
          {period.key !== "all" && period.key !== period.current && period.key !== lastMonth && <option value={period.key}>{period.label}</option>}
          <option value="all">All time</option>
        </select></label><button type="submit" className={styles.periodButton}>View</button></form>
        <form method="get" className={styles.periodForm}><label className={styles.field}>Choose a past month<input type="month" name="period" max={lastMonth} defaultValue={period.key !== "all" && period.key < period.current ? period.key : lastMonth} required /></label><button type="submit" className={styles.periodButton}>View month</button></form>
      </div>
    </section>

    <section className={`ga-admin-workspace-card ${styles.mainCard}`} aria-labelledby="course-breakdown-heading">
      <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Course overview · {period.label}</p><h3 id="course-breakdown-heading">Payments by program</h3><p>Received net is gross less verified refunds recorded in the period. Amounts remain in their original currencies.</p></div><span className={styles.sectionBadge}>Original currencies</span></div>
      {totals.undatedRefunds > 0 && <p className={styles.refundWarning} role="status">{totals.undatedRefunds} verified refund{totals.undatedRefunds === 1 ? " has" : "s have"} no reliable verification date and cannot be assigned to a month. Monthly net may be overstated; review before using it for payouts.</p>}
      <p className={styles.refundWarning}>Legacy registration refunds are not separately recorded in this report. Confirm those amounts before using net for payouts.</p>
      <div className={styles.tableWrap}><table className={`${styles.table} ${styles.breakdown}`}>
        <thead><tr><th scope="col">Program</th><th scope="col">Received gross <small>Verified payments</small></th><th scope="col">Received net <small>After verified refunds</small></th><th scope="col">Outstanding now <small>Current unpaid and overdue</small></th><th scope="col">Upcoming <small>Current forecast, not guaranteed</small></th></tr></thead>
        <tbody>{programs.map(program => <tr key={program.id}><th scope="row">{program.title}</th><td data-label="Received gross"><MoneyRows values={program.received} /></td><td className={styles.netCell} data-label="Received net"><MoneyRows values={program.net} /></td><td data-label="Outstanding now"><MoneyRows values={program.outstanding} /></td><td data-label="Upcoming · forecast"><MoneyRows values={program.upcoming} /></td></tr>)}</tbody>
      </table></div>
      <p className={styles.tableFootnote}>Upcoming shows the next future payment due for each plan.</p>
    </section>

    <section className={`ga-admin-workspace-card ${styles.totalsSection}`} aria-labelledby="combined-heading">
      <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>The bigger picture</p><h3 id="combined-heading">Combined across programs</h3><p>Totals are kept separate for each currency.</p></div></div>
      <div className={styles.summary}>
        <div className={styles.card}><h4>Received gross</h4><p>Verified payments · {period.label}</p><MoneyRows values={totals.received} /></div>
        <div className={`${styles.card} ${styles.netCard}`}><h4>Received net</h4><p>After verified refunds · {period.label}</p><MoneyRows values={totals.net} /></div>
        <div className={styles.card}><h4>Outstanding now</h4><p>Unpaid and overdue</p><MoneyRows values={totals.outstanding} /></div>
        <div className={styles.card}><h4>Upcoming</h4><p>Forecast, not guaranteed</p><MoneyRows values={totals.upcoming} /></div>
      </div>
      <div className={styles.reviewNotice}><span className={styles.reviewDot} aria-hidden="true" /><p>Amounts needing review are excluded. Received totals may understate actual receipts.</p></div>
      <details className={styles.review}>
        <summary>Needs review <span>Excluded from totals</span></summary>
        <div className={styles.reviewContent}><MoneyRows values={totals.ambiguous} /><p className={styles.muted}>Ambiguous ledger entries and older online payments without evidence of settlement are excluded until reviewed.</p>
        {programs.filter(program => program.review.length > 0).map(program => <div className={styles.program} key={program.id}>
          <h4>{program.title}</h4><MoneyRows values={program.ambiguous} />
          <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Registration</th><th>Date recorded</th><th>Method</th><th>Amount</th></tr></thead><tbody>{program.review.map(entry => <tr key={entry.id}><td>{entry.reference}</td><td>{date(entry.receivedAt)}</td><td>{entry.method.replaceAll("_", " ")}</td><td><MoneyRows values={[{ amountMinor: entry.amountMinor, currency: entry.currency }]} /></td></tr>)}</tbody></table></div>
        </div>)}</div>
      </details>
    </section>

    <CourseRevenueCalculator currencies={currencies} rows={programs.map(program => ({ id: program.id, title: program.title, received: program.received, net: program.net, outstanding: program.outstanding }))} totals={{ received: totals.received, net: totals.net, outstanding: totals.outstanding }} />

    <details className={`ga-admin-workspace-card ${styles.details}`}>
      <summary>Payment methods, latest dates and report notes</summary>
      {programs.map(program => <div className={styles.program} key={program.id}>
        <h4>{program.title}</h4><p className={styles.muted}>Latest included payment: {date(program.latest)}</p>
        {program.methods.length ? <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Currency</th><th>Method</th><th>Received</th></tr></thead><tbody>{program.methods.map(item => <tr key={`${item.currency}-${item.method}`}><td>{item.currency}</td><td>{item.method.replaceAll("_", " ")}</td><td><MoneyRows values={[item]} /></td></tr>)}</tbody></table></div> : <p className={styles.muted}>No received payments recorded.</p>}
      </div>)}
      <div className={styles.muted}>
        <p>Outstanding now combines pending registrations with unpaid current and overdue plan periods. Registrations with a monthly plan are excluded from pending registrations to avoid counting their plan dues twice. Upcoming includes only the next future due per plan. Cancelled and completed plans are excluded.</p>
        <p>Ledger entries on orders with payment events cannot reliably be matched to those events. They are excluded from received totals, except a uniquely identifiable duplicate from an admin-created paid registration. An active PayPal subscription alone does not establish payment.</p>
        <p>No currency conversion or refund deduction is applied to the original amounts. The legacy registration model stores at most one payment per registration; separate historical renewal transactions are not available. Latest dates exclude entries for reconciliation; older entries without a payment date are not assigned an estimated date. Excluded and archived Sīrah orders are omitted. Legacy and newer Seerah are shown separately because they share a course record.</p>
        <p>Gen Mumin registrations use a separate system. Its external feed does not provide the payment transactions needed for this report. Rows here reflect only this app’s database.</p>
      </div>
    </details>
  </div>;
}
