import { z } from "zod";
import {
  checkSirahOrigin,
  sirahUser,
  sirahResponseError,
  privateJson,
} from "@/lib/sirah/http";
import { startSirahCheckout } from "@/services/sirah-online.service";
import { SirahError } from "@/services/sirah-registration.service";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    checkSirahOrigin(request);
    const user = await sirahUser((await params).id);
    const input = z
      .object({
        revision: z.number().int().nonnegative(),
        acceptedTermsVersion: z.string().min(1),
      })
      .strict()
      .safeParse(await request.json());
    if (!input.success)
      throw new SirahError("Review and accept the payment terms.");
    return privateJson(
      await startSirahCheckout(
        (await params).id,
        user.id,
        input.data.revision,
        input.data.acceptedTermsVersion,
      ),
    );
  } catch (error) {
    return sirahResponseError(error);
  }
}
