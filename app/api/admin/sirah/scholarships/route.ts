import { sirahReadAccess, checkSirahOrigin, privateJson, sirahResponseError } from "@/lib/sirah/http";
import { listSirahScholarships, approveSirahScholarship } from "@/services/sirah-scholarship-admin.service";
import { freeWarriorReviewSchema } from "@/lib/validations/free-warrior";
import { getSessionIdentity } from "@/lib/auth/session";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { SirahError } from "@/services/sirah-registration.service";
import { z } from "zod";

export async function GET(request: Request) {
  try {
    await sirahReadAccess(request);
    return privateJson(await listSirahScholarships(new URL(request.url).searchParams));
  } catch (error) { return sirahResponseError(error); }
}

export async function POST(request: Request) {
  try {
    checkSirahOrigin(request);
    const access = await sirahReadAccess(request);
    if (!access.canApproveScholarships) throw new SirahError("Scholarship approval permission is required.", 403);
    const input = freeWarriorReviewSchema.extend({ approve: z.literal(true) }).strict().safeParse(await request.json());
    if (!input.success) throw new SirahError("Choose a pending application and a review note of at most 500 characters.", 400);
    const actor = access.readOnly ? (await getSessionIdentity(request))?.email : (await getCurrentAdmin())?.email || "admin-api";
    if (!actor) throw new SirahError("Sign in again before approving.", 401);
    return privateJson({ application: await approveSirahScholarship(input.data.applicationId, input.data.note, actor) });
  } catch (error) { return sirahResponseError(error); }
}
