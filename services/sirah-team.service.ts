import "server-only";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

export async function authenticateSirahViewer(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user || user.role !== "SIRAH_VIEWER" || user.status !== "ACTIVE") return null;
  return await bcrypt.compare(password, user.passwordHash) ? user : null;
}

/** Operator-only provisioning; not exposed by a public HTTP endpoint. */
export async function provisionSirahViewer(email: string, fullName: string) {
  email = email.trim().toLowerCase();
  const password = randomBytes(24).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.$transaction(async tx => {
    const user = await tx.user.findUnique({ where: { email } });
    if (user && user.role !== "SIRAH_VIEWER") throw new Error("This email belongs to an existing non-team account. Choose a different login.");
    if (user) {
      const changed = await tx.user.updateMany({ where: { id: user.id, role: "SIRAH_VIEWER" }, data: { fullName, passwordHash, status: "ACTIVE" } });
      if (changed.count !== 1) throw new Error("The account changed during provisioning. No credentials were replaced.");
      await tx.session.deleteMany({ where: { userId: user.id } });
    } else {
      // A concurrent student registration must fail on the unique email, rather than be overwritten.
      await tx.user.create({ data: { email, fullName, passwordHash, role: "SIRAH_VIEWER", status: "ACTIVE", phoneCountryCode: "", phoneNumber: "" } });
    }
  });
  return { email, password };
}
