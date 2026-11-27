import { requireAdminAccess } from "@/lib/auth/admin";
import { prisma } from "@/lib/prisma";
import { presignPrivateAttachment } from "@/lib/sirah/direct-upload";

export async function GET(request: Request) {
  const denied = requireAdminAccess(request);
  if (denied) return denied;
  const registrationId = new URL(request.url).searchParams.get("id") || "";
  const payment = await prisma.payment.findUnique({ where: { registrationId }, select: { manualSubmission: { select: { screenshotUrl: true } } } });
  const key = payment?.manualSubmission?.screenshotUrl;
  if (!key || !/^uploads\/[0-9a-f-]{36}\/[\w.-]{1,100}$/.test(key)) return new Response("Receipt not found.", { status: 404 });
  const url = await presignPrivateAttachment({ key, contentType: null, filename: key.split("/").at(-1) || "payment-receipt", expiresIn: 60 });
  return new Response(null, { status: 303, headers: { Location: url, "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
}
