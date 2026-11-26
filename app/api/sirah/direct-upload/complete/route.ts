import { checkSirahOrigin, privateJson, sirahResponseError } from "@/lib/sirah/http";
import { directUploadOwner } from "@/lib/sirah/direct-upload-auth";
import { readDirectUpload, verifyDirectUpload } from "@/lib/sirah/direct-upload";
import { validateSirahReceipt } from "@/services/sirah-receipts.service";
import { SirahError } from "@/services/sirah-registration.service";
import type { UploadPurpose } from "@/lib/sirah/direct-upload-policy";

export async function POST(request: Request) {
  try {
    checkSirahOrigin(request);
    const { purpose, scope, token } = await request.json() as { purpose: UploadPurpose; scope: string; token: string };
    if (!(["registration", "evidence", "task", "agreement"] as string[]).includes(purpose) || typeof scope !== "string" || !/^[A-Za-z0-9_-]{1,191}$/.test(scope) || typeof token !== "string") throw new SirahError("Invalid upload request.");
    const owner = await directUploadOwner(request, purpose, scope);
    const file = await verifyDirectUpload(token, purpose, scope, owner);
    if (purpose === "registration" || purpose === "evidence") await validateSirahReceipt(await readDirectUpload(file.key), file.filename);
    if (purpose === "agreement" && Buffer.from((await readDirectUpload(file.key)).subarray(0, 5)).toString() !== "%PDF-") throw new SirahError("Choose a valid PDF.");
    return privateJson({ ok: true });
  } catch (error) { return sirahResponseError(error); }
}
