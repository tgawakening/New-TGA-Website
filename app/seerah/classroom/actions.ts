"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { safeClassroomReturn } from "@/lib/sirah/classroom";
import { gateFrom, getSirahStudentAccess, setLessonComplete } from "@/services/sirah-classroom.service";

/** Server actions are public POST endpoints: this re-runs the shared enrolment
 * check on every call. The student is the signed-in account, never a form
 * field; the form only says which session and which way. */
export async function toggleLessonComplete(form: FormData) {
  const access = await getSirahStudentAccess();
  if (!access.user) redirect("/login");
  if (!access.allowed) redirect("/dashboard");
  const lessonId = String(form.get("lessonId") || "");
  const complete = form.get("complete") === "true";
  const result = await setLessonComplete(gateFrom(access), lessonId, complete);
  if (!result.ok) redirect("/seerah/classroom");
  revalidatePath("/seerah/classroom");
  revalidatePath(`/seerah/classroom/${lessonId}`);
  redirect(safeClassroomReturn(form.get("return"), lessonId));
}
