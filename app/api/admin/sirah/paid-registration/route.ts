import { NextResponse } from "next/server";
import { checkSirahOrigin, privateJson, sirahExclusionActor, sirahResponseError } from "@/lib/sirah/http";
import { taskAdminRole } from "@/lib/lms/task-admin-access";
import { SirahError } from "@/services/sirah-registration.service";
import { adminPaidRegistrationSchema, adminRegistrationCohorts, createAdminPaidRegistration, ExistingSirahRegistration } from "@/services/sirah-admin-paid-registration.service";

async function actor(request: Request) {
  if (!await taskAdminRole()) throw new SirahError("Only the super admin or a manager can add registrations.", 403);
  return sirahExclusionActor(request);
}
export async function GET(request: Request) {
  try { await actor(request); return privateJson({ cohorts: await adminRegistrationCohorts() }); }
  catch (error) { return sirahResponseError(error); }
}
export async function POST(request: Request) {
  try {
    checkSirahOrigin(request);
    const who = await actor(request);
    const parsed = adminPaidRegistrationSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Check the registration fields and try again.", fields: parsed.error.flatten().fieldErrors }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
    return privateJson(await createAdminPaidRegistration(parsed.data, who));
  } catch (error) {
    if (error instanceof ExistingSirahRegistration) return NextResponse.json({ error: error.message, existing: error.existing }, { status: 409, headers: { "Cache-Control": "private, no-store" } });
    return sirahResponseError(error);
  }
}
