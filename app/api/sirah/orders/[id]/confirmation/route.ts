import { sirahUser, sirahResponseError, privateJson } from "@/lib/sirah/http";
import { canAccessSirah } from "@/services/sirah-confirmation.service";
import {
  ownedSirahOrder,
  SirahError,
} from "@/services/sirah-registration.service";
import { SIRAH_TITLE } from "@/lib/sirah/catalog";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await sirahUser((await params).id);
    const order = await ownedSirahOrder((await params).id, user.id);
    if (order.paymentState !== "PAID" || !canAccessSirah(order))
      throw new SirahError(
        "Course invitation is available after verified payment and enrolment approval.",
        403,
      );
    // Course updates are in the classroom; there is no WhatsApp group invitation.
    return privateJson({
      courseTitle: SIRAH_TITLE,
      reference: order.reference,
      classroomUrl: "/seerah/classroom",
      message:
        "Your enrolment is confirmed. Your live classes, recordings and course updates are in your classroom.",
    });
  } catch (error) {
    return sirahResponseError(error);
  }
}
