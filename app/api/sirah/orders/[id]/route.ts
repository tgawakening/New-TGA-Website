import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { normalizeSirahPhone } from "@/lib/sirah/phone";
import { SirahError, auditSirah } from "@/services/sirah-registration.service";
import { checkSirahOrigin } from "@/lib/sirah/http";
import { sirahUser, sirahResponseError, privateJson } from "@/lib/sirah/http";
import { publicSirahOrder } from "@/services/sirah-registration.service";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await sirahUser((await params).id);
    return privateJson({
      order: await publicSirahOrder((await params).id, user.id),
    });
  } catch (error) {
    return sirahResponseError(error);
  }
}

// Correct contact details on the same unpaid registration; account email stays verified separately.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    checkSirahOrigin(request);
    const id = (await params).id;
    const user = await sirahUser(id);
    const input = z
      .object({
        revision: z.number().int().nonnegative(),
        fullName: z.string().trim().min(2).max(120),
        phoneCountry: z.string().length(2),
        callingCode: z.string().regex(/^\+\d{1,4}$/),
        phone: z.string().min(5).max(40),
      })
      .strict()
      .parse(await request.json());
    const phone = normalizeSirahPhone(
      input.phoneCountry,
      input.callingCode,
      input.phone,
    );
    await prisma.$transaction(async (tx) => {
      const changed = await tx.sirahOrder.updateMany({
        where: {
          id,
          userId: user.id,
          revision: input.revision,
          paymentState: { in: ["UNPAID", "REJECTED", "FAILED"] },
          enrolmentState: "PENDING",
          paidCount: 0,
          providerOrderId: null,
          providerSubscriptionId: null,
        },
        data: {
          phoneCountry: phone.phoneCountry,
          phoneE164: phone.phoneE164,
          revision: { increment: 1 },
        },
      });
      if (changed.count !== 1)
        throw new SirahError(
          "Check your pending payment before editing registration details.",
          409,
        );
      await tx.user.update({
        where: { id: user.id },
        data: {
          fullName: input.fullName,
          phoneCountryCode: phone.phoneCountryCode,
          phoneNumber: phone.phoneNumber,
        },
      });
      await auditSirah(tx, id, `student:${user.id}`, "CONTACT_UPDATED", {});
    });
    return privateJson({ order: await publicSirahOrder(id, user.id) });
  } catch (error) {
    return sirahResponseError(error);
  }
}
