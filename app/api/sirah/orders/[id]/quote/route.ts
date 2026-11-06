import {
  checkSirahOrigin,
  sirahUser,
  sirahResponseError,
  privateJson,
} from "@/lib/sirah/http";
import {
  repriceSirah,
  SirahError,
} from "@/services/sirah-registration.service";
import { sirahRepriceSchema } from "@/lib/sirah/validation";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    checkSirahOrigin(request);
    const user = await sirahUser();
    const input = sirahRepriceSchema.safeParse(await request.json());
    if (!input.success)
      throw new SirahError(
        "Select a valid country, plan and available payment method. Prices are resolved by the server.",
      );
    const v = input.data;
    return privateJson({
      order: await repriceSirah(
        (await params).id,
        user.id,
        v.revision,
        v.countryCode,
        v.plan,
        v.method,
      ),
    });
  } catch (error) {
    return sirahResponseError(error);
  }
}
