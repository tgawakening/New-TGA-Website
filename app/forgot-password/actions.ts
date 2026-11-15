"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request-ip";
import { requestPasswordReset } from "@/services/password-reset.service";

const MINUTE = 60_000;

/** Always the same outcome, whatever the email: the neutral confirmation.
 * The lookup and the email happen after the response, so neither the
 * answer nor its timing says whether an account exists. */
export async function requestResetAction(form: FormData) {
  const email = String(form.get("email") || "").trim().toLowerCase().slice(0, 191);
  const ip = clientIp(await headers()) || "unknown";
  const allowed = checkRateLimit([
    { key: `password-reset:ip:${ip}:15m`, limit: 10, windowMs: 15 * MINUTE },
    { key: `password-reset:email:${email}:h`, limit: 5, windowMs: 60 * MINUTE },
  ]).ok;
  if (allowed && z.email().safeParse(email).success) after(() => requestPasswordReset(email).then(() => undefined, () => undefined));
  redirect("/forgot-password?sent=1");
}
