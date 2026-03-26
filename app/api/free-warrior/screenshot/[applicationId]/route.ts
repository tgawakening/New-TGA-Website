import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAccess } from "@/lib/auth/admin";

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return {
    mimeType: match[1],
    bytes: Buffer.from(match[2], "base64"),
  };
}

export async function GET(request: Request, context: { params: Promise<{ applicationId: string }> }) {
  const denied = requireAdminAccess(request);
  if (denied) return denied;

  const { applicationId } = await context.params;
  const application = await prisma.freeWarriorApplication.findUnique({
    where: { id: applicationId },
    select: {
      transactionScreenshotData: true,
      transactionScreenshotName: true,
    },
  });

  if (!application?.transactionScreenshotData) {
    return NextResponse.json({ error: "Screenshot not found." }, { status: 404 });
  }

  const parsed = parseDataUrl(application.transactionScreenshotData);
  if (!parsed) {
    return NextResponse.json({ error: "Stored screenshot data is invalid." }, { status: 500 });
  }

  return new NextResponse(parsed.bytes, {
    headers: {
      "Content-Type": parsed.mimeType,
      "Content-Disposition": `inline; filename="${application.transactionScreenshotName ?? "fee-warrior-screenshot"}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
