import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SIRAH_BATCH, SIRAH_SLUG } from "@/lib/sirah/catalog";
import {
  checkSirahOrigin,
  privateJson,
  sirahResponseError,
} from "@/lib/sirah/http";
import {
  sirahClientIp,
  sirahRateLimit,
  MINUTE,
  HOUR,
} from "@/lib/sirah/rate-limit";
import {
  queueSirahNotice,
  dispatchSirahNotifications,
} from "@/services/sirah-notifications.service";
export async function POST(request: Request) {
  try {
    checkSirahOrigin(request);
    const { email } = z
      .object({
        email: z
          .email()
          .max(254)
          .transform((v) => v.toLowerCase()),
      })
      .strict()
      .parse(await request.json());
    // This triggers an outbound email, so cap per address (anti email-bombing)
    // and per IP (anti mass-probing). A real visitor requests once; these
    // ceilings never affect that. The outbox also enforces one email per
    // registration per hour independently.
    const resumeLimited = sirahRateLimit([
      { key: `sirah-resume:email:${email}:h`, limit: 5, windowMs: HOUR },
      { key: `sirah-resume:ip:${sirahClientIp(request)}:m`, limit: 10, windowMs: MINUTE },
      { key: `sirah-resume:ip:${sirahClientIp(request)}:h`, limit: 60, windowMs: HOUR },
    ]);
    if (resumeLimited) return resumeLimited;
    const hour = Math.floor(Date.now() / 3600000).toString();
    // One fresh-link email per registration per hour, enforced by the durable outbox unique key.
    const order = await prisma.sirahOrder.findFirst({
      where: {
        user: { email, status: "ACTIVE" },
        batchCode: SIRAH_BATCH,
        course: { slug: SIRAH_SLUG },
      },
    });
    if (order && order.paymentState !== "PAID") {
      await prisma.$transaction((tx) =>
        queueSirahNotice(tx, order.id, "PAYMENT_RESUME", hour),
      );
      await dispatchSirahNotifications(order.id).catch(() => {});
    }
    return privateJson({
      message:
        "If an unpaid Sīrah registration matches this email, a fresh payment link will be sent. If you have paid, sign in to view your confirmation.",
    });
  } catch (error) {
    return sirahResponseError(error);
  }
}
