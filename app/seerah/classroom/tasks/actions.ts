"use server";
import { revalidatePath } from "next/cache";
import { getSessionIdentity } from "@/lib/auth/session";
import { submitTask } from "@/lib/lms/tasks";

export type AnswerState = { error?: string; submittedAt?: string };
export async function submitTaskAnswer(_state: AnswerState, form: FormData): Promise<AnswerState> {
  const identity = await getSessionIdentity();
  if (!identity) return { error: "Please sign in again before submitting your answer." };
  const id = form.get("taskId"), answer = form.get("answer"), link = form.get("link");
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,191}$/.test(id)) return { error: "This task is not available." };
  try { await submitTask(identity.id, id, typeof answer === "string" ? answer : "", typeof link === "string" ? link : ""); }
  catch (cause) { return { error: cause instanceof Error && !cause.constructor.name.startsWith("Prisma") ? cause.message : "Your answer could not be saved. Please try again." }; }
  revalidatePath(`/seerah/classroom/tasks/${id}`);
  revalidatePath("/seerah/classroom/schedule");
  revalidatePath("/seerah/classroom");
  return { submittedAt: new Date().toISOString() };
}
