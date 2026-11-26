import "server-only";
import { getSessionIdentity } from "@/lib/auth/session";
import { taskAdminRole } from "@/lib/lms/task-admin-access";
import { studentTaskDetail } from "@/lib/lms/tasks";
import { sirahExclusionActor, sirahUser } from "@/lib/sirah/http";
import { ownedSirahOrder, SirahError } from "@/services/sirah-registration.service";
import { prisma } from "@/lib/prisma";
import type { UploadPurpose } from "./direct-upload-policy";
export async function directUploadOwner(request: Request, purpose: UploadPurpose, scope: string) {
  let owner: string;
    if (purpose === "registration") {
      if (!/^[0-9a-f-]{36}$/i.test(scope)) throw new SirahError("Invalid registration upload.");
      owner = scope;
    } else if (purpose === "evidence") {
      const user = await sirahUser(scope); await ownedSirahOrder(scope, user.id); owner = user.id;
    } else if (purpose === "task") {
      const user = await getSessionIdentity(request); if (!user || !await studentTaskDetail(user.id, scope)) throw new SirahError("This task is not available.", 403); owner = user.id;
    } else {
      if (!await taskAdminRole()) throw new SirahError("Admin access is required.", 403);
      owner = await sirahExclusionActor(request);
      if (!await prisma.sirahOrder.findUnique({ where: { id: scope }, select: { id: true } })) throw new SirahError("Registration not found.", 404);
    }
  return owner;
}
