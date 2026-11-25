import { NextResponse } from "next/server";
import { checkSirahOrigin, sirahResponseError } from "@/lib/sirah/http";
import { sirahClientIp, sirahRateLimit, MINUTE, HOUR } from "@/lib/sirah/rate-limit";
import { readSirahMultipart } from "@/lib/sirah/multipart";
import { scholarshipApplicationSchema } from "@/lib/sirah/scholarship-application";
import { submitApplication } from "@/services/sirah-scholarship-application.service";
import { SirahError } from "@/services/sirah-registration.service";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    checkSirahOrigin(request);
    const ip = sirahClientIp(request);
    const limited = sirahRateLimit([{ key: `scholarship-application:${ip}:minute`, limit: 10, windowMs: MINUTE }, { key: `scholarship-application:${ip}:hour`, limit: 50, windowMs: HOUR }]);
    if (limited) return limited;
    const form = await readSirahMultipart(request).catch(() => { throw new SirahError("Upload a PDF up to 4 MB.", 413); });
    const fields = Object.fromEntries(["fullName", "email", "phone", "countryCode", "arrangementType", "currency", "requestedAmount", "reason"].map(key => [key, String(form.get(key) || "")]));
    const parsed = scholarshipApplicationSchema.safeParse(fields);
    if (!parsed.success) throw new SirahError("Check your details, international phone number, currency and requested amount.");
    const file = form.get("document");
    let document: { name: string; data: Uint8Array } | null = null;
    if (file instanceof File && file.size) {
      if (file.size > 4 * 1024 * 1024 || !file.name.toLowerCase().endsWith(".pdf")) throw new SirahError("Upload a PDF up to 4 MB.");
      const data = new Uint8Array(await file.arrayBuffer());
      if (Buffer.from(data.subarray(0, 5)).toString() !== "%PDF-") throw new SirahError("Upload a valid PDF.");
      document = { name: file.name, data };
    }
    await submitApplication(parsed.data, document);
    return NextResponse.json({ ok: true });
  } catch (error) { return sirahResponseError(error); }
}
