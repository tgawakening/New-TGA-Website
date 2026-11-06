import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Read-only rollout check. Never creates or baselines production tables. */
export async function sirahSchemaAvailable() {
  try {
    await prisma.sirahOrder.findFirst({ select: { id: true } });
    return true;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2021"
    )
      return false;
    throw error;
  }
}
