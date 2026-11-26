import { prisma } from "@/lib/prisma";
import { privateJson, sirahReadAccess, sirahResponseError } from "@/lib/sirah/http";
import { paymentPlanPeriods } from "@/lib/sirah/payment-plan";
import { SirahError } from "@/services/sirah-registration.service";

export async function GET(request: Request) {
  try {
    const access = await sirahReadAccess(request);
    if (access.role === "COMMUNITY_LEAD") throw new SirahError("Student records are not available for this role.", 403);
    const plans = await prisma.sirahPaymentPlan.findMany({ where: { order: { excludedAt: null, archivedAt: null } }, include: { order: { select: { id: true, reference: true, currency: true, batchCode: true, user: { select: { fullName: true, email: true } } } }, periods: { include: { payments: { select: { amountMinor: true } } } } } });
    const rows = plans.flatMap(plan => {
      const overdue = paymentPlanPeriods(plan, plan.periods).filter(period => period.status === "OVERDUE");
      return overdue.length ? [{ ...plan.order, overdueCount: overdue.length, overdueMinor: overdue.reduce((sum, period) => sum + period.amountMinor - period.paidMinor, 0), oldestDueAt: overdue[0].dueAt }] : [];
    }).sort((a, b) => a.oldestDueAt.getTime() - b.oldestDueAt.getTime());
    return privateJson({ rows });
  } catch (error) { return sirahResponseError(error); }
}
