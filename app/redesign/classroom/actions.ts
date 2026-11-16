"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { gateFrom, getSirahStudentAccess, setLessonComplete } from "@/services/sirah-classroom.service";

const BASE = "/redesign/classroom";

/** Preview twin of app/seerah/classroom/actions.ts. Same enrolment check on
 * every call, same service, the student is the signed-in account; it only
 * returns to the preview pages instead of the live ones. */
export async function toggleLessonCompletePreview(form: FormData) {
  const access = await getSirahStudentAccess();
  if (!access.user) redirect("/login");
  if (!access.allowed) redirect("/dashboard");
  const lessonId = String(form.get("lessonId") || "");
  const complete = form.get("complete") === "true";
  const result = await setLessonComplete(gateFrom(access), lessonId, complete);
  if (!result.ok) redirect(BASE);
  // Progress is shared with the live classroom: refresh both.
  revalidatePath("/seerah/classroom");
  revalidatePath(`/seerah/classroom/${lessonId}`);
  revalidatePath(BASE);
  revalidatePath(`${BASE}/${lessonId}`);
  const back = form.get("return");
  redirect(back === `${BASE}/${lessonId}` ? back : BASE);
}
