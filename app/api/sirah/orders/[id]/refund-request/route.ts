import { z } from "zod";
import {
  checkSirahOrigin,
  sirahUser,
  privateJson,
  sirahResponseError,
} from "@/lib/sirah/http";
import { SirahError } from "@/services/sirah-registration.service";
import { requestSirahAnnualRefund } from "@/services/sirah-refunds.service";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    checkSirahOrigin(request);
    const { id } = await params;
    const user = await sirahUser(id);
    const input = z
      .object({
        revision: z.number().int().nonnegative(),
        reason: z.string().trim().min(3).max(1500),
      })
      .strict()
      .safeParse(await request.json());
    if (!input.success)
      throw new SirahError(
        "Provide a refund-review reason and the current registration revision.",
        400,
      );
    return privateJson(
      await requestSirahAnnualRefund(
        id,
        user.id,
        input.data.revision,
        input.data.reason,
      ),
    );
  } catch (error) {
    return sirahResponseError(error);
  }
}
