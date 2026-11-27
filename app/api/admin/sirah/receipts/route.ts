import { taskAdminRole } from "@/lib/lms/task-admin-access";
import { checkSirahOrigin, privateJson, sirahExclusionActor, sirahResponseError } from "@/lib/sirah/http";
import { attachAdminSirahReceipt } from "@/services/sirah-receipts.service";
import { SirahError } from "@/services/sirah-registration.service";

export const runtime = "nodejs";

/** Staff attach a receipt received outside the site (WhatsApp, email). Super admin or manager only. */
export async function POST(request: Request) {
  try {
    checkSirahOrigin(request);
    if (!await taskAdminRole()) throw new SirahError("Admin access is required.", 403);
    // Super admin or manager; any other role is refused here.
    const actor = await sirahExclusionActor(request);
    const body = await request.json().catch(() => null) as { id?: unknown; uploadToken?: unknown; note?: unknown } | null;
    const id = body?.id, token = body?.uploadToken, note = body?.note;
    if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,191}$/.test(id) || typeof token !== "string" || token.length > 8192)
      throw new SirahError("Choose an uploaded receipt.");
    if (note !== undefined && note !== null && (typeof note !== "string" || note.length > 500))
      throw new SirahError("Keep the note under 500 characters.");
    return privateJson(await attachAdminSirahReceipt(id, token, actor, typeof note === "string" ? note : undefined));
  } catch (error) { return sirahResponseError(error); }
}
