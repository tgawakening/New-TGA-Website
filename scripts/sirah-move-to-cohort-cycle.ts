/**
 * Move existing monthly Sīrah students onto the cohort billing cycle
 * (renewal due on the cohort's billing day, grace through its grace day).
 *
 *   Read-only report (default):
 *     node --conditions=react-server --import tsx scripts/sirah-move-to-cohort-cycle.ts
 *   Write the "MOVE" rows (paid-up bank transfer / JazzCash students):
 *     … scripts/sirah-move-to-cohort-cycle.ts --apply
 *   Also move the "REVIEW" rows (paused / overdue; they stay paused):
 *     … scripts/sirah-move-to-cohort-cycle.ts --apply --include-review
 *
 * Card subscriptions (Stripe, PayPal) are reported as KEEP and never changed:
 * the provider charges them on their original date. Each write is guarded by
 * the order's revision and recorded as a BILLING_CYCLE_MOVED audit row with
 * the before and after dates. Run inside the production service console;
 * never copy production credentials elsewhere.
 */
import "server-only";
import { prisma } from "../lib/prisma";
import { SIRAH_SLUG } from "../lib/sirah/catalog";
import { cycleDateLabel } from "../lib/sirah/billing-cycle";
import { planCycleMove, type MovePlan } from "../lib/sirah/billing-cycle-move";
import { sirahBillingCycle } from "../services/sirah-billing-cycle.service";
import { auditSirah } from "../services/sirah-registration.service";

const args = new Set(process.argv.slice(2));
for (const a of args)
  if (!["--apply", "--include-review"].includes(a)) throw Error(`Unknown option ${a}`);
const apply = args.has("--apply");
const includeReview = args.has("--include-review");

const d = (v: Date | null | undefined) => (v ? cycleDateLabel(v) : "—");
/** accessEndsAt is the first instant without access; show the last day with it. */
const lastDay = (v: Date | null | undefined) => (v ? cycleDateLabel(new Date(v.getTime() - 1)) : "—");

async function main() {
  if (!process.env.DATABASE_URL) throw Error("DATABASE_URL is not set.");
  const now = new Date();
  const cycle = await sirahBillingCycle();
  const orders = await prisma.sirahOrder.findMany({
    where: { course: { slug: SIRAH_SLUG }, plan: "MONTHLY", archivedAt: null },
    include: { user: { select: { fullName: true } } },
    orderBy: { createdAt: "asc" },
  });
  console.log(`Cohort cycle: renewal due on day ${cycle.billingDay}, grace through day ${cycle.graceDay} (Pakistan time).`);
  console.log(`As of ${now.toISOString()}. ${apply ? "APPLYING" : "Read-only report (pass --apply to write)."}\n`);

  const rows: { ref: string; name: string; method: string; state: string; paid: number; plan: MovePlan }[] = [];
  for (const o of orders)
    rows.push({
      ref: o.reference,
      name: o.user.fullName,
      method: o.method ?? "—",
      state: `${o.enrolmentState}/${o.paymentState}`,
      paid: o.paidCount,
      plan: planCycleMove(o, now, cycle),
    });

  for (const outcome of ["MOVE", "REVIEW", "KEEP", "SKIP"] as const) {
    const group = rows.filter((r) => r.plan.outcome === outcome);
    console.log(`== ${outcome}: ${group.length}`);
    for (const r of group) {
      const p = r.plan;
      console.log(`- ${r.ref}  ${r.name}  [${r.method}, ${r.state}, ${r.paid}/12 paid]  ${p.reason}`);
      if (p.before && p.after)
        console.log(
          `    renewal ${d(p.before.nextBillingAt)} → ${d(p.after.nextBillingAt)} (${p.shiftDays! >= 0 ? "+" : ""}${p.shiftDays} days)` +
            ` | access until ${lastDay(p.before.accessEndsAt)} → ${lastDay(p.after.accessEndsAt)}` +
            ` | programme end ${d(p.before.programmeEnd)} → ${d(p.after.programmeEnd)}`,
        );
    }
    console.log("");
  }

  if (!apply) return;
  let moved = 0;
  for (const o of orders) {
    const p = planCycleMove(o, now, cycle);
    if (!(p.outcome === "MOVE" || (includeReview && p.outcome === "REVIEW")) || !p.after) continue;
    await prisma.$transaction(async (tx) => {
      const changed = await tx.sirahOrder.updateMany({
        where: { id: o.id, revision: o.revision, cycleFirstDueAt: null },
        data: {
          cycleBillingDay: p.after!.cycleBillingDay,
          cycleGraceDay: p.after!.cycleGraceDay,
          cycleFirstDueAt: p.after!.cycleFirstDueAt,
          nextBillingAt: p.after!.nextBillingAt,
          accessEndsAt: p.after!.accessEndsAt,
          programmeEnd: p.after!.programmeEnd,
          revision: { increment: 1 },
        },
      });
      if (!changed.count) throw Error(`${o.reference} changed during the run; nothing written for it. Re-run the report.`);
      await auditSirah(tx, o.id, "system:billing-cycle-move", "BILLING_CYCLE_MOVED", {
        outcome: p.outcome,
        reason: p.reason,
        cycle,
        before: p.before,
        after: p.after,
        shiftDays: p.shiftDays,
      });
    });
    moved++;
  }
  console.log(`Moved ${moved} order(s).`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
