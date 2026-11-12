import "server-only";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  SIRAH_TEAM_ROLES,
  isProtectedSuperAdminEmail,
  teamChangeRefusal,
} from "@/lib/sirah/team-guard";

/** Actor recorded for changes made by the operator CLI scripts. */
const CLI_ACTOR = "operator:cli";

type AccessChange = {
  actor: string;
  action: "ADD_LEAD" | "PROMOTE" | "DEMOTE" | "REVOKE";
  targetUserId: string | null;
  targetEmail: string;
  fromRole: string | null;
  toRole: string | null;
  fromStatus: string | null;
  toStatus: string | null;
};
/** Append-only access audit row, written in the same transaction as the change,
 * so a change can never commit without its record (or vice versa). */
async function recordAccessChange(tx: Prisma.TransactionClient, change: AccessChange) {
  await tx.sirahAccessAudit.create({
    data: { ...change, actor: change.actor.slice(0, 320) },
  });
}

/** Explicit operator grant; preserves the shared password and all other account data. */
export async function grantSirahScholarshipApproval(email: string, actor = CLI_ACTOR) {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user || user.status !== "ACTIVE" || !["SIRAH_VIEWER", "SIRAH_REVIEWER"].includes(user.role)) throw new Error("An active Sīrah team account is required.");
  if (user.role === "SIRAH_REVIEWER") return { granted: true, changed: false };
  return prisma.$transaction(async tx => {
    const result = await tx.user.updateMany({ where: { id: user.id, role: "SIRAH_VIEWER", status: "ACTIVE" }, data: { role: "SIRAH_REVIEWER" } });
    if (result.count !== 1) throw new Error("Account changed; review the permission grant again.");
    await recordAccessChange(tx, { actor, action: "PROMOTE", targetUserId: user.id, targetEmail: user.email, fromRole: "SIRAH_VIEWER", toRole: "SIRAH_REVIEWER", fromStatus: "ACTIVE", toStatus: "ACTIVE" });
    return { granted: true, changed: true };
  });
}

export async function authenticateSirahViewer(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user || !["SIRAH_VIEWER", "SIRAH_REVIEWER"].includes(user.role) || user.status !== "ACTIVE") return null;
  return await bcrypt.compare(password, user.passwordHash) ? user : null;
}

/** Operator-only provisioning; not exposed by a public HTTP endpoint. */
export async function provisionSirahViewer(email: string, fullName: string, actor = CLI_ACTOR) {
  email = email.trim().toLowerCase();
  const password = randomBytes(24).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.$transaction(async tx => {
    const user = await tx.user.findUnique({ where: { email } });
    if (user && !["SIRAH_VIEWER", "SIRAH_REVIEWER"].includes(user.role)) throw new Error("This email belongs to an existing non-team account. Choose a different login.");
    if (user) {
      const changed = await tx.user.updateMany({ where: { id: user.id, role: user.role }, data: { fullName, passwordHash, status: "ACTIVE" } });
      if (changed.count !== 1) throw new Error("The account changed during provisioning. No credentials were replaced.");
      await tx.session.deleteMany({ where: { userId: user.id } });
      await recordAccessChange(tx, { actor, action: "ADD_LEAD", targetUserId: user.id, targetEmail: email, fromRole: user.role, toRole: user.role, fromStatus: user.status, toStatus: "ACTIVE" });
    } else {
      // A concurrent student registration must fail on the unique email, rather than be overwritten.
      const created = await tx.user.create({ data: { email, fullName, passwordHash, role: "SIRAH_VIEWER", status: "ACTIVE", phoneCountryCode: "", phoneNumber: "" } });
      await recordAccessChange(tx, { actor, action: "ADD_LEAD", targetUserId: created.id, targetEmail: email, fromRole: null, toRole: "SIRAH_VIEWER", fromStatus: null, toStatus: "ACTIVE" });
    }
  });
  const account = await prisma.user.findUniqueOrThrow({ where: { email }, select: { role: true } });
  return { email, password, role: account.role };
}

// --------------------------------------------------------------------------
// Access & roles (env Super Admin only; every guard is enforced here, server-side).
// --------------------------------------------------------------------------

/** Team accounts (Managers and Community Leads), including revoked ones. */
export async function listSirahTeam() {
  const rows = await prisma.user.findMany({
    where: { role: { in: [...SIRAH_TEAM_ROLES] } },
    select: { id: true, email: true, fullName: true, role: true, status: true, createdAt: true },
    orderBy: [{ status: "asc" }, { role: "desc" }, { fullName: "asc" }],
  });
  return rows.map((row) => ({
    ...row,
    roleLabel: row.role === "SIRAH_REVIEWER" ? "Manager" : "Community Lead",
  }));
}

async function teamTarget(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, status: true },
  });
  if (!user) throw new Error("Team account not found.");
  return user;
}

/** Add (or re-activate, with a fresh password) a Community Lead login. */
export async function addSirahCommunityLead(email: string, fullName: string, actor: string) {
  if (isProtectedSuperAdminEmail(email))
    throw new Error("The Super Admin email cannot be added as a team account.");
  return provisionSirahViewer(email, fullName, actor);
}

/** Community Lead → Manager (reuses the existing explicit grant). */
export async function promoteSirahTeamMember(userId: string, actor: string) {
  const user = await teamTarget(userId);
  const refusal = teamChangeRefusal("PROMOTE", user);
  if (refusal) throw new Error(refusal);
  return grantSirahScholarshipApproval(user.email, actor);
}

/** Manager → Community Lead. Role is read per request, so it applies at once. */
export async function demoteSirahManager(userId: string, actor: string) {
  const user = await teamTarget(userId);
  const refusal = teamChangeRefusal("DEMOTE", user);
  if (refusal) throw new Error(refusal);
  return prisma.$transaction(async (tx) => {
    const result = await tx.user.updateMany({
      where: { id: user.id, role: "SIRAH_REVIEWER", status: "ACTIVE" },
      data: { role: "SIRAH_VIEWER" },
    });
    if (result.count !== 1) throw new Error("Account changed; reload and try again.");
    await recordAccessChange(tx, { actor, action: "DEMOTE", targetUserId: user.id, targetEmail: user.email, fromRole: "SIRAH_REVIEWER", toRole: "SIRAH_VIEWER", fromStatus: "ACTIVE", toStatus: "ACTIVE" });
    return { demoted: true };
  });
}

/** Revoke: suspend the account and end every session it has. */
export async function revokeSirahTeamAccess(userId: string, actor: string) {
  const user = await teamTarget(userId);
  const refusal = teamChangeRefusal("REVOKE", user);
  if (refusal) throw new Error(refusal);
  return prisma.$transaction(async (tx) => {
    const result = await tx.user.updateMany({
      where: { id: user.id, role: { in: [...SIRAH_TEAM_ROLES] }, status: "ACTIVE" },
      data: { status: "SUSPENDED" },
    });
    if (result.count !== 1) throw new Error("Account changed; reload and try again.");
    const sessions = await tx.session.deleteMany({ where: { userId: user.id } });
    await recordAccessChange(tx, { actor, action: "REVOKE", targetUserId: user.id, targetEmail: user.email, fromRole: user.role, toRole: user.role, fromStatus: "ACTIVE", toStatus: "SUSPENDED" });
    return { revoked: true, sessionsEnded: sessions.count };
  });
}

/** Most recent access changes, newest first (Super Admin view). */
export async function listSirahAccessAudit(limit = 50) {
  return prisma.sirahAccessAudit.findMany({
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 200),
  });
}
