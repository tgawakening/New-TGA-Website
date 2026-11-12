import { NextResponse } from "next/server";
import { z } from "zod";
import {
  checkSirahOrigin,
  sirahAdmin,
  sirahResponseError,
  privateJson,
} from "@/lib/sirah/http";
import {
  addSirahCommunityLead,
  demoteSirahManager,
  listSirahAccessAudit,
  listSirahTeam,
  promoteSirahTeamMember,
  revokeSirahTeamAccess,
} from "@/services/sirah-team.service";
import { SirahError } from "@/services/sirah-registration.service";

// Access & roles: env Super Admin only. sirahAdmin() throws 401 for every
// team session (Manager and Community Lead), students and anonymous callers.
const actionSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("ADD_LEAD"),
      email: z.string().trim().toLowerCase().email().max(254),
      fullName: z.string().trim().min(2).max(190),
    })
    .strict(),
  z.object({ action: z.literal("PROMOTE"), userId: z.string().min(1).max(64) }).strict(),
  z.object({ action: z.literal("DEMOTE"), userId: z.string().min(1).max(64) }).strict(),
  z.object({ action: z.literal("REVOKE"), userId: z.string().min(1).max(64) }).strict(),
]);

export async function GET(request: Request) {
  try {
    await sirahAdmin(request);
    const [rows, changes] = await Promise.all([listSirahTeam(), listSirahAccessAudit()]);
    return privateJson({ rows, changes });
  } catch (error) {
    return sirahResponseError(error);
  }
}

export async function POST(request: Request) {
  try {
    checkSirahOrigin(request);
    // Audit actor: "admin:<email>" (signed-in Super Admin) or "admin-api:<hash>".
    const actor = await sirahAdmin(request);
    const parsed = actionSchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json({ error: "Check the access change request." }, { status: 400 });
    const input = parsed.data;
    try {
      if (input.action === "ADD_LEAD") {
        const login = await addSirahCommunityLead(input.email, input.fullName, actor);
        // The generated password is returned once, to the Super Admin only.
        return privateJson({ added: true, email: login.email, password: login.password, role: login.role });
      }
      if (input.action === "PROMOTE")
        return privateJson(await promoteSirahTeamMember(input.userId, actor));
      if (input.action === "DEMOTE")
        return privateJson(await demoteSirahManager(input.userId, actor));
      return privateJson(await revokeSirahTeamAccess(input.userId, actor));
    } catch (cause) {
      if (cause instanceof SirahError) throw cause;
      throw new SirahError(
        cause instanceof Error ? cause.message : "The access change was refused.",
        409,
      );
    }
  } catch (error) {
    return sirahResponseError(error);
  }
}
