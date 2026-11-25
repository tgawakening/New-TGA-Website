import { notFound } from "next/navigation";
import { getSessionIdentity } from "@/lib/auth/session";
import { getSirahWorkspaceAccess } from "@/lib/auth/sirah-workspace";
import { hostsForIdentity } from "@/lib/lms/schedule";
import { prisma } from "@/lib/prisma";
import { SIRAH_SLUG, formatSirahMoney } from "@/lib/sirah/catalog";
import { INCLUDED_ORDERS } from "@/lib/sirah/admin-records";
import { sirahPaymentTotals } from "@/services/sirah-payment-totals.service";
import { sirahMethodLabel } from "@/lib/sirah/payment-totals";
import { ClassroomHeader, SectionHead } from "@/components/indigo/classroom/parts";
import s from "@/components/indigo/classroom/classroom.module.css";

export const dynamic = "force-dynamic";
export default async function TeacherRevenuePage() {
  const admin = await getSirahWorkspaceAccess();
  const identity = await getSessionIdentity();
  const hosts = await hostsForIdentity(identity);
  const partner = hosts.length ? await prisma.zoomHost.findFirst({ where: { id: { in: hosts.map(host => host.id) }, active: true, revenuePartner: true, sessions: { some: {} } }, select: { id: true } }) : null;
  if (!partner && !(admin && ["SUPER_ADMIN", "MANAGER"].includes(admin.role))) notFound();
  const [totals, orders] = await Promise.all([
    sirahPaymentTotals(new URLSearchParams()),
    prisma.sirahOrder.findMany({ where: { ...INCLUDED_ORDERS, course: { slug: SIRAH_SLUG }, paidCount: { gt: 0 } }, select: { userId: true, enrolmentState: true } }),
  ]);
  const paid = new Set(orders.map(order => order.userId)).size;
  const enrolled = new Set(orders.filter(order => order.enrolmentState === "ACTIVE").map(order => order.userId)).size;
  return <div className={s.page}><ClassroomHeader home="/seerah/classroom/teaching" week={null} percent={null} back={{ href: "/seerah/classroom/teaching", label: "Dashboard" }} /><main className={s.wrap}>
    <section className={s.hero}><h1>Course revenue and partnership</h1><p>Paid students: {paid} | Active paid enrolments: {enrolled}</p><p>Verified collections and recorded refunds for Sirah. Amounts stay in their original currency.</p></section>
    <section className={s.section}><SectionHead id="revenue">Revenue</SectionHead>{totals.truncated && <p>Results exceed the reporting limit; ask an administrator for a complete report.</p>}{!totals.truncated && (totals.currencies.length ? totals.currencies.map(currency => <div key={currency.currency}><h2>{currency.currency}</h2><p>Collected: {formatSirahMoney(currency.receivedMinor, currency.currency)} | Refunded: {formatSirahMoney(currency.refundedMinor, currency.currency)} | Net: {formatSirahMoney(currency.netMinor, currency.currency)}</p><ul>{currency.methods.map(method => <li key={method.method}>{sirahMethodLabel(method.method)}: {formatSirahMoney(method.receivedMinor, currency.currency)} collected</li>)}</ul></div>) : <p>No verified collections yet.</p>)}</section>
  </main></div>;
}
