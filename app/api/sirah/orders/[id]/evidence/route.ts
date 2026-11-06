import {
  checkSirahOrigin,
  sirahUser,
  sirahResponseError,
  privateJson,
} from "@/lib/sirah/http";
import {
  submitSirahEvidence,
  MAX_SIRAH_RECEIPT_BYTES,
} from "@/services/sirah-receipts.service";
import { SirahError } from "@/services/sirah-registration.service";
import { sirahEvidenceSchema } from "@/lib/sirah/validation";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    checkSirahOrigin(request);
    const user = await sirahUser();
    const reader = request.body?.getReader();
    if (!reader) throw new SirahError("Missing upload.");
    let length = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.byteLength;
      if (length > MAX_SIRAH_RECEIPT_BYTES + 65536) {
        await reader.cancel();
        throw new SirahError("The upload exceeds 4 MB.", 413);
      }
      chunks.push(part.value);
    }
    const body = await new Response(Buffer.concat(chunks), {
      headers: { "Content-Type": request.headers.get("content-type") || "" },
    }).formData();
    const input = JSON.parse(String(body.get("details") || "{}"));
    const parsed = sirahEvidenceSchema.safeParse(input);
    if (!parsed.success)
      throw new SirahError("Please check the payment-submission fields.");
    const file = body.get("receipt");
    const content =
      file instanceof File && file.size
        ? { data: new Uint8Array(await file.arrayBuffer()), name: file.name }
        : null;
    return privateJson(
      await submitSirahEvidence(
        (await params).id,
        user.id,
        parsed.data,
        content,
        String(body.get("acceptedTermsVersion") || ""),
      ),
    );
  } catch (error) {
    return sirahResponseError(error);
  }
}
