import { prisma } from "@/lib/prisma";
import { requireAdminAccess } from "@/lib/auth/admin";
import { NextResponse } from "next/server";
import { getSirahWorkspaceAccess } from "@/lib/auth/sirah-workspace";
import { SIRAH_SLUG } from "@/lib/sirah/catalog";
import { SIRAH_SCHOLARSHIP_BATCH } from "@/lib/sirah/scholarship";
export const runtime = "nodejs";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAdminAccess(request);
  if (denied) {
    const access = await getSirahWorkspaceAccess(request);
    if (!access) return denied;
    const application = await prisma.freeWarriorApplication.findFirst({ where: { id: (await params).id, courseSlug: SIRAH_SLUG, scholarshipBatch: SIRAH_SCHOLARSHIP_BATCH }, select: { id: true } });
    if (!application) return NextResponse.json({ error: "Receipt not found." }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  }
  const receipt = await prisma.freeWarriorReceipt.findUnique({ where: { applicationId: (await params).id } });
  if (!receipt) return NextResponse.json({ error: "Receipt not found." }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  return new Response(new Uint8Array(receipt.data), { headers: {
    "Content-Type": receipt.mime,
    "Content-Disposition": `attachment; filename="${receipt.filename.replace(/["\\\r\n]/g, "_")}"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "sandbox; default-src 'none'",
  } });
}
