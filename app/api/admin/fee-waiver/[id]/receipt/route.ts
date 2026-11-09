import { prisma } from "@/lib/prisma";
import { requireAdminAccess } from "@/lib/auth/admin";
import { NextResponse } from "next/server";
export const runtime = "nodejs";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAdminAccess(request);
  if (denied) return denied;
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
