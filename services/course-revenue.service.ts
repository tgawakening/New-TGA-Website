import "server-only";
import { prisma } from "@/lib/prisma";
import { SIRAH_SLUG } from "@/lib/sirah/catalog";
import { addMoney, moneyGroups, planNextDueTotals, revenueProgram, type CourseIdentity } from "@/lib/sirah/course-revenue";
import type { PlanTerms, StoredPeriod } from "@/lib/sirah/payment-plan";

type Payment = { id: string; amount: number; currency: string; provider: string; status: string; paidAt: Date | null; createdAt: Date; rawPayloadJson: unknown };
type Legacy = { id: string; paymentReference: string | null; pricingSnapshot: unknown; course: CourseIdentity; status: string; finalAmount: number; selectedCurrency: string; payment: Payment | null };
type Event = { id: string; provider: string; amountMinor: number; currency: string; createdAt: Date };
type Ledger = { id: string; method: string; amountMinor: number; currency: string; receivedAt: Date };
type Order = { reference: string; course: CourseIdentity; currency: string; amountMinor: number; paymentState: string; enrolmentState: string; events: Event[]; ledgerPayments: Ledger[]; paymentPlan: (PlanTerms & { periods: StoredPeriod[] }) | null };
type Bucket = { id: string; title: string; received: Map<string, number>; methods: Map<string, number>; pending: Map<string, number>; due: Map<string, number>; upcoming: Map<string, number>; ambiguous: Map<string, number>; pendingCount: number; review: { id: string; reference: string; amountMinor: number; currency: string; method: string; receivedAt: Date }[]; latest: Date | null };
const method = (value: string) => value === "BANK" ? "BANK_TRANSFER" : value;
const DAY = 24 * 60 * 60 * 1000;

/** Conservative comparison: candidates are reviewed separately, never silently doubled. */
function couldMatch(entry: Ledger, event: Event) {
  return entry.currency === event.currency && entry.amountMinor === event.amountMinor && method(entry.method) === method(event.provider) && Math.abs(entry.receivedAt.getTime() - event.createdAt.getTime()) < 2 * DAY;
}
function legacySettlementProven(registration: Legacy, payment: Payment) {
  const payload = payment.rawPayloadJson && typeof payment.rawPayloadJson === "object" && !Array.isArray(payment.rawPayloadJson) ? payment.rawPayloadJson as Record<string, unknown> : {};
  if (payment.provider === "STRIPE") return payload.payment_status === "paid";
  if (payment.provider === "PAYPAL") {
    const snapshot = registration.pricingSnapshot && typeof registration.pricingSnapshot === "object" && !Array.isArray(registration.pricingSnapshot) ? registration.pricingSnapshot as Record<string, unknown> : {};
    return snapshot.selectedPaymentPlanType === "FULL_COURSE" && payload.status === "COMPLETED";
  }
  return true; // Staff-confirmed manual methods.
}
export function aggregateCourseRevenue(courses: CourseIdentity[], registrations: Legacy[], orders: Order[], now = new Date()) {
  const buckets = new Map<string, Bucket>();
  function bucket(course: CourseIdentity, source: "legacy" | "sirah") {
    const identity = revenueProgram(course, source);
    let b = buckets.get(identity.id);
    if (!b) { b = { ...identity, received: new Map(), methods: new Map(), pending: new Map(), due: new Map(), upcoming: new Map(), ambiguous: new Map(), pendingCount: 0, review: [], latest: null }; buckets.set(identity.id, b); }
    return b;
  }
  function received(b: Bucket, currency: string, provider: string, amount: number, at: Date | null) {
    addMoney(b.received, currency, amount); addMoney(b.methods, `${currency}\0${method(provider)}`, amount);
    if (at && (!b.latest || at > b.latest)) b.latest = at;
  }
  for (const course of courses) {
    bucket(course, "legacy");
    if (course.slug === SIRAH_SLUG) bucket(course, "sirah");
  }
  for (const r of registrations) {
    const b = bucket(r.course, "legacy");
    const verified = r.payment && ["SUCCEEDED", "CONFIRMED"].includes(r.payment.status);
    if (r.payment && verified && legacySettlementProven(r, r.payment)) received(b, r.payment.currency, r.payment.provider, r.payment.amount, r.payment.paidAt);
    else if (r.payment && verified) { b.review.push({ id: r.payment.id, reference: r.paymentReference ?? r.id, amountMinor: r.payment.amount, currency: r.payment.currency, method: r.payment.provider, receivedAt: r.payment.paidAt ?? r.payment.createdAt }); addMoney(b.ambiguous, r.payment.currency, r.payment.amount); }
    else if (["PENDING_PAYMENT", "MANUAL_REVIEW"].includes(r.status)) { b.pendingCount++; addMoney(b.pending, r.selectedCurrency, r.finalAmount); }
  }
  for (const order of orders) {
    const b = bucket(order.course, "sirah");
    for (const event of order.events) received(b, event.currency, event.provider, event.amountMinor, event.createdAt);
    for (const entry of order.ledgerPayments) {
      const matches = order.events.filter(event => couldMatch(entry, event));
      // Staff-created paid registrations write both records atomically; a
      // unique match is a known duplicate, not additional revenue.
      if (matches.length === 1 && matches[0].id.startsWith("admin-paid:") && order.ledgerPayments.filter(other => couldMatch(other, matches[0])).length === 1) continue;
      // The legacy ledger has no link proving whether other entries on this
      // order are the same money as an event. Keep them visible for review.
      if (order.events.length) { b.review.push({ id: entry.id, reference: order.reference, amountMinor: entry.amountMinor, currency: entry.currency, method: entry.method, receivedAt: entry.receivedAt }); addMoney(b.ambiguous, entry.currency, entry.amountMinor); continue; }
      received(b, entry.currency, entry.method, entry.amountMinor, entry.receivedAt);
    }
    const pending = ["UNPAID", "PROCESSING", "AWAITING_REVIEW"].includes(order.paymentState) && !["CANCELLED", "COMPLETED"].includes(order.enrolmentState);
    if (pending) { b.pendingCount++; if (!order.paymentPlan) addMoney(b.pending, order.currency, order.amountMinor); }
    if (order.paymentPlan && !["CANCELLED", "COMPLETED"].includes(order.enrolmentState)) {
      const plan = planNextDueTotals(order.paymentPlan, order.paymentPlan.periods, now);
      addMoney(b.due, order.currency, plan.dueMinor); addMoney(b.upcoming, order.currency, plan.upcomingMinor);
    }
  }
  const all = { received: new Map<string, number>(), pending: new Map<string, number>(), due: new Map<string, number>(), upcoming: new Map<string, number>(), ambiguous: new Map<string, number>() };
  const programs = [...buckets.values()].sort((a, b) => a.title.localeCompare(b.title)).map(b => {
    for (const key of ["received", "pending", "due", "upcoming", "ambiguous"] as const) for (const [currency, amount] of b[key]) addMoney(all[key], currency, amount);
    return { id: b.id, title: b.title, received: moneyGroups(b.received), pending: moneyGroups(b.pending), due: moneyGroups(b.due), upcoming: moneyGroups(b.upcoming), ambiguous: moneyGroups(b.ambiguous), pendingCount: b.pendingCount, review: b.review, latest: b.latest, methods: [...b.methods].sort(([a], [c]) => a.localeCompare(c)).map(([key, amountMinor]) => { const [currency, method] = key.split("\0"); return { currency, method, amountMinor }; }) };
  });
  const pendingUpcoming = new Map<string, number>();
  for (const map of [all.pending, all.due, all.upcoming]) for (const [currency, amount] of map) addMoney(pendingUpcoming, currency, amount);
  return { programs, totals: { received: moneyGroups(all.received), pending: moneyGroups(all.pending), due: moneyGroups(all.due), upcoming: moneyGroups(all.upcoming), pendingUpcoming: moneyGroups(pendingUpcoming), ambiguous: moneyGroups(all.ambiguous) } };
}

export async function courseRevenueReport() {
  // Do not call the main admin dashboard loader: it performs payment maintenance writes.
  const [courses, registrations, orders] = await Promise.all([
    prisma.course.findMany({ select: { id: true, slug: true, title: true } }),
    prisma.registration.findMany({ where: { sirahOrder: null }, select: { id: true, paymentReference: true, pricingSnapshot: true, course: { select: { id: true, slug: true, title: true } }, status: true, finalAmount: true, selectedCurrency: true, payment: { select: { id: true, amount: true, currency: true, provider: true, status: true, paidAt: true, createdAt: true, rawPayloadJson: true } } } }),
    prisma.sirahOrder.findMany({ where: { excludedAt: null, archivedAt: null }, select: { reference: true, course: { select: { id: true, slug: true, title: true } }, currency: true, amountMinor: true, paymentState: true, enrolmentState: true, events: { where: { kind: { in: ["FIRST", "RENEWAL"] } }, select: { id: true, provider: true, amountMinor: true, currency: true, createdAt: true } }, ledgerPayments: { select: { id: true, method: true, amountMinor: true, currency: true, receivedAt: true } }, paymentPlan: { include: { periods: { include: { payments: { select: { amountMinor: true } } } } } } } }),
  ]);
  return aggregateCourseRevenue(courses, registrations, orders);
}
