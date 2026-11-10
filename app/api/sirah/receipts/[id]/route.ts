import { prisma } from "@/lib/prisma";
import { currentSirahResumeGrant } from "@/lib/sirah/resume";
import { getCurrentUser } from "@/lib/auth/session";
import { requireAdminAccess } from "@/lib/auth/admin";
import { readSirahReceipt } from "@/services/sirah-receipts.service";
import { sirahResponseError } from "@/lib/sirah/http";
import { getSirahWorkspaceAccess } from "@/lib/auth/sirah-workspace";
import { SIRAH_SLUG } from "@/lib/sirah/catalog";
import { SirahError } from "@/services/sirah-registration.service";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const fullAdmin = !requireAdminAccess(request);
    const access = fullAdmin ? { readOnly: false } : await getSirahWorkspaceAccess(request);
    const admin = !!access;
    const user = admin ? null : await getCurrentUser();
    const id = (await params).id;
    if (access?.readOnly && !await prisma.sirahReceipt.findFirst({ where: { id, order: { course: { slug: SIRAH_SLUG } } }, select: { id: true } })) throw new SirahError("Receipt not found.", 404);
    let ownerId = user?.status === "ACTIVE" ? user.id : null;
    if (!admin && !ownerId) {
      const grant = await currentSirahResumeGrant();
      const scopedReceipt = grant
        ? await prisma.sirahReceipt.findFirst({
            where: { id, orderId: grant.orderId },
            select: { id: true },
          })
        : null;
      if (grant && scopedReceipt) ownerId = grant.order.userId;
    }
    const receipt = await readSirahReceipt(id, ownerId, admin);
    return new Response(new Uint8Array(receipt.data), {
      headers: {
        "Content-Type": receipt.mime,
        "Content-Disposition": `attachment; filename="${receipt.filename.replace(/["\\\r\n]/g, "_")}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox; default-src 'none'",
      },
    });
  } catch (error) {
    return sirahResponseError(error);
  }
}
