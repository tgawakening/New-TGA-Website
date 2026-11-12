import {
  checkSirahOrigin,
  sirahUser,
  sirahResponseError,
  privateJson,
} from "@/lib/sirah/http";
import { submitSirahEvidence } from "@/services/sirah-receipts.service";
import { SirahError } from "@/services/sirah-registration.service";
import { sirahRequiredEvidenceSchema } from "@/lib/sirah/registration-payment";
import { readSirahMultipart } from "@/lib/sirah/multipart";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    checkSirahOrigin(request);
    const user = await sirahUser((await params).id);
    const body = await readSirahMultipart(request).catch(() => {
      throw new SirahError("Upload a JPG, PNG, WebP or PDF receipt up to 4 MB.", 413);
    });
    const input = JSON.parse(String(body.get("details") || "{}"));
    const parsed = sirahRequiredEvidenceSchema.safeParse(input);
    if (!parsed.success)
      throw new SirahError("Please check the payment-submission fields.");
    const file = body.get("receipt");
    const content =
      file instanceof File && file.size
        ? { data: new Uint8Array(await file.arrayBuffer()), name: file.name }
        : null;
    if (!content) throw new SirahError("A payment receipt is required.");
    return privateJson(
      await submitSirahEvidence(
        (await params).id,
        user.id,
        parsed.data,
        content,
        String(body.get("acceptedTermsVersion") || ""),
        {
          earlyServiceRequested: body.get("earlyServiceRequested") === "true",
          digitalContentConsented:
            body.get("digitalContentConsented") === "true",
        },
      ),
    );
  } catch (error) {
    return sirahResponseError(error);
  }
}
