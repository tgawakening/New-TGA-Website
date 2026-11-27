import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionIdentity } from "@/lib/auth/session";
import { SIRAH_TITLE, formatSirahMoney } from "@/lib/sirah/catalog";
import { karachiMonth, previousMonth, reportPeriod } from "@/lib/sirah/course-revenue-period";
import { ClassroomHeader } from "@/components/indigo/classroom/parts";
import { sirahTeacherEarnings, teacherEarningsAccess } from "@/services/teacher-earnings.service";
import c from "@/components/indigo/classroom/classroom.module.css";
import t from "@/components/indigo/classroom/teaching.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: `My earnings | ${SIRAH_TITLE}`,
  robots: { index: false, follow: false },
};

/* Teacher earnings: the agreed share of the course's money received after
 * refunds, per currency (never converted) and per month or all time. Visible
 * to the Super Admin and to a host designated as a revenue partner; anyone
 * else gets a 404. Figures come from the admin course report. */

const money = (minor: number, currency: string) => {
  try { return formatSirahMoney(minor, currency); } catch { return `${currency} ${minor}`; }
};

function monthOptions(now: Date) {
  const months: { key: string; label: string }[] = [];
  let month = karachiMonth(now);
  for (let i = 0; i < 12; i++) {
    months.push({ key: month, label: reportPeriod(month, now).label });
    month = previousMonth(month);
  }
  return months;
}

export default async function TeacherEarningsPage({ searchParams }: { searchParams?: Promise<{ period?: string }> } = {}) {
  const identity = await getSessionIdentity();
  const access = await teacherEarningsAccess(identity);
  if (!access.allowed) {
    if (!identity) redirect("/login");
    notFound();
  }
  const now = new Date();
  const requested = (await searchParams)?.period;
  const period = reportPeriod(requested ?? "all", now);
  const earnings = await sirahTeacherEarnings(period);
  const months = monthOptions(now);

  return (
    <div className={c.page}>
      <ClassroomHeader home="/seerah/classroom/teaching" week={null} percent={null} back={{ href: "/seerah/classroom/teaching", label: "My sessions" }} />
      <main className={c.wrap}>
        <section className={t.hero} aria-labelledby="earnings-title">
          <div>
            <p className={t.eyebrow}>Teaching · Earnings</p>
            <h1 id="earnings-title" className={t.title}>My earnings</h1>
            <p className={t.lede}>
              Your agreed share ({earnings.percent}%) of what {earnings.title ?? "the course"} received after refunds. Each currency is shown on its own, never converted.
            </p>
          </div>
          <form method="get" className={t.periodForm}>
            <label className={t.field}>
              Period
              <select name="period" defaultValue={period.key}>
                <option value="all">All time</option>
                {months.map(month => <option key={month.key} value={month.key}>{month.label}</option>)}
              </select>
            </label>
            <button type="submit" className={t.btnGhost}>Show</button>
          </form>
        </section>

        <section className={t.section} aria-labelledby="by-currency">
          <div className={t.sectionHead}>
            <h2 id="by-currency" className={t.sectionTitle}>{period.label}</h2>
            <span className={t.sectionMeta}>Month boundaries in Pakistan time</span>
          </div>
          {earnings.rows.length ? (
            <div className={t.figures}>
              {earnings.rows.map(row => (
                <article key={row.currency} className={t.card} aria-labelledby={`cur-${row.currency}`}>
                  <div className={t.cardHead}>
                    <h3 id={`cur-${row.currency}`} className={t.currency}>{row.currency}</h3>
                    <span className={t.chip}>{earnings.percent}% share</span>
                  </div>
                  <dl className={t.lines}>
                    <div className={t.line}><dt>Received</dt><dd>{money(row.receivedMinor, row.currency)}</dd></div>
                    <div className={t.line}><dt>Refunds</dt><dd className={row.refundedMinor ? t.negative : ""}>{row.refundedMinor ? `− ${money(row.refundedMinor, row.currency)}` : money(0, row.currency)}</dd></div>
                    <div className={t.line}><dt>Received after refunds</dt><dd>{money(row.netMinor, row.currency)}</dd></div>
                    <div className={`${t.line} ${t.total}`}><dt>Your share ({earnings.percent}%)</dt><dd className={row.shareMinor < 0 ? t.negative : ""}>{money(row.shareMinor, row.currency)}</dd></div>
                  </dl>
                </article>
              ))}
            </div>
          ) : (
            <p className={t.empty}>No money received in this period yet.</p>
          )}
        </section>

        <section className={t.section} aria-labelledby="notes">
          <h2 id="notes" className={c.srOnly}>Notes</h2>
          <div className={t.grid}>
            <p className={t.note}>
              Your share is shown before any advance is deducted. Advances and your net payable amount will appear here once advance recording is switched on.
            </p>
            {earnings.inReview.some(item => item.amountMinor) ? (
              <p className={t.note}>
                Not yet counted, awaiting finance review: {earnings.inReview.filter(item => item.amountMinor).map(item => money(item.amountMinor, item.currency)).join(", ")}.
              </p>
            ) : null}
            {earnings.undatedRefunds ? (
              <p className={t.note}>
                {earnings.undatedRefunds} {earnings.undatedRefunds === 1 ? "refund has" : "refunds have"} no recorded date, so {earnings.undatedRefunds === 1 ? "it is" : "they are"} only included under All time.
              </p>
            ) : null}
            {access.viewer === "SUPER_ADMIN" ? (
              <p className={t.small}>
                You are viewing as Super Admin. Teachers see this page once you mark them as a revenue partner on <Link href="/admin/sirah/classroom/live#revenue-partners">Live classes</Link>.
              </p>
            ) : null}
          </div>
        </section>
      </main>
      <footer className={t.foot}>
        <b>Sīrah · Beyond Chronology</b> · The Global Awakening
      </footer>
    </div>
  );
}
