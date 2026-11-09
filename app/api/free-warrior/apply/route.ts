import { readSirahMultipart } from "@/lib/sirah/multipart";
import { SirahError } from "@/services/sirah-registration.service";
import { NextResponse } from "next/server";
import { freeWarriorApplicationSchema } from "@/lib/validations/free-warrior";
import { submitFreeWarriorApplication } from "@/services/free-warrior.service";

export async function POST(request: Request) {
  try {
    const multipart = request.headers.get("content-type")?.includes("multipart/form-data");
    const form = multipart ? await readSirahMultipart(request).catch(() => { throw new SirahError("Upload a JPG, PNG or PDF receipt up to 4 MB.", 413); }) : null;
    let json;
    try { json = form ? JSON.parse(String(form.get("details") || "{}")) : await request.json(); }
    catch { throw new SirahError("Invalid scholarship application data."); }
    const parsed = freeWarriorApplicationSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid Fee Waiver application data.",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const file = form?.get("receipt");
    const result = await submitFreeWarriorApplication(parsed.data, file instanceof File && file.size ? { data: new Uint8Array(await file.arrayBuffer()), name: file.name } : null);
    return NextResponse.json({
      message: "Application submitted. We will email you after review.",
      applicationId: result.applicationId,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Fee Waiver application failed." },
      { status: error instanceof SirahError ? error.status : 500 },
    );
  }
}
