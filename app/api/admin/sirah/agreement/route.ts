import { taskAdminRole } from "@/lib/lms/task-admin-access";
import { prisma } from "@/lib/prisma";
import { checkSirahOrigin, privateJson, sirahExclusionActor, sirahReadAccess, sirahResponseError } from "@/lib/sirah/http";
import { verifyDirectUpload, readDirectUpload } from "@/lib/sirah/direct-upload";
import { presignPrivateAttachment, DOCUMENT_URL_SECONDS } from "@/lib/sirah/spaces";
import { SirahError } from "@/services/sirah-registration.service";

export async function GET(request: Request) {
  try {
    if (!await taskAdminRole()) throw new SirahError("Admin access is required.", 403);
    const access = await sirahReadAccess(request);
    if (access.role === "COMMUNITY_LEAD") throw new SirahError("Student records are not available for this role.", 403);
    const orderId = new URL(request.url).searchParams.get("id") || "";
    const file = await prisma.sirahAgreement.findUnique({ where: { orderId } });
    if (!file) throw new SirahError("Agreement not found.", 404);
    if (file.storageKey) return new Response(null, { status: 303, headers: { Location: await presignPrivateAttachment({ key: file.storageKey, contentType: file.mime, filename: file.filename, expiresIn: DOCUMENT_URL_SECONDS }), "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
    return new Response(new Uint8Array(file.data), { headers: { "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=agreement.pdf", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return sirahResponseError(error); }
}
export async function POST(request: Request) {
  try {
    checkSirahOrigin(request);
    if (!await taskAdminRole()) throw new SirahError("Admin access is required.", 403);
    const actor = await sirahExclusionActor(request);
    const form = await request.formData();
    const id = form.get("id"), token = form.get("uploadToken");
    if (typeof id !== "string" || typeof token !== "string") throw new SirahError("Choose an uploaded PDF.");
    const order = await prisma.sirahOrder.findUnique({ where: { id }, select: { id: true } });
    if (!order) throw new SirahError("Registration not found.", 404);
    if (await prisma.sirahAgreement.findUnique({ where: { orderId: id }, select: { id: true } })) throw new SirahError("An agreement is already attached.", 409);
    const uploaded = await verifyDirectUpload(token, "agreement", id, actor);
    const bytes = await readDirectUpload(uploaded.key);
    if (Buffer.from(bytes.subarray(0, 5)).toString() !== "%PDF-") throw new SirahError("Choose a valid PDF.");
    await prisma.sirahAgreement.create({ data: { orderId: id, filename: uploaded.filename, mime: "application/pdf", data: Buffer.alloc(0), storageKey: uploaded.key } });
    return privateJson({ ok: true });
  } catch (error) { return sirahResponseError(error); }
}
