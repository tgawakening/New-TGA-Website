import "server-only";
import { prisma } from "@/lib/prisma";
import { DOCUMENT_URL_SECONDS, RECORDING_URL_SECONDS, type FileSigner } from "@/lib/sirah/spaces";
import type { StudentGate } from "./sirah-classroom.service";

/** Uploaded classroom files reach a student only through here: the enrolment
 * check runs first, and only then is a short-lived presigned GET issued. A
 * signed-out or non-enrolled viewer never causes a signature, and never learns
 * whether a material exists. */

export const classroomFilePath = (materialId: string) => `/seerah/classroom/files/${encodeURIComponent(materialId)}`;

export type FileAccess =
  | { kind: "login" }
  | { kind: "denied" }
  | { kind: "missing" }
  | { kind: "redirect"; url: string; expiresIn: number };

export async function resolveMaterialFile(materialId: string, gate: StudentGate, sign: FileSigner): Promise<FileAccess> {
  if (!gate.studentId) return { kind: "login" };
  if (!gate.allowed) return { kind: "denied" };
  const material = await prisma.sirahMaterial.findUnique({ where: { id: materialId } });
  if (!material || material.storage !== "UPLOAD" || !material.objectKey) return { kind: "missing" };
  const expiresIn = material.kind === "RECORDING" ? RECORDING_URL_SECONDS : DOCUMENT_URL_SECONDS;
  const url = await sign({
    key: material.objectKey,
    contentType: material.contentType,
    filename: material.originalFilename,
    expiresIn,
  });
  return { kind: "redirect", url, expiresIn };
}

const NO_STORE = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };

/** The GET handler for /seerah/classroom/files/[materialId], built from its
 * dependencies so tests can run the real handler with a mocked signer. */
export function materialFileHandler(deps: {
  gate: () => Promise<StudentGate>;
  sign: FileSigner;
  configured: () => boolean;
  loginPath?: string;
  deniedPath?: string;
}) {
  return async function GET(request: Request, context: { params: Promise<{ materialId: string }> }) {
    const { materialId } = await context.params;
    const gate = await deps.gate();
    const to = (path: string) => new URL(path, request.url).toString();
    if (!gate.studentId) return new Response(null, { status: 302, headers: { ...NO_STORE, Location: to(deps.loginPath ?? "/login") } });
    if (!gate.allowed) return new Response(null, { status: 302, headers: { ...NO_STORE, Location: to(deps.deniedPath ?? "/dashboard") } });
    if (!deps.configured()) return new Response("File storage is not configured.", { status: 503, headers: NO_STORE });
    const access = await resolveMaterialFile(materialId, gate, deps.sign);
    if (access.kind !== "redirect") return new Response("Not found.", { status: 404, headers: NO_STORE });
    return new Response(null, { status: 302, headers: { ...NO_STORE, Location: access.url } });
  };
}
