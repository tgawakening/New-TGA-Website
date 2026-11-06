import { sirahUser, sirahResponseError, privateJson } from "@/lib/sirah/http";
import { publicSirahOrder } from "@/services/sirah-registration.service";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await sirahUser();
    return privateJson({
      order: await publicSirahOrder((await params).id, user.id),
    });
  } catch (error) {
    return sirahResponseError(error);
  }
}
