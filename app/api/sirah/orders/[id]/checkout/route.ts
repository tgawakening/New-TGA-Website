import { z } from "zod";
import {
  checkSirahOrigin,
  sirahUser,
  sirahResponseError,
  privateJson,
} from "@/lib/sirah/http";
import { resumeSirahCheckout, startSirahCheckout } from "@/services/sirah-online.service";
import { SirahError } from "@/services/sirah-registration.service";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const returnOrigin = checkSirahOrigin(request);
    const { id } = await params;
    const user = await sirahUser(id);
    const body: unknown = await request.json();
    if (z.object({ resume: z.literal(true) }).strict().safeParse(body).success)
      return privateJson(await resumeSirahCheckout(id, user.id, returnOrigin));
    const input = z
      .object({
        revision: z.number().int().nonnegative(),
        acceptedTermsVersion: z.string().min(1),
        earlyServiceRequested: z.boolean().optional(),
        digitalContentConsented: z.boolean().optional(),
        embeddedStripe: z.boolean().optional(),
      })
      .strict()
      .safeParse(body);
    if (!input.success)
      throw new SirahError("Review and accept the payment terms.");
    return privateJson(
      await startSirahCheckout(
        id,
        user.id,
        input.data.revision,
        input.data.acceptedTermsVersion,
        undefined,
        returnOrigin,
        {
          earlyServiceRequested: input.data.earlyServiceRequested,
          digitalContentConsented: input.data.digitalContentConsented,
        },
        input.data.embeddedStripe,
      ),
    );
  } catch (error) {
    return sirahResponseError(error);
  }
}
