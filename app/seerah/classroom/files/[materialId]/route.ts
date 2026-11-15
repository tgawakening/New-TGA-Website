import { presignDownload, spacesConfigured } from "@/lib/sirah/spaces";
import { gateFrom, getSirahStudentAccess } from "@/services/sirah-classroom.service";
import { materialFileHandler } from "@/services/sirah-classroom-files.service";

/** Uploaded materials and recordings: enrolment check, then a redirect to a
 * short-lived presigned GET. The bucket itself is never public. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = materialFileHandler({
  gate: async () => gateFrom(await getSirahStudentAccess()),
  sign: presignDownload,
  configured: spacesConfigured,
});
