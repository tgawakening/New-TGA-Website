import {
  checkSirahOrigin,
  sirahUser,
  sirahResponseError,
  privateJson,
} from "@/lib/sirah/http";
import { resetUnsettledSirahCheckout } from "@/services/sirah-online.service";
import { publicSirahOrder } from "@/services/sirah-registration.service";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    checkSirahOrigin(request);
    const user = await sirahUser();
    const id = (await params).id;
    await resetUnsettledSirahCheckout(id, user.id);
    return privateJson({ order: await publicSirahOrder(id, user.id) });
  } catch (error) {
    return sirahResponseError(error);
  }
}
