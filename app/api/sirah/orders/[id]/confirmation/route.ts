import { prisma } from "@/lib/prisma";
import { sirahUser, sirahResponseError, privateJson } from "@/lib/sirah/http";
import { getGroupInvitation, PAYMENT_SUPPORT_URL } from "@/lib/sirah/config";
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
    const user = await sirahUser();
    const order = await ownedSirahOrder((await params).id, user.id);
    if (order.paymentState !== "PAID" || !canAccessSirah(order))
      throw new SirahError(
        "Course invitation is available after verified payment and enrolment approval.",
        403,
      );
    const groupUrl = getGroupInvitation(order.countryCode);
    if (!groupUrl)
      await prisma.sirahOrder.update({
        where: { id: order.id },
        data: { invitationState: "PENDING" },
      });
    return privateJson({
      courseTitle: SIRAH_TITLE,
      reference: order.reference,
      groupUrl,
      contactUrl: groupUrl ? null : PAYMENT_SUPPORT_URL,
      message: groupUrl
        ? "Join your course WhatsApp group for class updates."
        : "Your enrolment is confirmed. Your course group invitation will follow.",
    });
  } catch (error) {
    return sirahResponseError(error);
  }
}
