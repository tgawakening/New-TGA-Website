import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkSirahOrigin, privateJson, sirahExclusionActor, sirahResponseError } from "@/lib/sirah/http";
import { readSirahMultipart } from "@/lib/sirah/multipart";
import { scholarshipApplicationSchema } from "@/lib/sirah/scholarship-application";
import { submitApplication, reviewApplication, notifyApplication } from "@/services/sirah-scholarship-application.service";
import { SirahError } from "@/services/sirah-registration.service";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    await sirahExclusionActor(request);
    const status = new URL(request.url).searchParams.get("status");
    const page = Math.max(1, Math.min(10000, Number(new URL(request.url).searchParams.get("page")) || 1));
    const where = status && ["PENDING", "APPROVED", "REJECTED"].includes(status) ? { status } : {};
    const total = await prisma.sirahScholarshipApplication.count({ where });
    const rows = await prisma.sirahScholarshipApplication.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * 50, take: 50, select: { id: true, fullName: true, email: true, phone: true, countryCode: true, courseSlug: true, batchCode: true, arrangementType: true, requestedAmountMinor: true, currency: true, reason: true, documentName: true, status: true, reviewedBy: true, reviewedAt: true, reviewNotes: true, approvedFeeMinor: true, approvedMonthlyMinor: true, orderId: true, notificationState: true, createdBy: true, createdAt: true } });
    return privateJson({ rows, total, page });
  } catch (error) { return sirahResponseError(error); }
}
export async function POST(request: Request) {
  try {
    checkSirahOrigin(request);
    const actor = await sirahExclusionActor(request);
    if (request.headers.get("content-type")?.startsWith("multipart/form-data")) {
      const form = await readSirahMultipart(request).catch(() => { throw new SirahError("Upload a PDF up to 4 MB.", 413); });
      const fields = Object.fromEntries(["fullName", "email", "phone", "countryCode", "arrangementType", "currency", "requestedAmount", "reason"].map(key => [key, String(form.get(key) || "")]));
      const parsed = scholarshipApplicationSchema.safeParse(fields);
      if (!parsed.success) throw new SirahError("Check the applicant details, international phone number and requested amount.");
      const file = form.get("document");
      let document: { name: string; data: Uint8Array } | null = null;
      if (file instanceof File && file.size) {
        if (file.size > 4 * 1024 * 1024 || !file.name.toLowerCase().endsWith(".pdf")) throw new SirahError("Upload a PDF up to 4 MB.");
        const data = new Uint8Array(await file.arrayBuffer());
        if (Buffer.from(data.subarray(0, 5)).toString() !== "%PDF-") throw new SirahError("Upload a valid PDF.");
        document = { name: file.name, data };
      }
      return privateJson(await submitApplication(parsed.data, document, actor));
    }
    const schema = z.discriminatedUnion("action", [z.object({ action: z.literal("review"), id: z.string().min(1).max(191), decision: z.enum(["APPROVED", "REJECTED"]), notes: z.string().trim().max(2000), fee: z.string().max(20).optional(), monthly: z.string().max(20).optional() }).strict(), z.object({ action: z.literal("retry-email"), id: z.string().min(1).max(191) }).strict()]);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) throw new SirahError("Check the review details.");
    if (parsed.data.action === "retry-email") return privateJson({ emailState: await notifyApplication(parsed.data.id) });
    return privateJson(await reviewApplication(parsed.data, actor));
  } catch (error) { return sirahResponseError(error); }
}
