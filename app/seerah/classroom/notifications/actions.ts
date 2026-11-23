"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionIdentity } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { markAllRead, markRead } from "@/lib/lms/notifications";
import { INBOX_PATH } from "@/lib/lms/student-phase5";

/* A student's own inbox. Every action is scoped to the signed-in user's id,
 * so another user's notification id is a no-op. */

async function requireUser() {
  const user = await getSessionIdentity();
  if (!user) redirect("/login");
  return user;
}

const idFrom = (form: FormData) => {
  const value = form.get("id");
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,191}$/.test(value) ? value : "";
};

/** Only same-site paths: a stored link can never send a student off-site. */
const internal = (link: string | null | undefined) => (link && /^\/(?!\/)[\w\-./#?=&%]*$/.test(link) ? link : INBOX_PATH);

export async function markNotificationRead(form: FormData) {
  const user = await requireUser();
  await markRead(user.id, idFrom(form));
  revalidatePath(INBOX_PATH);
  redirect(INBOX_PATH);
}

export async function markAllNotificationsRead() {
  const user = await requireUser();
  await markAllRead(user.id);
  revalidatePath(INBOX_PATH);
  redirect(INBOX_PATH);
}

/** Open: mark read, then go to what it is about. */
export async function openNotification(form: FormData) {
  const user = await requireUser();
  const id = idFrom(form);
  const row = id ? await prisma.lmsNotification.findFirst({ where: { id, userId: user.id }, select: { link: true } }) : null;
  if (row) await markRead(user.id, id);
  revalidatePath(INBOX_PATH);
  redirect(internal(row?.link));
}
