"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSirahWorkspaceAccess } from "@/lib/auth/sirah-workspace";
import { taskAdminRole } from "@/lib/lms/task-admin-access";
import { prisma } from "@/lib/prisma";
import { taskTarget, validateTask } from "@/lib/lms/tasks";

const base = "/admin/sirah/classroom/tasks";
async function requireEditor() {
  const access = await getSirahWorkspaceAccess();
  if (!access) redirect("/admin/sirah/login");
  if (!(await taskAdminRole())) redirect("/admin/sirah");
}
function value(form: FormData, key: string) { const v = form.get(key); return typeof v === "string" ? v : ""; }
function taskId(form: FormData) { const id = value(form, "id"); return /^[A-Za-z0-9_-]{1,191}$/.test(id) ? id : ""; }
function done(path: string, message: string): never { revalidatePath(base); revalidatePath("/seerah/classroom/schedule"); redirect(`${path}?notice=${encodeURIComponent(message)}`); }
function fail(path: string, error: unknown): never { redirect(`${path}?error=${encodeURIComponent(error instanceof Error && !error.constructor.name.startsWith("Prisma") ? error.message : "Could not save the task.")}`); }

export async function createTask(form: FormData) {
  await requireEditor();
  let id = "";
  try {
    const input = validateTask(value(form, "title"), value(form, "body"));
    const target = await taskTarget(value(form, "target"));
    id = (await prisma.lmsTask.create({ data: { ...input, ...target } })).id;
  } catch (error) { fail(base, error); }
  done(`${base}/${id}`, "Task created as a draft.");
}
export async function updateTask(form: FormData) {
  await requireEditor();
  const id = taskId(form);
  if (!id) fail(base, new Error("Invalid task."));
  const path = `${base}/${id}`;
  try { await prisma.lmsTask.update({ where: { id }, data: validateTask(value(form, "title"), value(form, "body")) }); }
  catch (error) { fail(path, error); }
  done(path, "Task updated.");
}
export async function publishTask(form: FormData) {
  await requireEditor();
  const id = taskId(form);
  if (!id) fail(base, new Error("Invalid task."));
  const path = `${base}/${id}`;
  const publish = value(form, "publish") === "1";
  try { await prisma.lmsTask.update({ where: { id }, data: { publishedAt: publish ? new Date() : null } }); }
  catch (error) { fail(path, error); }
  done(path, publish ? "Task published." : "Task unpublished.");
}
