import { sirahReadAccess, privateJson, sirahResponseError } from "@/lib/sirah/http";
import { listSirahScholarships } from "@/services/sirah-scholarship-admin.service";

export async function GET(request: Request) {
  try {
    await sirahReadAccess(request);
    return privateJson(await listSirahScholarships(new URL(request.url).searchParams));
  } catch (error) { return sirahResponseError(error); }
}
