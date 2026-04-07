import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

let registrationPaymentPlanColumnEnsured = false;
let registrationPaymentPlanColumnPromise: Promise<void> | null = null;

function isDuplicateColumnError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("duplicate column") || message.includes("1060");
}

export async function ensureRegistrationPaymentPlanColumn() {
  if (registrationPaymentPlanColumnEnsured) {
    return;
  }

  if (!registrationPaymentPlanColumnPromise) {
    registrationPaymentPlanColumnPromise = prisma.$executeRawUnsafe(`
      ALTER TABLE \`Registration\`
      ADD COLUMN \`paymentPlanType\` ENUM('SUBSCRIPTION', 'FULL_COURSE') NOT NULL DEFAULT 'SUBSCRIPTION'
    `)
      .catch((error) => {
        if (!isDuplicateColumnError(error)) {
          throw error;
        }
      })
      .then(() => {
        registrationPaymentPlanColumnEnsured = true;
      })
      .finally(() => {
        registrationPaymentPlanColumnPromise = null;
      });
  }

  await registrationPaymentPlanColumnPromise;
}
