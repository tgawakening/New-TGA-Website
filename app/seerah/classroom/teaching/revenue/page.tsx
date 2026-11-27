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

export default async function TeacherEarningsPage({ searchParams }: { searchParams?: Promise<{ period?: string; host?: string }> } = {}) {
  const identity = await getSessionIdentity();
  const access = await teacherEarningsAccess(identity);
  if (!access.allowed) {
    if (!identity) redirect("/login");
    notFound();
  }
  const now = new Date();
  const query = (await searchParams) ?? {};
  const period = reportPeriod(query.period ?? "all", now);
  // A teacher sees only their own partner host; the Super Admin can choose any partner.
  const host = access.hosts.find(item => item.id === query.host) ?? access.hosts[0] ?? null;
  const earnings = await sirahTeacherEarnings(period, host);
  const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const stamp = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Karachi" });
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
              {host && access.viewer === "SUPER_ADMIN" ? `${host.email}'s` : "Your"} agreed share ({earnings.percent}%{host?.customShare ? "" : ", the course default"}) of what {earnings.title ?? "the course"} received after refunds, less any outstanding advance. Each currency is shown on its own, never converted.
            </p>
          </div>
          <form method="get" className={t.periodForm}>
            {access.hosts.length > 1 ? (
              <label className={t.field}>
                Teacher
                <select name="host" defaultValue={host?.id}>
                  {access.hosts.map(item => <option key={item.id} value={item.id}>{item.email}</option>)}
                </select>
              </label>
            ) : host ? <input type="hidden" name="host" value={host.id} /> : null}
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
                    <div className={t.line}><dt>Your share ({earnings.percent}%)</dt><dd className={row.shareMinor < 0 ? t.negative : ""}>{money(row.shareMinor, row.currency)}</dd></div>
                    <div className={t.line}><dt>Outstanding advances</dt><dd className={row.advanceMinor > 0 ? t.negative : ""}>{row.advanceMinor > 0 ? `− ${money(row.advanceMinor, row.currency)}` : money(0, row.currency)}</dd></div>
                    <div className={`${t.line} ${t.total}`}><dt>Net payable to you</dt><dd className={row.payableMinor < 0 ? t.negative : ""}>{row.payableMinor < 0 ? `− ${money(-row.payableMinor, row.currency)}` : money(row.payableMinor, row.currency)}</dd></div>
                  </dl>
                </article>
              ))}
            </div>
          ) : (
            <p className={t.empty}>No money received in this period yet.</p>
          )}
        </section>

        <section className={t.section} aria-labelledby="advances">
          <div className={t.sectionHead}>
            <h2 id="advances" className={t.sectionTitle}>Advances</h2>
            <span className={t.sectionMeta}>All time · deducted from your share</span>
          </div>
          {earnings.history.length ? (
            <ul className={t.rows}>
              {earnings.history.map(entry => (
                <li key={entry.id} className={t.row}>
                  <span className={`${t.chip} ${entry.amountMinor > 0 ? t.chipLive : t.chipDone}`}>{entry.amountMinor > 0 ? "Advance" : "Reduced"}</span>
                  <span className={t.rowMain}>
                    <span className={t.rowTitle}>{entry.reason}</span>
                    <span className={t.rowMeta}>
                      <span>{date.format(entry.occurredOn)}</span>
                      <span>Recorded by {entry.createdBy}, {stamp.format(entry.createdAt)}</span>
                    </span>
                  </span>
                  <span className={t.rowActions}>
                    <strong className={entry.amountMinor > 0 ? t.negative : ""}>{entry.amountMinor > 0 ? `− ${money(entry.amountMinor, entry.currency)}` : `+ ${money(-entry.amountMinor, entry.currency)}`}</strong>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={t.empty}>No advances recorded.</p>
          )}
        </section>

        <section className={t.section} aria-labelledby="notes">
          <h2 id="notes" className={c.srOnly}>Notes</h2>
          <div className={t.grid}>
            <p className={t.note}>
              Net payable is your share for the period shown, less every advance still outstanding. When an advance is recovered, the course team records a reduction and it appears above.
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
                You are viewing as Super Admin. Teachers see this page once you mark them as a revenue partner on <Link href="/admin/sirah/classroom/live#revenue-partners">Live classes</Link>, where you also set each teacher&apos;s share and record advances.{access.hosts.length ? "" : " No teacher is marked as a revenue partner yet, so the course default share is shown with no advances."}
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
