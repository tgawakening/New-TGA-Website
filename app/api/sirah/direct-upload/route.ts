import { checkSirahOrigin, privateJson, sirahResponseError } from "@/lib/sirah/http";
import { MINUTE, sirahClientIp, sirahRateLimit } from "@/lib/sirah/rate-limit";
import { createDirectUpload } from "@/lib/sirah/direct-upload";
import { directUploadOwner } from "@/lib/sirah/direct-upload-auth";
import { SirahError } from "@/services/sirah-registration.service";
import type { UploadPurpose } from "@/lib/sirah/direct-upload-policy";

export async function POST(request: Request) {
  try {
    checkSirahOrigin(request);
    const limited = sirahRateLimit([{ key: `direct-upload:${sirahClientIp(request)}`, limit: 60, windowMs: MINUTE }]);
    if (limited) return limited;
    const { purpose, scope, filename, size } = await request.json() as { purpose: UploadPurpose; scope: string; filename: string; size: number };
    if (!( ["registration", "evidence", "task", "agreement", "admin-registration"] as string[]).includes(purpose) || typeof scope !== "string" || !/^[A-Za-z0-9_-]{1,191}$/.test(scope) || typeof filename !== "string" || filename.length > 191) throw new SirahError("Invalid upload request.");
    const owner = await directUploadOwner(request, purpose, scope);
    return privateJson(await createDirectUpload(purpose, scope, owner, filename, size));
  } catch (error) { return sirahResponseError(error); }
}
