import { getSessionIdentity } from "@/lib/auth/session";
import { taskAdminRole } from "@/lib/lms/task-admin-access";
import { studentTaskDetail } from "@/lib/lms/tasks";
import { prisma } from "@/lib/prisma";
import { DOCUMENT_URL_SECONDS, presignPrivateAttachment } from "@/lib/sirah/spaces";
import { sirahResponseError } from "@/lib/sirah/http";
import { SirahError } from "@/services/sirah-registration.service";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const file = await prisma.lmsTaskAttachment.findUnique({ where: { id: (await params).id }, include: { submission: { select: { taskId: true, studentId: true } } } });
    if (!file) throw new SirahError("File not found.", 404);
    const admin = await taskAdminRole();
    if (!admin) {
      const user = await getSessionIdentity(request);
      if (!user || user.id !== file.submission.studentId || !await studentTaskDetail(user.id, file.submission.taskId)) throw new SirahError("File not found.", 404);
    }
    const url = await presignPrivateAttachment({ key: file.storageKey, contentType: file.contentType, filename: file.filename, expiresIn: DOCUMENT_URL_SECONDS });
    return new Response(null, { status: 303, headers: { Location: url, "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
  } catch (error) { return sirahResponseError(error); }
}
