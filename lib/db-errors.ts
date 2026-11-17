import { Prisma } from "@prisma/client";

/** Shown to people when the database can't be reached. Never the raw error. */
export const DATABASE_UNAVAILABLE_MESSAGE =
  "We can't sign you in right now because our system is temporarily unavailable. Please try again in a few minutes.";

/* Prisma codes for "couldn't reach / lost / timed out on the database". */
const UNREACHABLE_CODES = new Set(["P1001", "P1002", "P1008", "P1011", "P1017", "P2024"]);

/** True when the error means the database is unreachable (not a bad query). */
export function isDatabaseUnavailable(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  if (error instanceof Prisma.PrismaClientRustPanicError) return true;
  if (error instanceof Prisma.PrismaClientKnownRequestError) return UNREACHABLE_CODES.has(error.code);
  if (error instanceof Prisma.PrismaClientUnknownRequestError) return true;
  return false;
}
