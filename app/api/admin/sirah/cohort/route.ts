import { z } from "zod";
import {
  checkSirahOrigin,
  sirahAdmin,
  privateJson,
  sirahResponseError,
} from "@/lib/sirah/http";
import {
  publicSirahCohort,
  updateSirahCohort,
} from "@/services/sirah-cohort.service";
import { SirahError } from "@/services/sirah-registration.service";
export async function GET(request: Request) {
  try {
    await sirahAdmin(request);
    return privateJson(await publicSirahCohort());
  } catch (error) {
    return sirahResponseError(error);
  }
}
export async function POST(request: Request) {
  try {
    checkSirahOrigin(request);
    const actor = await sirahAdmin(request);
    const input = z
      .object({
        revision: z.number().int().nonnegative(),
        commencementDate: z.string().date().nullable(),
        ownerConfirmed: z.boolean(),
        sourceReference: z.string().trim().min(3).max(190).optional(),
        reason: z.string().trim().min(10).max(1000),
      })
      .strict()
      .safeParse(await request.json());
    if (!input.success)
      throw new SirahError(
        "Check the date, confirmation reference and reason.",
      );
    return privateJson(await updateSirahCohort(input.data, actor));
  } catch (error) {
    return sirahResponseError(error);
  }
}
