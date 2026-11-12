import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SIRAH_SLUG } from "@/lib/sirah/catalog";
import { auditSirah, SirahError } from "./sirah-registration.service";

export const sirahGroupStatusSchema = z
  .object({ orderId: z.string().min(1).max(64), added: z.boolean() })
  .strict();

/**
 * Staff-confirmed "added to the course group" marker. It writes only
 * groupAddedAt / groupAddedBy plus an audit row. It deliberately does not bump
 * `revision`, so a concurrent payment action is never forced to reload, and it
 * never touches payment, enrolment or invitation state.
 */
export async function setSirahGroupAdded(
  input: z.infer<typeof sirahGroupStatusSchema>,
  actor: string,
) {
  const order = await prisma.sirahOrder.findFirst({
    where: { id: input.orderId, course: { slug: SIRAH_SLUG } },
    select: { id: true, groupAddedAt: true },
  });
  if (!order) throw new SirahError("Registration not found.", 404);
  if (!!order.groupAddedAt === input.added)
    return { changed: false, added: input.added, groupAddedAt: order.groupAddedAt };
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    // Conditional on the current state: a double-click or two staff toggling
    // at once records the change exactly once.
    const changed = await tx.sirahOrder.updateMany({
      where: {
        id: order.id,
        groupAddedAt: input.added ? null : { not: null },
      },
      data: input.added
        ? { groupAddedAt: now, groupAddedBy: actor }
        : { groupAddedAt: null, groupAddedBy: null },
    });
    if (!changed.count)
      return { changed: false, added: input.added, groupAddedAt: null };
    await auditSirah(tx, order.id, actor, input.added ? "GROUP_ADDED" : "GROUP_REMOVED", {
      previouslyAddedAt: order.groupAddedAt?.toISOString() ?? null,
    });
    return {
      changed: true,
      added: input.added,
      groupAddedAt: input.added ? now : null,
    };
  });
}

/** Overview counts over all Sīrah registrations (same scope as Students). */
export async function sirahOverviewCounts() {
  const scope = { course: { slug: SIRAH_SLUG } };
  const paidActive = {
    ...scope,
    paymentState: "PAID",
    enrolmentState: { in: ["ACTIVE", "COMPLETED"] },
  };
  const [total, paid, pending, needsReview, groupAdded, groupNotAdded] =
    await Promise.all([
      prisma.sirahOrder.count({ where: scope }),
      prisma.sirahOrder.count({ where: { ...scope, paymentState: "PAID" } }),
      prisma.sirahOrder.count({
        where: {
          ...scope,
          enrolmentState: "PENDING",
          paymentState: {
            in: ["UNPAID", "PROCESSING", "AWAITING_REVIEW", "FAILED", "REJECTED"],
          },
        },
      }),
      prisma.sirahOrder.count({
        where: { ...scope, paymentState: { in: ["AWAITING_REVIEW", "PROCESSING", "FAILED"] } },
      }),
      prisma.sirahOrder.count({ where: { ...paidActive, groupAddedAt: { not: null } } }),
      prisma.sirahOrder.count({ where: { ...paidActive, groupAddedAt: null } }),
    ]);
  return { total, paid, pending, needsReview, groupAdded, groupNotAdded };
}
