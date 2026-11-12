import { sirahSchemaAvailable } from "@/lib/sirah/readiness";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser, attachSessionCookie } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { SIRAH_SLUG } from "@/lib/sirah/catalog";
import { sirahPaymentRegistrationSchema } from "@/lib/sirah/registration-payment";
import { readSirahMultipart } from "@/lib/sirah/multipart";
import { validateSirahReceipt } from "@/services/sirah-receipts.service";
import type { SirahInitialPayment } from "@/services/sirah-manual-submission.service";
import {
  registerSirah,
  publicSirahOrder,
  SirahError,
} from "@/services/sirah-registration.service";
import {
  checkSirahOrigin,
  sirahUser,
  sirahResponseError,
  privateJson,
} from "@/lib/sirah/http";
import {
  sirahClientIp,
  sirahRateLimit,
  MINUTE,
  HOUR,
} from "@/lib/sirah/rate-limit";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    checkSirahOrigin(request);
    // GENTLE: registration must tolerate many students from one shared IP
    // (schools, families). This is only a runaway-script guard — per IP, no
    // per-email limit (one registration per email is already enforced by a
    // unique constraint) — set high enough for a large classroom burst.
    const registerIp = sirahClientIp(request);
    const registerLimited = sirahRateLimit([
      { key: `sirah-register:ip:${registerIp}:m`, limit: 100, windowMs: MINUTE },
      { key: `sirah-register:ip:${registerIp}:h`, limit: 600, windowMs: HOUR },
    ]);
    if (registerLimited) return registerLimited;
    if (!(await sirahSchemaAvailable()))
      throw new SirahError(
        "Registration setup is being completed. Please enquire on WhatsApp while registration is unavailable.",
        503,
      );
    const multipart = request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("multipart/form-data");
    const form = multipart
      ? await readSirahMultipart(request).catch(() => {
          throw new SirahError(
            "Upload a JPG, PNG, WebP or PDF receipt up to 4 MB.",
            413,
          );
        })
      : null;
    let input: unknown;
    try {
      input = form
        ? JSON.parse(String(form.get("details") || "{}"))
        : await request.json();
    } catch {
      throw new SirahError("Please check the registration fields.");
    }
    const parsed = sirahPaymentRegistrationSchema.safeParse(input);
    if (
      !parsed.success &&
      input &&
      typeof input === "object" &&
      (!("residenceConfirmed" in input) || !("acceptedTermsVersion" in input))
    )
      return NextResponse.json(
        {
          error:
            "Registration requirements have changed. Reload this page to choose a payment method and complete the payment details.",
        },
        { status: 409 },
      );
    if (!parsed.success)
      return NextResponse.json(
        {
          error: "Please check the highlighted registration fields.",
          fields: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    const payment: SirahInitialPayment = {
      acceptedTermsVersion: parsed.data.acceptedTermsVersion,
      accessConsents: {
        earlyServiceRequested: parsed.data.earlyServiceRequested,
        digitalContentConsented: parsed.data.digitalContentConsented,
      },
    };
    if (parsed.data.manualPayment) {
      const file = form?.get("receipt");
      if (!(file instanceof File) || !file.size)
        return NextResponse.json(
          {
            error: "Upload your payment receipt.",
            fields: { receipt: ["A payment receipt is required."] },
          },
          { status: 400 },
        );
      payment.manual = {
        receipt: await validateSirahReceipt(
          new Uint8Array(await file.arrayBuffer()),
          file.name,
        ),
        details: parsed.data.manualPayment,
      };
    }
    const user = await getCurrentUser();
    if (user && user.status !== "ACTIVE")
      throw new SirahError("Your account is not active.", 403);
    const result = await registerSirah(parsed.data, user?.id, payment);
    const response = privateJson({
      order: await publicSirahOrder(result.orderId, result.userId),
      message: result.existing
        ? "Your saved course registration already exists. Its current payment and enrolment status are shown below."
        : payment.manual
          ? "Transfer evidence received. Enrolment is pending TGA’s receipt verification."
          : "Details saved. Complete payment to confirm your enrolment.",
    });
    if (!user) await attachSessionCookie(response, result.userId);
    return response;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      return NextResponse.json(
        {
          error:
            "This registration or email already exists. Please sign in and open your saved registration.",
        },
        { status: 409 },
      );
    return sirahResponseError(error);
  }
}
export async function GET() {
  try {
    const user = await sirahUser();
    if (!(await sirahSchemaAvailable())) return privateJson({ orders: [] });
    const rows = await prisma.sirahOrder.findMany({
      where: { userId: user.id, course: { slug: SIRAH_SLUG } },
      select: {
        id: true,
        reference: true,
        paymentState: true,
        enrolmentState: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return privateJson({ orders: rows });
  } catch (error) {
    return sirahResponseError(error);
  }
}
