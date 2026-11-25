import { prisma } from "@/lib/prisma";
import { sirahExclusionActor, sirahResponseError } from "@/lib/sirah/http";
import { SirahError } from "@/services/sirah-registration.service";
export async function GET(request: Request) {
  try {
    await sirahExclusionActor(request);
    const id = new URL(request.url).searchParams.get("id") || "";
    const document = await prisma.sirahScholarshipApplication.findUnique({ where: { id }, select: { documentData: true } });
    if (!document?.documentData) throw new SirahError("Document not found.", 404);
    return new Response(new Uint8Array(document.documentData), { headers: { "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=application-document.pdf", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return sirahResponseError(error); }
}
