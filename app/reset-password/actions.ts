"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { RESET_COOKIE, RESET_COOKIE_PATH } from "@/lib/auth/password-reset-cookie";
import { passwordProblem, resetPassword } from "@/services/password-reset.service";

const PROBLEM_CODES: Record<string, string> = {
  "Use at least 8 characters.": "short",
  "Use 72 characters or fewer.": "long",
  "The two passwords do not match.": "mismatch",
};

export async function resetPasswordAction(form: FormData) {
  const store = await cookies();
  const token = store.get(RESET_COOKIE)?.value;
  const password = String(form.get("password") || "");
  const confirm = String(form.get("confirmPassword") || "");
  const problem = passwordProblem(password, confirm);
  if (problem) redirect(`${RESET_COOKIE_PATH}?error=${PROBLEM_CODES[problem]}`);
  const result = await resetPassword(token, password);
  store.delete({ name: RESET_COOKIE, path: RESET_COOKIE_PATH });
  redirect(result.ok ? "/login?reset=1" : RESET_COOKIE_PATH);
}
