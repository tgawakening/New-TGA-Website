import { prisma } from "@/lib/prisma";
import { currentSirahResumeGrant } from "@/lib/sirah/resume";
import { getCurrentUser } from "@/lib/auth/session";
import { requireAdminAccess } from "@/lib/auth/admin";
import { readSirahReceipt } from "@/services/sirah-receipts.service";
import { sirahResponseError } from "@/lib/sirah/http";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = !requireAdminAccess(request);
    const user = admin ? null : await getCurrentUser();
    const id = (await params).id;
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
