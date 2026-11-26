import { taskAdminRole } from "@/lib/lms/task-admin-access";
import { presignPrivateAttachment, DOCUMENT_URL_SECONDS } from "@/lib/sirah/spaces";
import { readSirahReceipt } from "@/services/sirah-receipts.service";
import { sirahResponseError } from "@/lib/sirah/http";
import { SirahError } from "@/services/sirah-registration.service";
export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!await taskAdminRole()) throw new SirahError("Receipt not found.", 404);
    const receipt = await readSirahReceipt((await params).id, null, true);
    if (receipt.storageKey) return new Response(null, { status: 303, headers: { Location: await presignPrivateAttachment({ key: receipt.storageKey, contentType: receipt.mime, filename: receipt.filename, expiresIn: DOCUMENT_URL_SECONDS }), "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
    return new Response(new Uint8Array(receipt.data), { headers: { "Content-Type": receipt.mime, "Content-Disposition": `attachment; filename="${receipt.filename.replace(/["\\\r\n]/g, "_")}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox; default-src 'none'" } });
  } catch (error) { return sirahResponseError(error); }
}
