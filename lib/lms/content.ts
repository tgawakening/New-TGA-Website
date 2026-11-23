import "server-only";
import { Prisma, type LmsAnnouncement, type LmsResource, type LmsVisibility } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DOCUMENT_URL_SECONDS, RECORDING_URL_SECONDS, type FileSigner } from "@/lib/sirah/spaces";
import { isAssignedHost, sirahStudentCohortAccess } from "./access";

/**
 * LMS Phase 5 content: resources (files and links) and announcements, per
 * cohort. Staff and hosts write; students read only what is PUBLISHED for
 * their own cohort, after the same paid + active + cohort rule the join route
 * uses (sirahStudentCohortAccess). An uploaded file reaches a student only as
 * a short-lived presigned GET from /api/sirah/lms/resources/[id]; its storage
 * key and the bucket are never sent to a browser.
 */

export const RESOURCE_TITLE_MAX = 191;
export const ANNOUNCEMENT_TITLE_MAX = 191;
export const ANNOUNCEMENT_BODY_MAX = 10_000;
export const RESOURCE_URL_MAX = 1024;

export class LmsContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LmsContentError";
  }
}

/** Read-only rollout check: false until the Phase 5 migration is deployed. Never creates tables. */
export async function lmsContentAvailable() {
  try {
    await Promise.all([
      prisma.lmsResource.findFirst({ select: { id: true } }),
      prisma.lmsAnnouncement.findFirst({ select: { id: true } }),
      prisma.lmsNotification.findFirst({ select: { id: true } }),
    ]);
    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") return false;
    throw error;
  }
}

/* ---------- Validation ---------- */

export function cleanTitle(value: unknown, max = RESOURCE_TITLE_MAX) {
  const title = typeof value === "string" ? value.trim() : "";
  if (!title) throw new LmsContentError("Enter a title.");
  if (title.length > max) throw new LmsContentError(`The title is longer than ${max} characters.`);
  return title;
}

/** Only https links reach a student's browser (no javascript:, data: or http:). */
export function cleanHttpsUrl(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) throw new LmsContentError("Enter the link.");
  if (raw.length > RESOURCE_URL_MAX) throw new LmsContentError("That link is too long.");
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") throw new Error("not https");
    return url.toString();
  } catch {
    throw new LmsContentError("Enter a full https:// link.");
  }
}

function cleanBody(value: unknown) {
  const body = typeof value === "string" ? value.trim() : "";
  if (!body) throw new LmsContentError("Write the announcement.");
  if (body.length > ANNOUNCEMENT_BODY_MAX) throw new LmsContentError(`The announcement is longer than ${ANNOUNCEMENT_BODY_MAX} characters.`);
  return body;
}

/* ---------- Scope: a cohort, or one of its sessions ---------- */

export type ResourceScope = { cohortId: string; sessionId?: undefined } | { sessionId: string; cohortId?: undefined };

async function checkScope(scope: ResourceScope) {
  if (scope.sessionId) {
    const session = await prisma.lmsSession.findUnique({ where: { id: scope.sessionId }, select: { id: true, cohortId: true } });
    if (!session) throw new LmsContentError("That session no longer exists.");
    return { cohortId: null, sessionId: session.id, sessionCohortId: session.cohortId };
  }
  if (!scope.cohortId) throw new LmsContentError("Choose a cohort or a session.");
  const cohort = await prisma.sirahCohort.findUnique({ where: { batchCode: scope.cohortId }, select: { batchCode: true } });
  if (!cohort) throw new LmsContentError("That cohort does not exist.");
  return { cohortId: cohort.batchCode, sessionId: null, sessionCohortId: null };
}

/** The cohort a resource belongs to: its own, else its session's. */
export async function resourceCohortId(resource: Pick<LmsResource, "cohortId" | "sessionId">) {
  if (resource.cohortId) return resource.cohortId;
  if (!resource.sessionId) return null;
  const session = await prisma.lmsSession.findUnique({ where: { id: resource.sessionId }, select: { cohortId: true } });
  return session?.cohortId ?? null;
}

/** A host may manage the resources of the sessions they are the assigned host of. */
export async function hostMaySessionResources(identity: { email: string } | null, sessionId: string) {
  if (!identity) return false;
  const session = await prisma.lmsSession.findUnique({
    where: { id: sessionId },
    select: { zoomHost: { select: { email: true, active: true } } },
  });
  return Boolean(session && isAssignedHost(identity, session.zoomHost));
}

/* ---------- Resources: writes ---------- */

export async function createLinkResource(input: { scope: ResourceScope; title: unknown; url: unknown; uploadedBy: string }) {
  const title = cleanTitle(input.title);
  const url = cleanHttpsUrl(input.url);
  const { cohortId, sessionId } = await checkScope(input.scope);
  return prisma.lmsResource.create({
    data: { cohortId, sessionId, title, kind: "LINK", url, storageKey: null, visibility: "HIDDEN", publishedAt: null, uploadedBy: input.uploadedBy.slice(0, 320) },
  });
}

/** Step two of an upload, after the server has read the stored object back. */
export async function createFileResource(input: {
  scope: ResourceScope;
  title: unknown;
  storageKey: string;
  contentType: string;
  sizeBytes: number;
  originalFilename: string | null;
  uploadedBy: string;
}) {
  const title = cleanTitle(input.title);
  const { cohortId, sessionId } = await checkScope(input.scope);
  if (await prisma.lmsResource.findUnique({ where: { storageKey: input.storageKey }, select: { id: true } }))
    throw new LmsContentError("That file is already attached.");
  return prisma.lmsResource.create({
    data: {
      cohortId,
      sessionId,
      title,
      kind: "FILE",
      url: null,
      storageKey: input.storageKey,
      contentType: input.contentType,
      sizeBytes: BigInt(input.sizeBytes),
      originalFilename: input.originalFilename?.slice(0, 255) ?? null,
      visibility: "HIDDEN",
      publishedAt: null,
      uploadedBy: input.uploadedBy.slice(0, 320),
    },
  });
}

/** Publish or hide. publishedAt keeps the first publication time. Returns
 * whether this call made it PUBLISHED (the caller then notifies; the
 * notification keys make a re-publish a no-op anyway). */
export async function setResourceVisibility(id: string, visibility: LmsVisibility, now = new Date()) {
  const resource = await prisma.lmsResource.findUnique({ where: { id } });
  if (!resource) throw new LmsContentError("That resource no longer exists.");
  const updated = await prisma.lmsResource.update({
    where: { id },
    data: { visibility, publishedAt: visibility === "PUBLISHED" ? (resource.publishedAt ?? now) : resource.publishedAt },
  });
  return { resource: updated, published: visibility === "PUBLISHED" && resource.visibility !== "PUBLISHED" };
}

/** Deletes the row; returns the storage key so the caller can remove the object (best effort). */
export async function deleteResource(id: string) {
  const resource = await prisma.lmsResource.findUnique({ where: { id }, select: { storageKey: true } });
  if (!resource) return null;
  await prisma.lmsResource.deleteMany({ where: { id } });
  return { storageKey: resource.storageKey };
}

export async function getResource(id: string) {
  return prisma.lmsResource.findUnique({ where: { id } });
}

/* ---------- Resources and announcements: reads ---------- */

const byNewest = <T extends { createdAt: Date }>(a: T, b: T) => b.createdAt.getTime() - a.createdAt.getTime();
const byPublishedNewest = <T extends { publishedAt: Date | null; createdAt: Date }>(a: T, b: T) =>
  (b.publishedAt ?? b.createdAt).getTime() - (a.publishedAt ?? a.createdAt).getTime();

export type AdminResourceRow = LmsResource & { sessionTitle: string | null };

/** Staff view: every resource of the cohort and of its sessions, newest first. */
export async function adminCohortContent(cohortId: string) {
  const sessions = await prisma.lmsSession.findMany({ where: { cohortId }, select: { id: true, title: true, startsAt: true, status: true } });
  const sessionTitle = new Map(sessions.map((s) => [s.id, s.title]));
  const [resources, announcements] = await Promise.all([
    prisma.lmsResource.findMany({
      where: { OR: [{ cohortId }, ...(sessions.length ? [{ sessionId: { in: sessions.map((s) => s.id) } }] : [])] },
      orderBy: { createdAt: "desc" },
    }),
    prisma.lmsAnnouncement.findMany({ where: { cohortId }, orderBy: { createdAt: "desc" } }),
  ]);
  return {
    sessions: [...sessions].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()),
    resources: resources.sort(byNewest).map((r) => ({ ...r, sessionTitle: r.sessionId ? (sessionTitle.get(r.sessionId) ?? null) : null })),
    announcements: announcements.sort(byNewest),
  };
}

/** A session's resources (host and staff views), newest first. */
export async function sessionResources(sessionId: string) {
  const rows = await prisma.lmsResource.findMany({ where: { sessionId }, orderBy: { createdAt: "desc" } });
  return rows.sort(byNewest);
}

/** What a student sees: nothing unless enrolled; then their cohort's PUBLISHED
 * resources (cohort-wide and per session) and published announcements. A
 * row is never returned with its storage key. */
export type StudentResource = {
  id: string;
  title: string;
  kind: "FILE" | "LINK";
  href: string;
  sessionId: string | null;
  sessionTitle: string | null;
  publishedAt: Date | null;
  contentType: string | null;
  sizeBytes: number | null;
};
export type StudentAnnouncement = Pick<LmsAnnouncement, "id" | "title" | "body" | "publishedAt">;

export const resourceFilePath = (id: string) => `/api/sirah/lms/resources/${encodeURIComponent(id)}`;

export async function studentContent(userId: string, now = new Date()) {
  const access = await sirahStudentCohortAccess(userId, now);
  if (!access.allowed || !access.cohortId) return { allowed: false as const, resources: [] as StudentResource[], announcements: [] as StudentAnnouncement[] };
  const cohortId = access.cohortId;
  const sessions = await prisma.lmsSession.findMany({ where: { cohortId }, select: { id: true, title: true } });
  const sessionTitle = new Map(sessions.map((s) => [s.id, s.title]));
  const [resources, announcements] = await Promise.all([
    prisma.lmsResource.findMany({
      where: {
        visibility: "PUBLISHED",
        OR: [{ cohortId }, ...(sessions.length ? [{ sessionId: { in: sessions.map((s) => s.id) } }] : [])],
      },
    }),
    prisma.lmsAnnouncement.findMany({ where: { cohortId, publishedAt: { not: null } } }),
  ]);
  return {
    allowed: true as const,
    resources: resources
      .filter((r) => r.visibility === "PUBLISHED")
      .sort(byPublishedNewest)
      .map(
        (r): StudentResource => ({
          id: r.id,
          title: r.title,
          kind: r.kind,
          // A link is shown as itself (https only, checked on save); a file
          // only ever as the enrolment-checked route.
          href: r.kind === "LINK" ? (r.url ?? "") : resourceFilePath(r.id),
          sessionId: r.sessionId,
          sessionTitle: r.sessionId ? (sessionTitle.get(r.sessionId) ?? null) : null,
          publishedAt: r.publishedAt,
          contentType: r.kind === "FILE" ? r.contentType : null,
          sizeBytes: r.kind === "FILE" && r.sizeBytes !== null ? Number(r.sizeBytes) : null,
        }),
      )
      .filter((r) => r.href),
    announcements: announcements
      .filter((a) => a.publishedAt && a.publishedAt <= now)
      .sort(byPublishedNewest)
      .map(({ id, title, body, publishedAt }) => ({ id, title, body, publishedAt })),
  };
}

/* ---------- Student file access ---------- */

export type ResourceFileAccess =
  | { kind: "login" }
  | { kind: "denied" }
  | { kind: "missing" }
  | { kind: "redirect"; url: string; expiresIn: number };

const isMedia = (contentType: string | null) => Boolean(contentType && /^(audio|video)\//.test(contentType));

/** Signed-in, paid + active, in the resource's cohort, and the resource is a
 * PUBLISHED file -> a short-lived presigned GET. Anything else never causes a
 * signature, and a missing or hidden resource looks the same as one in
 * another cohort. */
export async function resolveResourceFile(resourceId: string, userId: string | null, sign: FileSigner, now = new Date()): Promise<ResourceFileAccess> {
  if (!userId) return { kind: "login" };
  const access = await sirahStudentCohortAccess(userId, now);
  if (!access.allowed || !access.cohortId) return { kind: "denied" };
  const resource = await prisma.lmsResource.findUnique({ where: { id: resourceId } });
  if (!resource || resource.kind !== "FILE" || resource.visibility !== "PUBLISHED" || !resource.storageKey) return { kind: "missing" };
  if ((await resourceCohortId(resource)) !== access.cohortId) return { kind: "missing" };
  const expiresIn = isMedia(resource.contentType) ? RECORDING_URL_SECONDS : DOCUMENT_URL_SECONDS;
  const url = await sign({ key: resource.storageKey, contentType: resource.contentType, filename: resource.originalFilename, expiresIn });
  return { kind: "redirect", url, expiresIn };
}

/* ---------- Announcements: writes ---------- */

export async function createAnnouncement(input: { cohortId: string; title: unknown; body: unknown; publish: boolean; createdBy: string; now?: Date }) {
  const title = cleanTitle(input.title, ANNOUNCEMENT_TITLE_MAX);
  const body = cleanBody(input.body);
  const cohort = await prisma.sirahCohort.findUnique({ where: { batchCode: input.cohortId }, select: { batchCode: true } });
  if (!cohort) throw new LmsContentError("That cohort does not exist.");
  return prisma.lmsAnnouncement.create({
    data: { cohortId: cohort.batchCode, title, body, publishedAt: input.publish ? (input.now ?? new Date()) : null, createdBy: input.createdBy.slice(0, 320) },
  });
}

export async function updateAnnouncement(id: string, input: { title: unknown; body: unknown }) {
  const title = cleanTitle(input.title, ANNOUNCEMENT_TITLE_MAX);
  const body = cleanBody(input.body);
  const result = await prisma.lmsAnnouncement.updateMany({ where: { id }, data: { title, body } });
  if (!result.count) throw new LmsContentError("That announcement no longer exists.");
  return prisma.lmsAnnouncement.findUniqueOrThrow({ where: { id } });
}

/** Publish (keeps the first publication time) or take back to draft. */
export async function setAnnouncementPublished(id: string, publish: boolean, now = new Date()) {
  const announcement = await prisma.lmsAnnouncement.findUnique({ where: { id } });
  if (!announcement) throw new LmsContentError("That announcement no longer exists.");
  const updated = await prisma.lmsAnnouncement.update({
    where: { id },
    data: { publishedAt: publish ? (announcement.publishedAt ?? now) : null },
  });
  return { announcement: updated, published: publish && !announcement.publishedAt };
}

export async function deleteAnnouncement(id: string) {
  await prisma.lmsAnnouncement.deleteMany({ where: { id } });
}
