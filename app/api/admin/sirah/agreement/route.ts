import { prisma } from "@/lib/prisma";
import { checkSirahOrigin, privateJson, sirahExclusionActor, sirahReadAccess, sirahResponseError } from "@/lib/sirah/http";
import { SirahError } from "@/services/sirah-registration.service";

export async function GET(request: Request) {
  try {
    const access = await sirahReadAccess(request);
    if (access.role === "COMMUNITY_LEAD") throw new SirahError("Student records are not available for this role.", 403);
    const orderId = new URL(request.url).searchParams.get("id") || "";
    const file = await prisma.sirahAgreement.findUnique({ where: { orderId } });
    if (!file) throw new SirahError("Agreement not found.", 404);
    return new Response(new Uint8Array(file.data), { headers: { "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=agreement.pdf", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return sirahResponseError(error); }
}
export async function POST(request: Request) {
  try {
    checkSirahOrigin(request);
    await sirahExclusionActor(request);
    const form = await request.formData();
    const id = form.get("id"), file = form.get("file");
    if (typeof id !== "string" || !(file instanceof File) || file.size < 5 || file.size > 5 * 1024 * 1024 || !file.name.toLowerCase().endsWith(".pdf")) throw new SirahError("Choose a PDF no larger than 5 MB.");
    const data = Buffer.from(await file.arrayBuffer());
    if (data.subarray(0, 5).toString() !== "%PDF-") throw new SirahError("Choose a valid PDF.");
    const order = await prisma.sirahOrder.findUnique({ where: { id }, select: { id: true } });
    if (!order) throw new SirahError("Registration not found.", 404);
    if (await prisma.sirahAgreement.findUnique({ where: { orderId: id }, select: { id: true } })) throw new SirahError("An agreement is already attached.", 409);
    await prisma.sirahAgreement.create({ data: { orderId: id, filename: file.name.slice(0, 191), mime: "application/pdf", data } });
    return privateJson({ ok: true });
  } catch (error) { return sirahResponseError(error); }
}
