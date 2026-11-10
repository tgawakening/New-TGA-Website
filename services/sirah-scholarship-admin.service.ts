import "server-only";
import type { Prisma, FreeWarriorApplicationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SIRAH_SLUG } from "@/lib/sirah/catalog";
import { SIRAH_SCHOLARSHIP_BATCH } from "@/lib/sirah/scholarship";
import { parseFreeWarriorContribution } from "@/lib/free-warrior";
import { SirahError } from "./sirah-registration.service";

export async function listSirahScholarships(params: URLSearchParams) {
  const q = (params.get("q") || "").trim().slice(0, 150);
  const status = params.get("status") || "";
  if (status && !["PENDING", "APPROVED", "REJECTED"].includes(status)) throw new SirahError("Choose a valid application status.");
  const page = Math.max(1, Math.min(10000, Math.floor(Number(params.get("page")) || 1)));
  const pageSize = 25;
  const scope = { courseSlug: SIRAH_SLUG, scholarshipBatch: SIRAH_SCHOLARSHIP_BATCH };
  const where: Prisma.FreeWarriorApplicationWhereInput = { ...scope, ...(status ? { status: status as FreeWarriorApplicationStatus } : {}), ...(q ? { OR: [{ fullName: { contains: q } }, { email: { contains: q } }, { whatsapp: { contains: q } }] } : {}) };
  const [rows, total, approved] = await Promise.all([
    prisma.freeWarriorApplication.findMany({ where, include: { receipt: { select: { filename: true, method: true } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
    prisma.freeWarriorApplication.count({ where }),
    prisma.freeWarriorApplication.count({ where: { ...scope, status: "APPROVED" } }),
  ]);
  return { rows: rows.map(row => ({ ...row, contribution: parseFreeWarriorContribution(row.reasonForWaiver) })), total, approved, page, pageSize };
}
