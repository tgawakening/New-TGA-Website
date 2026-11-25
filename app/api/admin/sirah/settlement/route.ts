import { checkSirahOrigin, privateJson, sirahExclusionActor, sirahResponseError } from "@/lib/sirah/http";
import { createBalanceLink } from "@/services/sirah-settlement.service";
import { SirahError } from "@/services/sirah-registration.service";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    checkSirahOrigin(request);
    const actor = await sirahExclusionActor(request);
    const body = await request.json();
    if (typeof body.id !== "string" || body.id.length > 191) throw new SirahError("Invalid registration.");
    return privateJson(await createBalanceLink(body.id, actor));
  } catch (error) { return sirahResponseError(error); }
}
