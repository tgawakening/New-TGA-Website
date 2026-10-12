import { prisma } from "@/lib/prisma";
import { sendTransactionalEmail } from "@/lib/email";
import { missionContactEmail } from "@/lib/mission-support";
import { donationCountry } from "@/lib/mission-payment-options";
import { divineBondsSchema } from "@/lib/validations/divine-bonds";
import type { z } from "zod";

const escape = (text: string) => text.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));

export async function submitDivineBondsInterest(input: z.infer<typeof divineBondsSchema>) {
  const country = donationCountry(input.countryCode)!;
  const payload = { name: input.name, email: input.email, countryCode: country.code, countryName: country.name, phone: country.dialCode + input.phone.replace(/\D/g, ""), interest: input.interest, reason: input.reason, consent: true };
  // Keep the interest record even if the email provider is temporarily unavailable.
  const previous = await prisma.emailLog.findFirst({ where: { emailType: "DIVINE_BONDS_WAITLIST", createdAt: { gte: new Date(Date.now() - 86400000) }, payload: { path: "$.email", equals: input.email } }, select: { id: true, status: true } });
  if (previous && previous.status !== "NOTIFICATION_PENDING") return { reference: previous.id };
  const entry = previous
    ? await prisma.emailLog.update({ where: { id: previous.id }, data: { payload, status: "RECEIVED" } })
    : await prisma.emailLog.create({ data: { emailType: "DIVINE_BONDS_WAITLIST", status: "RECEIVED", toEmail: missionContactEmail, subject: "New Divine Bonds waitlist interest", payload } });
  const text = `New Divine Bonds waitlist interest\nReference: ${entry.id}\nName: ${payload.name}\nEmail: ${payload.email}\nCountry: ${payload.countryName} (${payload.countryCode})\nPhone: ${payload.phone}\nInterest: ${payload.interest}\nReason: ${payload.reason}\nConsent: contact about Divine Bonds updates and this enquiry.`;
  try {
    const result = await sendTransactionalEmail({ to: missionContactEmail, emailType: "DIVINE_BONDS_WAITLIST_NOTIFICATION", subject: "New Divine Bonds waitlist interest", text, html: `<h2>New Divine Bonds interest</h2><p>Please review this waitlist enquiry.</p><pre style="white-space:pre-wrap;font-family:Arial">${escape(text)}</pre>` });
    await prisma.emailLog.update({ where: { id: entry.id }, data: { status: result.status === "SENT" ? "NOTIFIED" : "NOTIFICATION_PENDING" } });
  } catch {
    await prisma.emailLog.update({ where: { id: entry.id }, data: { status: "NOTIFICATION_PENDING", error: "Interest saved; notification delivery requires retry." } });
  }
  return { reference: entry.id };
}
