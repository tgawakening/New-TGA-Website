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
    const receipt = await readSirahReceipt(
      (await params).id,
      user?.status === "ACTIVE" ? user.id : null,
      admin,
    );
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
